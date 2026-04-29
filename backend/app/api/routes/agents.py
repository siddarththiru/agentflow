import json
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select

from app.database import get_session
from app import models
from app import schemas
from app.agents.qa_graph import build_qa_graph
from app.agents.runtime import AgentRuntime
from app.config import get_agent_chat_model, get_guard_chat_model
from langchain_core.messages import AIMessage, HumanMessage

router = APIRouter(prefix="/agents", tags=["agents"])


def _safe_json_load(value: str) -> Dict[str, Any]:
    try:
        parsed = json.loads(value)
        return parsed if isinstance(parsed, dict) else {}
    except (json.JSONDecodeError, TypeError):
        return {}


def _compute_health_status(
    latest_session_status: Optional[str],
    pending_approvals: int,
) -> str:
    session_status = (latest_session_status or "").lower()

    if session_status in {"failed", "terminated"}:
        return "risk"
    if pending_approvals > 0 or session_status == "paused":
        return "attention"
    return "healthy"

def _get_agent_or_404(agent_id: int, session: Session) -> models.Agent:
    agent = session.get(models.Agent, agent_id)
    if not agent:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Agent not found")
    return agent


def _persist_resume_assistant_reply(
    session_id: str,
    result: Dict[str, Any],
    session: Session,
) -> None:
    if result.get("status") != "completed":
        return

    final_output = result.get("final_output")
    if not isinstance(final_output, str) or not final_output.strip():
        return

    # Only persist resume output for chat-backed sessions that already have history.
    has_chat_history = session.exec(
        select(models.ChatMessage.id)
        .where(models.ChatMessage.session_id == session_id)
        .limit(1)
    ).first()
    if has_chat_history is None:
        return

    latest_message = session.exec(
        select(models.ChatMessage)
        .where(models.ChatMessage.session_id == session_id)
        .order_by(models.ChatMessage.created_at.desc(), models.ChatMessage.id.desc())
    ).first()
    if (
        latest_message
        and latest_message.role == "assistant"
        and latest_message.content == final_output
    ):
        return

    assistant_msg = models.ChatMessage(
        session_id=session_id,
        role="assistant",
        content=final_output,
        metadata=None,
    )
    session.add(assistant_msg)
    session.commit()


def _get_policy_for_guard(agent_id: int, session: Session) -> Optional[models.Policy]:
    return session.exec(select(models.Policy).where(models.Policy.agent_id == agent_id)).first()


@router.get("", response_model=List[schemas.AgentSummaryRead])
def list_agents(session: Session = Depends(get_session)) -> List[schemas.AgentSummaryRead]:
    agents = session.exec(select(models.Agent)).all()
    if not agents:
        return []

    agent_ids = [agent.id for agent in agents if agent.id is not None]
    if not agent_ids:
        return []

    sessions = session.exec(
        select(models.Session).where(models.Session.agent_id.in_(agent_ids))
    ).all()
    policies = session.exec(
        select(models.Policy).where(models.Policy.agent_id.in_(agent_ids))
    ).all()
    agent_tools = session.exec(
        select(models.AgentTool).where(models.AgentTool.agent_id.in_(agent_ids))
    ).all()
    pending_approvals = session.exec(
        select(models.Approval).where(
            models.Approval.agent_id.in_(agent_ids),
            models.Approval.status == "pending",
        )
    ).all()

    sessions_by_agent: Dict[int, List[models.Session]] = {}
    for session_record in sessions:
        sessions_by_agent.setdefault(session_record.agent_id, []).append(session_record)

    policy_by_agent = {policy.agent_id: policy for policy in policies}

    tools_count_by_agent: Dict[int, int] = {}
    for link in agent_tools:
        tools_count_by_agent[link.agent_id] = tools_count_by_agent.get(link.agent_id, 0) + 1

    pending_by_agent: Dict[int, int] = {}
    for approval in pending_approvals:
        pending_by_agent[approval.agent_id] = pending_by_agent.get(approval.agent_id, 0) + 1

    summaries: List[schemas.AgentSummaryRead] = []
    for agent in sorted(agents, key=lambda item: item.updated_at, reverse=True):
        agent_id = int(agent.id)
        agent_sessions = sessions_by_agent.get(agent_id, [])
        latest_session = max(agent_sessions, key=lambda item: item.updated_at) if agent_sessions else None
        latest_status = latest_session.status if latest_session else None
        pending_count = pending_by_agent.get(agent_id, 0)
        policy = policy_by_agent.get(agent_id)

        summaries.append(
            schemas.AgentSummaryRead(
                id=agent_id,
                name=agent.name,
                description=agent.description,
                model=agent.model,
                created_at=agent.created_at,
                updated_at=agent.updated_at,
                sessions_count=len(agent_sessions),
                tools_count=tools_count_by_agent.get(agent_id, 0),
                pending_approvals=pending_count,
                latest_session_status=latest_status,
                policy=(
                    schemas.AgentPolicySummary(
                        frequency_limit=policy.frequency_limit,
                        require_approval_for_all_tool_calls=policy.require_approval_for_all_tool_calls,
                        intent_guard_enabled=policy.intent_guard_enabled,
                        intent_guard_action_medium=policy.intent_guard_action_medium,
                        intent_guard_action_high=policy.intent_guard_action_high,
                        intent_guard_action_critical=policy.intent_guard_action_critical,
                    )
                    if policy
                    else None
                ),
            )
        )

    return summaries

