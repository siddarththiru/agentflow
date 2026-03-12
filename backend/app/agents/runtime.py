import uuid
import json
import time
from datetime import datetime, timezone
from typing import Dict

from langchain_core.language_models.chat_models import BaseChatModel
from langchain_core.messages import (
    AIMessage,
    HumanMessage,
    SystemMessage,
    ToolMessage,
    messages_to_dict,
    messages_from_dict
)
from langgraph.checkpoint import MemorySaver
from langgraph.graph import END, StateGraph
from sqlmodel import Session, select

from app.agents.event_logger import EventLogger
from app.agents.interception import InterceptionHook, InterceptionDecision
from app.agents.runtime_state import RuntimeState
from app.agents.tool_adapter import ToolAdapter
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
        self.chat_model = chat_model
        self.db_session = db_session
        self.logger = EventLogger(db_session)
        
        self.tools_dict: Dict[str, AgentDefinitionTool] = {
            tool.name: tool for tool in agent_definition.tools
        }
        
        self.system_prompt = self._build_system_prompt()
        # Placeholder for PostgresSaver when DB-backed checkpoints are ready.
        self.checkpointer = MemorySaver()
    
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
        prompt_parts.append("- Use tools when needed to answer questions")
        prompt_parts.append("- Provide clear, concise answers")
        prompt_parts.append("- If you cannot answer, explain why")
        
        return "\n".join(prompt_parts)
    
    def execute(self, user_input: str) -> Dict:
        # Generate session ID
        session_id = str(uuid.uuid4())
        
        # Log session start
        self.logger.log_session_start(
            session_id=session_id,
            agent_id=self.agent_def.agent_id,
            user_input=user_input
        )
        
        # Initialize runtime components
        tool_adapter = ToolAdapter(self.tools_dict)
        interception_hook = InterceptionHook(
            session_id=session_id,
            agent_id=self.agent_def.agent_id,
            logger=self.logger,
            db_session=self.db_session,
            allowed_tool_ids=[tool.id for tool in self.agent_def.tools],
            frequency_limit=self.agent_def.policy.frequency_limit,
            require_approval_for_all=self.agent_def.policy.require_approval_for_all_tool_calls
        )
        
        # Build and execute graph
        graph = self._build_graph(tool_adapter, interception_hook)
        
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
        
        config = {"configurable": {"thread_id": session_id}}
        
        try:
            # Execute graph (will interrupt before tool execution due to interrupt_before=["invoke_tool"])
            final_state = graph.invoke(initial_state, config)

            # Check if execution was paused at the interrupt point
            graph_state = graph.get_state(config)
            if graph_state.next:  # Non-empty next means paused at interrupt_before
                self._save_paused_state(final_state)
                final_state["execution_status"] = "paused"
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
                status=final_state["execution_status"],
                final_output=final_state.get("final_output"),
                error=final_state.get("error")
            )
            
            return {
                "session_id": session_id,
                "status": final_state["execution_status"],
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
    
    def _build_graph(
        self,
        tool_adapter: ToolAdapter,
        interception_hook: InterceptionHook
    ) -> StateGraph:
        graph = StateGraph(RuntimeState)
        
        # Add nodes
        graph.add_node("reason", lambda state: self._reason_node(state))
        graph.add_node(
            "decide_action",
            lambda state: self._decide_action_node(state, interception_hook)
        )
        graph.add_node(
            "invoke_tool",
            lambda state: self._invoke_tool_node(state, tool_adapter, interception_hook)
        )
        
        # Define edges
        graph.set_entry_point("reason")
        graph.add_edge("reason", "decide_action")
        
        # Conditional routing from decide_action
        graph.add_conditional_edges(
            "decide_action",
            lambda state: self._route_decision(state),
            {
                "tool": "invoke_tool",
                "end": END
            }
        )
        
        # Tool execution loops back to reasoning
        graph.add_edge("invoke_tool", "reason")
        
        return graph.compile(
            checkpointer=self.checkpointer,
            interrupt_before=["invoke_tool"]
        )
    
    def _reason_node(self, state: RuntimeState) -> RuntimeState:
        self.logger.log_node_transition(
            session_id=state["session_id"],
            agent_id=state["agent_id"],
            from_node="previous",
            to_node="reason"
        )
        
        try:
            response = self.chat_model.invoke(state["messages"])
            messages = list(state["messages"])
            messages.append(response)
            
            return {**state, "messages": messages}
        
        except Exception as e:
            return {
                **state,
                "execution_status": "failed",
                "error": f"Reasoning error: {str(e)}"
            }
    
    def _decide_action_node(
        self,
        state: RuntimeState,
        interception_hook: InterceptionHook
    ) -> RuntimeState:
        self.logger.log_node_transition(
            session_id=state["session_id"],
            agent_id=state["agent_id"],
            from_node="reason",
            to_node="decide_action"
        )
        
        messages = state["messages"]
        if not messages:
            return {**state, "execution_status": "failed", "error": "No messages"}
        
        last_message = messages[-1]
        
        # Check if LLM wants to call a tool
        if isinstance(last_message, AIMessage) and hasattr(last_message, "tool_calls"):
            tool_calls = getattr(last_message, "tool_calls", [])
            if tool_calls:
                pending_call = tool_calls[0]
                tool_name = pending_call.get("name", "unknown")
                tool_def = self.tools_dict.get(tool_name)
                if not tool_def:
                    return {
                        **state,
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
                        **state,
                        "execution_status": "terminated",
                        "error": f"Tool execution blocked: {decision.reason}",
                        "pending_tool_call": None,
                        "pending_tool_decision": "block"
                    }

                if decision.decision == "pause":
                    return {
                        **state,
                        "execution_status": "paused",
                        "error": f"Tool execution paused: {decision.reason}",
                        "pending_tool_call": pending_call,
                        "pending_tool_decision": "pause"
                    }

                # Allowed tool call; continue to invocation
                return {
                    **state,
                    "pending_tool_call": pending_call,
                    "pending_tool_decision": "allow"
                }
        
        # No tool call - extract final answer
        if isinstance(last_message, AIMessage):
            content = getattr(last_message, "content", "")
            return {
                **state,
                "execution_status": "completed",
                "final_output": content
            }
        
        return {**state, "execution_status": "completed", "final_output": "No response"}
    
    def _invoke_tool_node(
        self,
        state: RuntimeState,
        tool_adapter: ToolAdapter,
        interception_hook: InterceptionHook
    ) -> RuntimeState:
        self.logger.log_node_transition(
            session_id=state["session_id"],
            agent_id=state["agent_id"],
            from_node="decide_action",
            to_node="invoke_tool"
        )
        
        pending_call = state.get("pending_tool_call")
        if not pending_call:
            return {
                **state,
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
                duration_ms=result.get("duration_ms", 0)
            )
            
            # Check if execution was blocked
            if result.get("blocked"):
                return {
                    **state,
                    "execution_status": "terminated",
                    "error": result.get("error", "Tool execution was blocked by policy"),
                    "pending_tool_call": None,
                    "pending_tool_decision": None
                }
            
            # Check if execution was paused (approval required)
            if result.get("paused"):
                # Save state snapshot for resume
                self._save_paused_state(state)
                return {
                    **state,
                    "execution_status": "paused",
                    "error": result.get("error", "Tool execution paused - awaiting approval"),
                    "pending_tool_call": pending_call,  # Keep pending call for resume
                    "pending_tool_decision": tool_decision
                }
            
            # Successful execution - append tool result to messages
            if result.get("success"):
                messages = list(state["messages"])
                messages.append(
                    ToolMessage(
                        content=str(result),
                        tool_call_id=pending_call.get("id", "unknown")
                    )
                )
                
                return {
                    **state,
                    "messages": messages,
                    "pending_tool_call": None,
                    "pending_tool_decision": None
                }
            else:
                # Tool failed
                return {
                    **state,
                    "execution_status": "failed",
                    "error": result.get("error", "Tool execution failed"),
                    "pending_tool_call": None,
                    "pending_tool_decision": None
                }
        
        except Exception as e:
            return {
                **state,
                "execution_status": "failed",
                "error": f"Tool execution error: {str(e)}"
            }
    
    def _route_decision(self, state: RuntimeState) -> str:
        if state.get("pending_tool_call"):
            return "tool"
        return "end"
    
    def _save_paused_state(self, state: RuntimeState) -> None:
        session_id = state["session_id"]

        # Serialize messages with LangChain helpers to preserve tool metadata
        messages_data = messages_to_dict(state["messages"])

        state_snapshot = {
            "messages": messages_data,
            "pending_tool_call": state.get("pending_tool_call"),
            "pending_tool_decision": state.get("pending_tool_decision"),
            "execution_status": state.get("execution_status")
        }
        
        # Save to database
        stmt = select(models.Session).where(models.Session.session_id == session_id)
        session_record = self.db_session.exec(stmt).first()
        if session_record:
            session_record.state_snapshot = json.dumps(state_snapshot)
            session_record.updated_at = datetime.now(timezone.utc)
            self.db_session.add(session_record)
            self.db_session.commit()
    
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
        
        # 3. Restore state from checkpoints (fallback to snapshot if needed)
        tool_adapter = ToolAdapter(self.tools_dict)
        interception_hook = InterceptionHook(
            session_id=session_id,
            agent_id=self.agent_def.agent_id,
            logger=self.logger,
            db_session=self.db_session,
            allowed_tool_ids=[tool.id for tool in self.agent_def.tools],
            frequency_limit=self.agent_def.policy.frequency_limit,
            require_approval_for_all=self.agent_def.policy.require_approval_for_all_tool_calls
        )
        graph = self._build_graph(tool_adapter, interception_hook)
        config = {"configurable": {"thread_id": session_id}}

        graph_state = graph.get_state(config)
        current_state = graph_state.values if graph_state else None

        if not current_state:
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
            graph.update_state(config, current_state)

        pending_tool_call = current_state.get("pending_tool_call")
        if not pending_tool_call:
            raise ValueError(f"No pending tool call found for session {session_id}")

        # 4. Execute the approved tool (bypass interception this time)
        tool_name = pending_tool_call.get("name", "unknown")
        tool_params = pending_tool_call.get("args", {})
        
        try:
            # Execute tool without interception (already approved)
            start_time = time.time()
            result = tool_adapter._execute_tool_stub(tool_name, tool_params)
            duration = (time.time() - start_time) * 1000
            
            tool_result = {
                "success": True,
                "tool": tool_name,
                "result": result,
                "duration_ms": duration
            }
            
            # Log tool result
            self.logger.log_tool_result(
                session_id=session_id,
                agent_id=self.agent_def.agent_id,
                tool_name=tool_name,
                result=result,
                duration_ms=duration
            )
            
            # Add tool result to messages and update state at the invoke_tool node
            # Use messages_from_dict to preserve tool_call_id and additional_kwargs
            messages = list(current_state["messages"])
            messages.append(
                ToolMessage(
                    content=str(tool_result),
                    tool_call_id=pending_tool_call.get("id", "unknown")
                )
            )

            # Inject ToolMessage result and clear pending state in single update
            graph.update_state(
                config,
                {
                    "messages": messages,
                    "pending_tool_call": None,
                    "pending_tool_decision": None,
                    "execution_status": "running",
                    "error": None
                },
                as_node="invoke_tool"
            )

            # Continue graph execution after tool result injection
            final_state = graph.invoke(None, config)

            # Check if another pause was triggered
            graph_state = graph.get_state(config)
            if graph_state.next:  # Non-empty next means paused at interrupt_before
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
            session_record.status = final_state["execution_status"]
            session_record.updated_at = datetime.now(timezone.utc)
            self.db_session.add(session_record)
            self.db_session.commit()

            # Log session end
            self.logger.log_session_end(
                session_id=session_id,
                agent_id=self.agent_def.agent_id,
                status=final_state["execution_status"],
                final_output=final_state.get("final_output"),
                error=final_state.get("error")
            )

            return {
                "session_id": session_id,
                "status": final_state["execution_status"],
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
