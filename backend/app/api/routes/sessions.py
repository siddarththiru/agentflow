import json
from datetime import datetime
from typing import Any, List

from fastapi import APIRouter, Depends, HTTPException, status
from langchain_core.messages import AIMessage, HumanMessage
from sqlmodel import Session, select

from app.database import get_session
from app import models
from app import schemas
from app.agents.runtime import AgentRuntime
from app.config import get_agent_chat_model

router = APIRouter(prefix="/sessions", tags=["sessions"])


def _get_session_or_404(session_id: str, db: Session) -> models.Session:
    """Helper to fetch a session by session_id or raise 404."""
    session_record = db.exec(
        select(models.Session).where(models.Session.session_id == session_id)
    ).first()
    if not session_record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found"
        )
    return session_record


def _get_agent_or_404(agent_id: int, db: Session) -> models.Agent:
    agent = db.get(models.Agent, agent_id)
    if not agent:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Agent not found"
        )
    return agent


def _list_agent_tools(agent_id: int, db: Session) -> List[models.Tool]:
    return db.exec(
        select(models.Tool)
        .join(models.AgentTool, models.AgentTool.tool_id == models.Tool.id)
        .where(models.AgentTool.agent_id == agent_id)
    ).all()


def _coerce_message_content(content: Any) -> str:
    if isinstance(content, str):
        return content

    if isinstance(content, list):
        text_parts: List[str] = []
        for item in content:
            if isinstance(item, str):
                text_parts.append(item)
                continue
            if isinstance(item, dict):
                text = item.get("text")
                if isinstance(text, str):
                    text_parts.append(text)
        joined = "\n".join(part for part in text_parts if part.strip())
        if joined.strip():
            return joined

    if content is None:
        return ""

    return str(content)


def _build_conversation_messages(
    session_id: str,
    db: Session
) -> List[HumanMessage | AIMessage]:
    stored_messages = db.exec(
        select(models.ChatMessage)
        .where(models.ChatMessage.session_id == session_id)
        .order_by(models.ChatMessage.created_at.asc(), models.ChatMessage.id.asc())
    ).all()

    messages: List[HumanMessage | AIMessage] = []

    for stored_message in stored_messages:
        if stored_message.role == "assistant":
            messages.append(AIMessage(content=stored_message.content))
        else:
            messages.append(HumanMessage(content=stored_message.content))

    return messages


def _get_session_agent_definition(agent: models.Agent, db: Session) -> schemas.AgentDefinition:
    policy = db.exec(select(models.Policy).where(models.Policy.agent_id == agent.id)).first()
    tools = _list_agent_tools(agent.id, db)

    tools_payload = []
    for tool in tools:
        try:
            input_schema = json.loads(tool.input_schema)
            output_schema = json.loads(tool.output_schema)
        except json.JSONDecodeError as exc:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Invalid tool schema for '{tool.name}': {str(exc)}"
            ) from exc

        tools_payload.append(
            schemas.AgentDefinitionTool(
                id=tool.id,
                name=tool.name,
                description=tool.description,
                input_schema=input_schema,
                output_schema=output_schema,
            )
        )

    return schemas.AgentDefinition(
        agent_id=agent.id,
        name=agent.name,
        description=agent.description,
        purpose=agent.purpose,
        model=agent.model,
        tools=tools_payload,
        policy=schemas.AgentDefinitionPolicy(
            allowed_tool_ids=[tool.id for tool in tools],
            frequency_limit=policy.frequency_limit if policy else None,
            require_approval_for_all_tool_calls=(
                policy.require_approval_for_all_tool_calls if policy else False
            ),
        ),
    )


@router.get("/{session_id}/messages", response_model=List[schemas.ChatMessageRead])
def list_session_messages(
    session_id: str,
    db: Session = Depends(get_session)
) -> List[schemas.ChatMessageRead]:
    """List all messages for a session in chronological order."""
    _get_session_or_404(session_id, db)
    
    messages = db.exec(
        select(models.ChatMessage)
        .where(models.ChatMessage.session_id == session_id)
        .order_by(models.ChatMessage.created_at.asc(), models.ChatMessage.id.asc())
    ).all()
    
    return [
        schemas.ChatMessageRead(
            id=msg.id,
            session_id=msg.session_id,
            role=msg.role,
            content=msg.content,
            metadata=msg.message_metadata,
            created_at=msg.created_at,
        )
        for msg in messages
    ]