@router.post("", response_model=schemas.AgentRead, status_code=status.HTTP_201_CREATED)
def create_agent(agent_in: schemas.AgentCreate, session: Session = Depends(get_session)) -> schemas.AgentRead:
    existing = session.exec(select(models.Agent).where(models.Agent.name == agent_in.name)).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Agent name must be unique")

    agent = models.Agent(**agent_in.dict())
    session.add(agent)
    session.commit()
    session.refresh(agent)
    return agent

@router.get("/{agent_id}", response_model=schemas.AgentRead)
def get_agent(agent_id: int, session: Session = Depends(get_session)) -> schemas.AgentRead:
    agent = _get_agent_or_404(agent_id, session)
    return agent


@router.get("/{agent_id}/sessions", response_model=List[schemas.SessionSummaryRead])
def list_agent_sessions(
    agent_id: int,
    session: Session = Depends(get_session)
) -> List[schemas.SessionSummaryRead]:
    """List all sessions for an agent, sorted by most recent."""
    _get_agent_or_404(agent_id, session)
    
    sessions_list = session.exec(
        select(models.Session)
        .where(models.Session.agent_id == agent_id)
        .order_by(models.Session.updated_at.desc())
    ).all()
    
    return [
        schemas.SessionSummaryRead(
            session_id=s.session_id,
            agent_id=s.agent_id,
            title=s.title,
            status=s.status,
            created_at=s.created_at,
            updated_at=s.updated_at,
        )
        for s in sessions_list
    ]


@router.post("/{agent_id}/sessions", response_model=schemas.SessionSummaryRead, status_code=status.HTTP_201_CREATED)
def create_agent_session(
    agent_id: int,
    session: Session = Depends(get_session)
) -> schemas.SessionSummaryRead:
    """Create a new empty chat session for an agent."""
    _get_agent_or_404(agent_id, session)
    
    import uuid
    session_id = str(uuid.uuid4())
    
    new_session = models.Session(
        session_id=session_id,
        agent_id=agent_id,
        status="running",
        user_input="",  # Empty for new chat sessions
        title=None,  # Will be auto-generated from first message
    )
    
    session.add(new_session)
    session.commit()
    session.refresh(new_session)
    
    return schemas.SessionSummaryRead(
        session_id=new_session.session_id,
        agent_id=new_session.agent_id,
        title=new_session.title,
        status=new_session.status,
        created_at=new_session.created_at,
        updated_at=new_session.updated_at,
    )


@router.get("/{agent_id}/profile", response_model=schemas.AgentProfileRead)
def get_agent_profile(agent_id: int, session: Session = Depends(get_session)) -> schemas.AgentProfileRead:
    agent = _get_agent_or_404(agent_id, session)

    policy = session.exec(select(models.Policy).where(models.Policy.agent_id == agent_id)).first()
    tools = session.exec(
        select(models.Tool)
        .join(models.AgentTool)
        .where(models.AgentTool.agent_id == agent_id)
    ).all()
    sessions = session.exec(
        select(models.Session).where(models.Session.agent_id == agent_id)
    ).all()
    approvals = session.exec(
        select(models.Approval)
        .where(models.Approval.agent_id == agent_id)
        .order_by(models.Approval.requested_at.desc())
    ).all()

    sorted_sessions = sorted(sessions, key=lambda item: item.updated_at, reverse=True)
    recent_sessions = [
        schemas.AgentRecentSessionRead(
            session_id=session_record.session_id,
            status=session_record.status,
            created_at=session_record.created_at,
            updated_at=session_record.updated_at,
        )
        for session_record in sorted_sessions[:8]
    ]

    recent_approvals = [
        schemas.AgentRecentApprovalRead(
            id=int(approval.id),
            session_id=approval.session_id,
            tool_name=approval.tool_name,
            status=approval.status,
            requested_at=approval.requested_at,
            decided_at=approval.decided_at,
            decided_by=approval.decided_by,
            decision_reason=approval.decision_reason,
        )
        for approval in approvals[:8]
    ]

    pending_approvals = sum(1 for approval in approvals if approval.status == "pending")
    latest_session_status = sorted_sessions[0].status if sorted_sessions else None

    definition: Optional[schemas.AgentDefinition] = None
    if policy:
        definition = get_definition(agent_id, session)

    return schemas.AgentProfileRead(
        agent=schemas.AgentRead.from_orm(agent),
        policy=schemas.PolicyRead.from_orm(policy) if policy else None,
        tools=[schemas.ToolRead.from_orm(tool) for tool in tools],
        definition=definition,
        sessions_count=len(sessions),
        pending_approvals=pending_approvals,
        recent_sessions=recent_sessions,
        recent_approvals=recent_approvals,
    )

