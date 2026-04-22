import uuid
import json
import time
from datetime import datetime, timezone
from typing import Any, Dict, List

from langchain_core.language_models.chat_models import BaseChatModel
from langchain_core.messages import (
    AIMessage,
    HumanMessage,
    SystemMessage,
    ToolMessage,
    messages_to_dict,
    messages_from_dict
)
from sqlmodel import Session, select

from app.agents.event_logger import EventLogger
from app.agents.interception import InterceptionHook, InterceptionDecision
from app.agents.runtime_state import RuntimeState
from app.agents.tool_adapter import ToolAdapter
from app.database import engine
from app.schemas import AgentDefinition, AgentDefinitionTool
from app import models


class AgentRuntime:    
    def __init__(
        self,
        agent_definition: AgentDefinition,
        chat_model: BaseChatModel,
        db_session: Session
    ):
        self.agent_def = agent_definition
        self.db_session = db_session
        self.logger = EventLogger(db_session)
        
        self.tools_dict: Dict[str, AgentDefinitionTool] = {
            tool.name: tool for tool in agent_definition.tools
        }
        self.chat_model = self._bind_tools(chat_model)
        
        self.system_prompt = self._build_system_prompt()
        self.last_state_snapshot = None

    def _passthrough_terminal_state(self, state: RuntimeState) -> RuntimeState:
        return {
            "execution_status": state.get("execution_status"),
            "final_output": state.get("final_output"),
            "error": state.get("error"),
            "pending_tool_call": state.get("pending_tool_call"),
            "pending_tool_decision": state.get("pending_tool_decision"),
        }

    def _build_tool_specs(self) -> List[Dict[str, Any]]:
        return [
            {
                "name": tool.name,
                "description": tool.description,
                "parameters": tool.input_schema,
            }
            for tool in self.agent_def.tools
        ]

    def _bind_tools(self, chat_model: BaseChatModel) -> BaseChatModel:
        if not self.agent_def.tools:
            return chat_model

        try:
            return chat_model.bind_tools(self._build_tool_specs())
        except (AttributeError, NotImplementedError, ValueError):
            return chat_model

    def _build_runtime_components(
        self,
        session_id: str,
    ) -> tuple[ToolAdapter, InterceptionHook]:
        tool_adapter = ToolAdapter(self.tools_dict)
        interception_hook = InterceptionHook(
            session_id=session_id,
            agent_id=self.agent_def.agent_id,
            logger=self.logger,
            allowed_tool_ids=[tool.id for tool in self.agent_def.tools],
            frequency_limit=self.agent_def.policy.frequency_limit,
            require_approval_for_all=self.agent_def.policy.require_approval_for_all_tool_calls
        )
        return tool_adapter, interception_hook
    
    def _build_system_prompt(self) -> str:
        prompt_parts = [
            f"You are {self.agent_def.name}.",
            f"Purpose: {self.agent_def.purpose}",
            f"Description: {self.agent_def.description}",
            "\nAvailable tools:"
        ]
        
        for tool in self.agent_def.tools:
            prompt_parts.append(f"- {tool.name}: {tool.description}")
        
        prompt_parts.append("\nFollow these rules:")
        prompt_parts.append("- Use one tool call when a tool is needed to answer the user")
        prompt_parts.append("- Use at most one tool call per turn")
        prompt_parts.append("- After a tool returns, answer from the tool result")
        prompt_parts.append("- Do not invent tool results")
        prompt_parts.append("- Do not ask the user for approval unless the runtime has explicitly paused the tool call")
        prompt_parts.append("- Provide clear, concise answers")
        prompt_parts.append("- If you cannot answer, explain why")
        
        return "\n".join(prompt_parts)
    
    def execute(self, user_input: str, session_id: str | None = None) -> Dict:
        session_id = session_id or str(uuid.uuid4())
        
        # Log session start
        self.logger.log_session_start(
            session_id=session_id,
            agent_id=self.agent_def.agent_id,
            user_input=user_input
        )
        
        tool_adapter, interception_hook = self._build_runtime_components(session_id)
        
        # Initialize state
        initial_state: RuntimeState = {
            "session_id": session_id,
            "agent_id": self.agent_def.agent_id,
            "messages": [
                SystemMessage(content=self.system_prompt),
                HumanMessage(content=user_input)
            ],
            "pending_tool_call": None,
            "pending_tool_decision": None,
            "execution_status": "running",
            "final_output": None,
            "error": None
        }
        
        try:
            self.last_state_snapshot = None
            final_state = self._run_simple_turn(initial_state, tool_adapter, interception_hook)
            status = final_state.get("execution_status", "failed")
            if status == "paused":
                self._save_paused_state(final_state)
                self.logger.log_session_end(
                    session_id=session_id,
                    agent_id=self.agent_def.agent_id,
                    status="paused",
                    final_output=None,
                    error=final_state.get("error")
                )
                return {
                    "session_id": session_id,
                    "status": "paused",
                    "final_output": None,
                    "error": final_state.get("error")
                }
            
            # Log session end
            self.logger.log_session_end(
                session_id=session_id,
                agent_id=self.agent_def.agent_id,
                status=status,
                final_output=final_state.get("final_output"),
                error=final_state.get("error")
            )
            
            return {
                "session_id": session_id,
                "status": status,
                "final_output": final_state.get("final_output"),
                "error": final_state.get("error")
            }
        
        except Exception as e:
            # Log failure
            self.logger.log_session_end(
                session_id=session_id,
                agent_id=self.agent_def.agent_id,
                status="failed",
                error=str(e)
            )
            
            return {
                "session_id": session_id,
                "status": "failed",
                "final_output": None,
                "error": str(e)
            }

    def run_chat_turn(self, session_id: str, conversation_messages: List[HumanMessage | AIMessage]) -> Dict[str, Any]:
        tool_adapter, interception_hook = self._build_runtime_components(session_id)

        initial_state: RuntimeState = {
            "session_id": session_id,
            "agent_id": self.agent_def.agent_id,
            "messages": [SystemMessage(content=self.system_prompt), *conversation_messages],
            "pending_tool_call": None,
            "pending_tool_decision": None,
            "execution_status": "running",
            "final_output": None,
            "error": None,
        }

        try:
            self.last_state_snapshot = None
            final_state = self._run_simple_turn(initial_state, tool_adapter, interception_hook)
            status = final_state.get("execution_status", "failed")
            if status == "paused":
                self._save_paused_state(final_state)

            return {
                "session_id": session_id,
                "status": status,
                "final_output": final_state.get("final_output"),
                "error": final_state.get("error"),
                "state": final_state,
            }
        except Exception as exc:
            return {
                "session_id": session_id,
                "status": "failed",
                "final_output": None,
                "error": str(exc),
                "state": None,
            }
    
    def _merge_state(self, state: RuntimeState, update: RuntimeState) -> RuntimeState:
        merged = dict(state)
        for key, value in update.items():
            if key == "messages":
                merged["messages"] = [*merged.get("messages", []), *value]
            else:
                merged[key] = value
        return merged

    def _run_simple_turn(
        self,
        initial_state: RuntimeState,
        tool_adapter: ToolAdapter,
        interception_hook: InterceptionHook,
    ) -> RuntimeState:
        state = self._merge_state(initial_state, self._reason_node(initial_state))
        if state.get("execution_status") != "running":
            return state

        state = self._merge_state(state, self._decide_action_node(state, interception_hook))
        if state.get("execution_status") != "running":
            return state

        if state.get("pending_tool_call") and state.get("pending_tool_decision") == "allow":
            state = self._merge_state(state, self._invoke_tool_node(state, tool_adapter, interception_hook))
            if state.get("execution_status") != "running":
                return state

            state = self._merge_state(state, self._reason_node(state))
            if state.get("execution_status") != "running":
                return state

            state = self._merge_state(state, self._decide_action_node(state, interception_hook))

        return state
    
    def _reason_node(self, state: RuntimeState) -> RuntimeState:
        if state.get("execution_status") != "running":
            return self._passthrough_terminal_state(state)

        self.logger.log_node_transition(
            session_id=state["session_id"],
            agent_id=state["agent_id"],
            from_node="previous",
            to_node="reason"
        )
        
        try:
            response = self.chat_model.invoke(state["messages"])
            return {"messages": [response]}
        
        except Exception as e:
            return {
                "execution_status": "failed",
                "error": f"Reasoning error: {str(e)}"
            }

    def _serialize_tool_payload(self, payload: Any) -> str:
        if isinstance(payload, str):
            return payload

        try:
            return json.dumps(payload, ensure_ascii=True)
        except TypeError:
            return str(payload)

    @staticmethod
    def _has_tool_result(state: RuntimeState) -> bool:
        return any(isinstance(message, ToolMessage) for message in state.get("messages", []))
    
    def _decide_action_node(
        self,
        state: RuntimeState,
        interception_hook: InterceptionHook
    ) -> RuntimeState:
        if state.get("execution_status") != "running":
            return self._passthrough_terminal_state(state)

        self.logger.log_node_transition(
            session_id=state["session_id"],
            agent_id=state["agent_id"],
            from_node="reason",
            to_node="decide_action"
        )
        
        messages = state["messages"]
        if not messages:
            return {"execution_status": "failed", "error": "No messages"}
        
        last_message = messages[-1]
        
        # Check if LLM wants to call a tool
        if isinstance(last_message, AIMessage) and hasattr(last_message, "tool_calls"):
            tool_calls = getattr(last_message, "tool_calls", [])
            if tool_calls:
                if self._has_tool_result(state):
                    return {
                        "execution_status": "failed",
                        "error": "Only one tool call is supported per runtime turn",
                        "pending_tool_call": None,
                        "pending_tool_decision": None
                    }

                pending_call = tool_calls[0]
                tool_name = pending_call.get("name", "unknown")
                tool_def = self.tools_dict.get(tool_name)
                if not tool_def:
                    return {
                        "execution_status": "failed",
                        "error": f"Tool not found: {tool_name}",
                        "pending_tool_call": None,
                        "pending_tool_decision": None
                    }

                decision = interception_hook.intercept(
                    tool_name,
                    pending_call.get("args", {}),
                    tool_def.id
                )

                if decision.decision == "block":
                    return {
                        "execution_status": "terminated",
                        "error": f"Tool execution blocked: {decision.reason}",
                        "pending_tool_call": None,
                        "pending_tool_decision": "block"
                    }

                if decision.decision == "pause":
                    return {
                        "execution_status": "paused",
                        "error": f"Tool execution paused: {decision.reason}",
                        "pending_tool_call": pending_call,
                        "pending_tool_decision": "pause"
                    }

                # Allowed tool call; continue to invocation
                return {
                    "pending_tool_call": pending_call,
                    "pending_tool_decision": "allow",
                    "error": None
                }
        
        # No tool call - extract final answer
        if isinstance(last_message, AIMessage):
            content = getattr(last_message, "content", "")
            return {
                "execution_status": "completed",
                "final_output": content,
                "pending_tool_call": None,
                "pending_tool_decision": None,
                "error": None
            }
        
        return {
            "execution_status": "completed",
            "final_output": "No response",
            "pending_tool_call": None,
            "pending_tool_decision": None,
            "error": None
        }
    
    def _invoke_tool_node(
        self,
        state: RuntimeState,
        tool_adapter: ToolAdapter,
        interception_hook: InterceptionHook
    ) -> RuntimeState:
        if state.get("execution_status") != "running":
            return self._passthrough_terminal_state(state)

        self.logger.log_node_transition(
            session_id=state["session_id"],
            agent_id=state["agent_id"],
            from_node="decide_action",
            to_node="invoke_tool"
        )
        
        pending_call = state.get("pending_tool_call")
        if not pending_call:
            return {
                "execution_status": "failed",
                "error": "No pending tool call"
            }
        
        tool_name = pending_call.get("name", "unknown")
        tool_params = pending_call.get("args", {})
        tool_decision = state.get("pending_tool_decision")
        
        try:
            # Execute through adapter (interception already handled before breakpoint)
            if tool_decision == "allow":
                intercept_fn = lambda tn, tp, tid: InterceptionDecision(
                    decision="allow",
                    reason="Pre-approved tool call"
                )
            else:
                intercept_fn = lambda tn, tp, tid: interception_hook.intercept(tn, tp, tid)

            result = tool_adapter.invoke_tool(
                tool_name=tool_name,
                params=tool_params,
                interception_hook=intercept_fn
            )
            
            # Log result
            self.logger.log_tool_result(
                session_id=state["session_id"],
                agent_id=state["agent_id"],
                tool_name=tool_name,
                result=result.get("result", result.get("error")),
                duration_ms=result.get("duration_ms", 0),
                success=bool(result.get("success", False))
            )
            
            # Check if execution was blocked
            if result.get("blocked"):
                return {
                    "execution_status": "terminated",
                    "error": result.get("error", "Tool execution was blocked by policy"),
                    "pending_tool_call": None,
                    "pending_tool_decision": None
                }
            
            # Check if execution was paused (approval required)
            if result.get("paused"):
                return {
                    "execution_status": "paused",
                    "error": result.get("error", "Tool execution paused - awaiting approval"),
                    "pending_tool_call": pending_call,  # Keep pending call for resume
                    "pending_tool_decision": tool_decision
                }
            
            # Successful execution - append tool result to messages
            if result.get("success"):
                tool_payload = result.get("result", result)
                return {
                    "messages": [
                        ToolMessage(
                            content=self._serialize_tool_payload(tool_payload),
                            tool_call_id=pending_call.get("id", "unknown")
                        )
                    ],
                    "execution_status": "running",
                    "pending_tool_call": None,
                    "pending_tool_decision": None,
                    "error": None
                }
            else:
                # Tool failed
                return {
                    "execution_status": "failed",
                    "error": result.get("error", "Tool execution failed"),
                    "pending_tool_call": None,
                    "pending_tool_decision": None
                }
        
        except Exception as e:
            return {
                "execution_status": "failed",
                "error": f"Tool execution error: {str(e)}"
            }
    
    def _save_paused_state(self, state: RuntimeState) -> None:
        session_id = state["session_id"]

        # Serialize messages with LangChain helpers to preserve tool metadata
        messages_data = messages_to_dict(state["messages"])

        state_snapshot = {
            "messages": messages_data,
            "pending_tool_call": state.get("pending_tool_call"),
            "pending_tool_decision": state.get("pending_tool_decision"),
            "execution_status": state.get("execution_status"),
            "error": state.get("error")
        }

        self.last_state_snapshot = state_snapshot
        
        # Save to database
        with Session(engine) as session:
            stmt = select(models.Session).where(models.Session.session_id == session_id)
            session_record = session.exec(stmt).first()
            if session_record:
                session_record.state_snapshot = json.dumps(state_snapshot)
                session_record.updated_at = datetime.now(timezone.utc)
                session.add(session_record)
                session.commit()
    
    def resume_session(self, session_id: str) -> Dict:
        # 1. Verify session exists and is approved
        stmt = select(models.Session).where(models.Session.session_id == session_id)
        session_record = self.db_session.exec(stmt).first()
        
        if not session_record:
            raise ValueError(f"Session {session_id} not found")
        
        if session_record.status != "paused":
            raise ValueError(f"Session {session_id} is not paused (status: {session_record.status})")
        
        # 2. Check approval status
        approval_stmt = select(models.Approval).where(models.Approval.session_id == session_id)
        approval = self.db_session.exec(approval_stmt).first()
        
        if not approval:
            raise ValueError(f"No approval found for session {session_id}")
        
        if approval.status != "approved":
            raise ValueError(f"Session {session_id} is not approved (approval status: {approval.status})")
        
        # 3. Restore the paused state snapshot.
        tool_adapter, interception_hook = self._build_runtime_components(session_id)

        if not session_record.state_snapshot:
            raise ValueError(f"No checkpoint or snapshot found for session {session_id}")

        state_data = json.loads(session_record.state_snapshot)
        messages = messages_from_dict(state_data["messages"])
        current_state = {
            "session_id": session_id,
            "agent_id": session_record.agent_id,
            "messages": messages,
            "pending_tool_call": state_data.get("pending_tool_call"),
            "pending_tool_decision": state_data.get("pending_tool_decision"),
            "execution_status": state_data.get("execution_status", "paused"),
            "final_output": None,
            "error": state_data.get("error")
        }

        pending_tool_call = current_state.get("pending_tool_call")
        if not pending_tool_call:
            raise ValueError(f"No pending tool call found for session {session_id}")

        # 4. Execute the approved tool (bypass interception this time)
        tool_name = pending_tool_call.get("name", "unknown")
        tool_params = pending_tool_call.get("args", {})
        
        try:
            # Execute tool without interception (already approved)
            start_time = time.time()
            result = tool_adapter.execute_tool(tool_name, tool_params)
            duration = (time.time() - start_time) * 1000
            
            # Log tool result
            self.logger.log_tool_result(
                session_id=session_id,
                agent_id=self.agent_def.agent_id,
                tool_name=tool_name,
                result=result,
                duration_ms=duration,
                success=True
            )
            
            # Add the approved tool result and continue with one final model response.
            messages = list(current_state["messages"])
            messages.append(
                ToolMessage(
                    content=self._serialize_tool_payload(result),
                    tool_call_id=pending_tool_call.get("id", "unknown")
                )
            )

            resumed_state: RuntimeState = {
                **current_state,
                "messages": messages,
                "pending_tool_call": None,
                "pending_tool_decision": None,
                "execution_status": "running",
                "final_output": None,
                "error": None
            }

            self.last_state_snapshot = None
            final_state = self._run_simple_turn(resumed_state, tool_adapter, interception_hook)
            status = final_state.get("execution_status", "failed")
            if status == "paused":
                self._save_paused_state(final_state)
                session_record.status = "paused"
                session_record.updated_at = datetime.now(timezone.utc)
                self.db_session.add(session_record)
                self.db_session.commit()
                self.logger.log_session_end(
                    session_id=session_id,
                    agent_id=self.agent_def.agent_id,
                    status="paused",
                    final_output=None,
                    error=final_state.get("error")
                )
                return {
                    "session_id": session_id,
                    "status": "paused",
                    "final_output": None,
                    "error": final_state.get("error")
                }

            # Update session status
            session_record.status = status
            session_record.state_snapshot = None
            session_record.updated_at = datetime.now(timezone.utc)
            self.db_session.add(session_record)
            self.db_session.commit()

            # Log session end
            self.logger.log_session_end(
                session_id=session_id,
                agent_id=self.agent_def.agent_id,
                status=status,
                final_output=final_state.get("final_output"),
                error=final_state.get("error")
            )

            return {
                "session_id": session_id,
                "status": status,
                "final_output": final_state.get("final_output"),
                "error": final_state.get("error")
            }
        
        except Exception as e:
            # Log failure
            self.logger.log_session_end(
                session_id=session_id,
                agent_id=self.agent_def.agent_id,
                status="failed",
                error=str(e)
            )
            
            # Update session status
            session_record.status = "failed"
            session_record.updated_at = datetime.now(timezone.utc)
            self.db_session.add(session_record)
            self.db_session.commit()
            
            return {
                "session_id": session_id,
                "status": "failed",
                "final_output": None,
                "error": str(e)
            }