@router.post("/{session_id}/messages", response_model=schemas.ChatMessageRead)
def add_message(
    session_id: str,
    message_in: schemas.ChatMessageCreate,
    role: str = "user",
    db: Session = Depends(get_session)
) -> schemas.ChatMessageRead:
    """Persist a session message and generate an assistant reply for user turns."""
    session_record = _get_session_or_404(session_id, db)
    agent = _get_agent_or_404(session_record.agent_id, db)

    if role == "user" and session_record.status == "paused":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Session is paused awaiting approval. Resume the session before sending another user message."
        )
    
    msg = models.ChatMessage(
        session_id=session_id,
        role=role,
        content=message_in.content,
        metadata=message_in.metadata,
    )
    
    db.add(msg)
    session_record.updated_at = datetime.utcnow()
    db.add(session_record)
    db.commit()
    db.refresh(msg)
    db.refresh(session_record)

    if role != "user":
        return schemas.ChatMessageRead(
            id=msg.id,
            session_id=msg.session_id,
            role=msg.role,
            content=msg.content,
            metadata=msg.message_metadata,
            created_at=msg.created_at,
        )

    assistant_content: str
    assistant_metadata: str | None = None

    try:
        agent_definition = _get_session_agent_definition(agent, db)
        chat_model = get_agent_chat_model(agent)
        runtime = AgentRuntime(
            agent_definition=agent_definition,
            chat_model=chat_model,
            db_session=db,
        )
        result = runtime.run_chat_turn(session_id, _build_conversation_messages(session_id, db))
        session_record.status = result["status"]
        session_record.state_snapshot = (
            json.dumps(runtime.last_state_snapshot) if runtime.last_state_snapshot else None
        )

        if result["status"] == "completed":
            assistant_content = _coerce_message_content(result.get("final_output"))
            if not assistant_content.strip():
                assistant_content = "I couldn't generate a response for that message."
        elif result["status"] == "paused":
            assistant_content = "The request is waiting for approval before I can continue."
            assistant_metadata = json.dumps({"status": "paused", "error": result.get("error")})
        else:
            assistant_content = "I couldn't complete that request."
            assistant_metadata = json.dumps({"status": result["status"], "error": result.get("error")})
    except Exception as exc:
        assistant_content = "I couldn't respond right now because the configured model is unavailable."
        assistant_metadata = json.dumps({"error": str(exc)})
        session_record.status = "failed"

    assistant_msg = models.ChatMessage(
        session_id=session_id,
        role="assistant",
        content=assistant_content,
        metadata=assistant_metadata,
    )
    db.add(assistant_msg)
    session_record.updated_at = datetime.utcnow()
    db.add(session_record)
    db.commit()
    db.refresh(assistant_msg)

    return schemas.ChatMessageRead(
        id=assistant_msg.id,
        session_id=assistant_msg.session_id,
        role=assistant_msg.role,
        content=assistant_msg.content,
        metadata=assistant_msg.message_metadata,
        created_at=assistant_msg.created_at,
    )


@router.patch("/{session_id}", response_model=schemas.SessionRead)
def update_session(
    session_id: str,
    session_update: schemas.SessionUpdate,
    db: Session = Depends(get_session)
) -> schemas.SessionRead:
    """Update session properties like title."""
    session_record = _get_session_or_404(session_id, db)
    
    if session_update.title is not None:
        session_record.title = session_update.title
    
    session_record.updated_at = datetime.utcnow()
    db.add(session_record)
    db.commit()
    db.refresh(session_record)
    
    return schemas.SessionRead.from_orm(session_record)


@router.get("/{session_id}", response_model=schemas.SessionDetailRead)
def get_session_detail(
    session_id: str,
    db: Session = Depends(get_session)
) -> schemas.SessionDetailRead:
    """Get a session with all its messages."""
    session_record = _get_session_or_404(session_id, db)
    
    messages = db.exec(
        select(models.ChatMessage)
        .where(models.ChatMessage.session_id == session_id)
        .order_by(models.ChatMessage.created_at.asc(), models.ChatMessage.id.asc())
    ).all()
    
    return schemas.SessionDetailRead(
        session_id=session_record.session_id,
        agent_id=session_record.agent_id,
        title=session_record.title,
        status=session_record.status,
        created_at=session_record.created_at,
        updated_at=session_record.updated_at,
        messages=[
            schemas.ChatMessageRead(
                id=msg.id,
                session_id=msg.session_id,
                role=msg.role,
                content=msg.content,
                metadata=msg.message_metadata,
                created_at=msg.created_at,
            )
            for msg in messages
        ],
    )