@router.patch("/{agent_id}", response_model=schemas.AgentRead)
def update_agent(
    agent_id: int,
    agent_update: schemas.AgentUpdate,
    session: Session = Depends(get_session),
) -> schemas.AgentRead:
    agent = _get_agent_or_404(agent_id, session)
    update_data = agent_update.dict(exclude_unset=True)

    if "name" in update_data:
        name_conflict = session.exec(
            select(models.Agent).where(models.Agent.name == update_data["name"], models.Agent.id != agent_id)
        ).first()
        if name_conflict:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Agent name must be unique")

    for field, value in update_data.items():
        setattr(agent, field, value)
    agent.updated_at = datetime.utcnow()

    session.add(agent)
    session.commit()
    session.refresh(agent)
    return agent


@router.delete("/{agent_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_agent(agent_id: int, session: Session = Depends(get_session)) -> None:
    _get_agent_or_404(agent_id, session)

    agent_sessions = session.exec(
        select(models.Session).where(models.Session.agent_id == agent_id)
    ).all()

    for session_record in agent_sessions:
        logs = session.exec(
            select(models.Log).where(models.Log.session_id == session_record.session_id)
        ).all()
        for log in logs:
            session.delete(log)

        messages = session.exec(
            select(models.ChatMessage).where(models.ChatMessage.session_id == session_record.session_id)
        ).all()
        for message in messages:
            session.delete(message)

        session.delete(session_record)

    approvals = session.exec(
        select(models.Approval).where(models.Approval.agent_id == agent_id)
    ).all()
    for approval in approvals:
        session.delete(approval)

    agent_logs = session.exec(
        select(models.Log).where(models.Log.agent_id == agent_id)
    ).all()
    for log in agent_logs:
        session.delete(log)

    policy = session.exec(
        select(models.Policy).where(models.Policy.agent_id == agent_id)
    ).first()
    if policy:
        session.delete(policy)

    links = session.exec(
        select(models.AgentTool).where(models.AgentTool.agent_id == agent_id)
    ).all()
    for link in links:
        session.delete(link)

    agent = session.get(models.Agent, agent_id)
    if agent:
        session.delete(agent)
    session.commit()

@router.post("/{agent_id}/tools", response_model=List[schemas.ToolRead])
def set_agent_tools(
    agent_id: int,
    tools_update: schemas.ToolsUpdate,
    session: Session = Depends(get_session),
) -> List[schemas.ToolRead]:
    agent = _get_agent_or_404(agent_id, session)
    tool_ids = list(set(tools_update.tool_ids))

    if tool_ids:
        tools = session.exec(select(models.Tool).where(models.Tool.id.in_(tool_ids))).all()
        found_ids = {tool.id for tool in tools}
        missing = set(tool_ids) - found_ids
        if missing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Tools not found: {sorted(list(missing))}",
            )
    else:
        tools = []

    existing_links = session.exec(select(models.AgentTool).where(models.AgentTool.agent_id == agent.id)).all()
    for link in existing_links:
        session.delete(link)

    for tool_id in tool_ids:
        session.add(models.AgentTool(agent_id=agent.id, tool_id=tool_id))

    agent.updated_at = datetime.utcnow()
    session.commit()

    return tools

@router.get("/{agent_id}/tools", response_model=List[schemas.ToolRead])
def list_agent_tools(agent_id: int, session: Session = Depends(get_session)) -> List[schemas.ToolRead]:
    _get_agent_or_404(agent_id, session)
    tools = session.exec(
        select(models.Tool)
        .join(models.AgentTool)
        .where(models.AgentTool.agent_id == agent_id)
    ).all()
    return tools

@router.post("/{agent_id}/policy", response_model=schemas.PolicyRead)
def set_policy(
    agent_id: int,
    policy_in: schemas.PolicyCreate,
    session: Session = Depends(get_session),
) -> schemas.PolicyRead:
    agent = _get_agent_or_404(agent_id, session)

    selected_tools = session.exec(
        select(models.Tool.id)
        .join(models.AgentTool)
        .where(models.AgentTool.agent_id == agent.id)
    ).all()
    selected_tool_ids = list(selected_tools)

    policy = session.exec(select(models.Policy).where(models.Policy.agent_id == agent.id)).first()
    if not policy:
        policy = models.Policy(agent_id=agent.id)

    if policy_in.frequency_limit is not None:
        if policy_in.frequency_limit <= 0:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="frequency_limit must be positive")
        policy.frequency_limit = policy_in.frequency_limit
    else:
        policy.frequency_limit = None

    policy.require_approval_for_all_tool_calls = policy_in.require_approval_for_all_tool_calls
    policy.intent_guard_enabled = policy_in.intent_guard_enabled
    policy.intent_guard_model_mode = policy_in.intent_guard_model_mode
    policy.intent_guard_model = policy_in.intent_guard_model
    policy.intent_guard_include_conversation = policy_in.intent_guard_include_conversation
    policy.intent_guard_include_tool_args = policy_in.intent_guard_include_tool_args
    policy.intent_guard_risk_tolerance = policy_in.intent_guard_risk_tolerance
    policy.intent_guard_action_low = policy_in.intent_guard_action_low
    policy.intent_guard_action_medium = policy_in.intent_guard_action_medium
    policy.intent_guard_action_high = policy_in.intent_guard_action_high
    policy.intent_guard_action_critical = policy_in.intent_guard_action_critical

    agent.updated_at = datetime.utcnow()
    session.add(policy)
    session.commit()
    session.refresh(policy)
    return policy

@router.get("/{agent_id}/policy", response_model=schemas.PolicyRead)
def get_policy(agent_id: int, session: Session = Depends(get_session)) -> schemas.PolicyRead:
    _get_agent_or_404(agent_id, session)
    policy = session.exec(select(models.Policy).where(models.Policy.agent_id == agent_id)).first()
    if not policy:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Policy not found")
    return policy


@router.get("/{agent_id}/definition", response_model=schemas.AgentDefinition)
def get_definition(agent_id: int, session: Session = Depends(get_session)) -> schemas.AgentDefinition:
    agent = _get_agent_or_404(agent_id, session)
    policy = session.exec(select(models.Policy).where(models.Policy.agent_id == agent.id)).first()
    if not policy:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Policy not configured for agent")

    tools = session.exec(
        select(models.Tool).join(models.AgentTool, models.AgentTool.tool_id == models.Tool.id).where(
            models.AgentTool.agent_id == agent.id
        )
    ).all()

    tools_payload = []
    for tool in tools:
        try:
            input_schema = json.loads(tool.input_schema)
        except json.JSONDecodeError:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Invalid tool input_schema JSON")
        try:
            output_schema = json.loads(tool.output_schema)
        except json.JSONDecodeError:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Invalid tool output_schema JSON")

        tools_payload.append(
            schemas.AgentDefinitionTool(
                id=tool.id,
                name=tool.name,
                description=tool.description,
                input_schema=input_schema,
                output_schema=output_schema,
            )
        )

    policy_payload = schemas.AgentDefinitionPolicy(
        allowed_tool_ids=[tool.id for tool in tools],
        frequency_limit=policy.frequency_limit,
        require_approval_for_all_tool_calls=policy.require_approval_for_all_tool_calls,
        intent_guard_enabled=policy.intent_guard_enabled,
        intent_guard_model_mode=policy.intent_guard_model_mode,
        intent_guard_model=policy.intent_guard_model,
        intent_guard_include_conversation=policy.intent_guard_include_conversation,
        intent_guard_include_tool_args=policy.intent_guard_include_tool_args,
        intent_guard_risk_tolerance=policy.intent_guard_risk_tolerance,
        intent_guard_action_low=policy.intent_guard_action_low,
        intent_guard_action_medium=policy.intent_guard_action_medium,
        intent_guard_action_high=policy.intent_guard_action_high,
        intent_guard_action_critical=policy.intent_guard_action_critical,
    )

    return schemas.AgentDefinition(
        agent_id=agent.id,
        name=agent.name,
        description=agent.description,
        purpose=agent.purpose,
        model=agent.model,
        tools=tools_payload,
        policy=policy_payload,
    )

@router.post("/{agent_id}/qa", response_model=schemas.AgentQAResponse)
def run_agent_qa(
    agent_id: int,
    request: schemas.AgentQARequest,
    session: Session = Depends(get_session),
) -> schemas.AgentQAResponse:
    agent = _get_agent_or_404(agent_id, session)

    try:
        chat_model = get_agent_chat_model(agent)
    except Exception as exc:  # keeping minimal handling for now
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    graph = build_qa_graph(chat_model)

    initial_state = {"messages": [HumanMessage(content=request.question)]}
    final_state = graph.invoke(initial_state)

    messages = final_state.get("messages", []) if isinstance(final_state, dict) else []
    assistant_messages = [m for m in messages if isinstance(m, AIMessage)]

    if not assistant_messages:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="No answer returned by model")

    answer_message = assistant_messages[-1]

    return schemas.AgentQAResponse(
        question=request.question,
        answer=getattr(answer_message, "content", ""),
        session_id=request.session_id,
    )


@router.post("/run-agent", response_model=schemas.RunAgentResponse)
def run_agent(
    request: schemas.RunAgentRequest,
    session: Session = Depends(get_session),
) -> schemas.RunAgentResponse:
    agent = _get_agent_or_404(request.agent_id, session)
    
    # Get complete agent definition
    try:
        definition_response = get_definition(request.agent_id, session)
        agent_definition = schemas.AgentDefinition(**definition_response.dict())
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to load agent definition: {str(e)}"
        )
    
    # Get chat model
    try:
        chat_model = get_agent_chat_model(agent)
        guard_model = get_guard_chat_model(agent, _get_policy_for_guard(request.agent_id, session))
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to initialize chat model: {str(exc)}"
        ) from exc
    
    # Initialize runtime
    runtime = AgentRuntime(
        agent_definition=agent_definition,
        chat_model=chat_model,
        db_session=session,
        guard_model=guard_model,
    )
    
    import uuid
    session_id = str(uuid.uuid4())
    session_record = models.Session(
        session_id=session_id,
        agent_id=request.agent_id,
        status="running",
        user_input=request.user_input
    )
    session.add(session_record)
    session.commit()

    # Execute agent
    result = runtime.execute(request.user_input, session_id=session_id)

    session_record = session.exec(
        select(models.Session).where(models.Session.session_id == session_id)
    ).first()
    if not session_record:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Session {session_id} disappeared during execution"
        )

    session_record.status = result["status"]
    session_record.updated_at = datetime.utcnow()
    session_record.state_snapshot = (
        json.dumps(runtime.last_state_snapshot)
        if result["status"] == "paused" and getattr(runtime, "last_state_snapshot", None)
        else None
    )
    session.add(session_record)
    session.commit()
    
    return schemas.RunAgentResponse(
        session_id=session_id,
        status=result["status"],
        final_output=result.get("final_output"),
        error=result.get("error")
    )


@router.post("/resume-agent/{session_id}", response_model=schemas.RunAgentResponse)
def resume_agent(
    session_id: str,
    session: Session = Depends(get_session),
) -> schemas.RunAgentResponse:
    # Get session record
    stmt = select(models.Session).where(models.Session.session_id == session_id)
    session_record = session.exec(stmt).first()
    
    if not session_record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Session {session_id} not found"
        )
    
    # Get agent
    agent = _get_agent_or_404(session_record.agent_id, session)
    
    # Get agent definition
    try:
        definition_response = get_definition(session_record.agent_id, session)
        agent_definition = schemas.AgentDefinition(**definition_response.dict())
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to load agent definition: {str(e)}"
        )
    
    # Get chat model
    try:
        chat_model = get_agent_chat_model(agent)
        guard_model = get_guard_chat_model(agent, _get_policy_for_guard(session_record.agent_id, session))
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to initialize chat model: {str(exc)}"
        ) from exc
    
    # Initialize runtime
    runtime = AgentRuntime(
        agent_definition=agent_definition,
        chat_model=chat_model,
        db_session=session,
        guard_model=guard_model,
    )
    
    # Resume session
    try:
        result = runtime.resume_session(session_id)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to resume session: {str(e)}"
        )

    _persist_resume_assistant_reply(session_id, result, session)
    
    return schemas.RunAgentResponse(
        session_id=result["session_id"],
        status=result["status"],
        final_output=result.get("final_output"),
        error=result.get("error")
    )
