from datetime import datetime
from typing import Optional, List

from sqlmodel import Field, Relationship, SQLModel, UniqueConstraint

class AgentTool(SQLModel, table=True):
    __tablename__ = "agent_tools"
    id: Optional[int] = Field(default=None, primary_key=True)
    agent_id: int = Field(foreign_key="agents.id")
    tool_id: int = Field(foreign_key="tools.id")
    # Link back to parent records; no cascade from AgentTool to Agent (only Agent → AgentTool)
    agent: "Agent" = Relationship(back_populates="tools")
    tool: "Tool" = Relationship(back_populates="agents")

class Agent(SQLModel, table=True):
    __tablename__ = "agents"
    __table_args__ = (UniqueConstraint("name", name="uq_agent_name"),)

    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(index=True)
    description: str
    purpose: str
    model: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    tools: List[AgentTool] = Relationship(back_populates="agent", sa_relationship_kwargs={"cascade": "all, delete"})
    policy: Optional["Policy"] = Relationship(back_populates="agent")

class Tool(SQLModel, table=True):
    __tablename__ = "tools"
    __table_args__ = (UniqueConstraint("name", name="uq_tool_name"),)

    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    description: str
    input_schema: str
    output_schema: str
    usable: bool = Field(default=True)  # Flag for schema verification status
    created_at: datetime = Field(default_factory=datetime.utcnow)

    agents: List[AgentTool] = Relationship(back_populates="tool")

class Policy(SQLModel, table=True):
    __tablename__ = "policies"

    id: Optional[int] = Field(default=None, primary_key=True)
    agent_id: int = Field(foreign_key="agents.id", unique=True)
    frequency_limit: Optional[int] = None
    require_approval_for_all_tool_calls: bool = Field(default=False)

    agent: Agent = Relationship(back_populates="policy")

class Session(SQLModel, table=True):
    __tablename__ = "sessions"

    id: Optional[int] = Field(default=None, primary_key=True)
    session_id: str = Field(unique=True, index=True)
    agent_id: int = Field(foreign_key="agents.id")
    title: Optional[str] = None  # Auto-generated from first message or manually set
    status: str = Field(default="running")  # running | paused | completed | failed | terminated
    user_input: str
    state_snapshot: Optional[str] = None  # JSON snapshot of runtime state for resume
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    logs: List["Log"] = Relationship(back_populates="session", sa_relationship_kwargs={"cascade": "all, delete"})
    messages: List["ChatMessage"] = Relationship(back_populates="session", sa_relationship_kwargs={"cascade": "all, delete"})

class Log(SQLModel, table=True):
    __tablename__ = "logs"

    id: Optional[int] = Field(default=None, primary_key=True)
    session_id: str = Field(foreign_key="sessions.session_id", index=True)
    agent_id: int = Field(foreign_key="agents.id")
    event_type: str  # session_start | node_transition | tool_call | tool_result | session_end
    event_data: str  # JSON string
    timestamp: datetime = Field(default_factory=datetime.utcnow)

    session: Session = Relationship(back_populates="logs")

class ChatMessage(SQLModel, table=True):
    __tablename__ = "chat_messages"

    id: Optional[int] = Field(default=None, primary_key=True)
    session_id: str = Field(foreign_key="sessions.session_id", index=True)
    role: str  # "user" | "assistant"
    content: str
    message_metadata: Optional[str] = Field(default=None, alias="metadata")  # JSON string for additional context (tool calls, etc.)
    created_at: datetime = Field(default_factory=datetime.utcnow)

    session: Session = Relationship(back_populates="messages")

class Approval(SQLModel, table=True):
    __tablename__ = "approvals"

    id: Optional[int] = Field(default=None, primary_key=True)
    session_id: str = Field(foreign_key="sessions.session_id", index=True)
    agent_id: int = Field(foreign_key="agents.id")
    tool_id: int = Field(foreign_key="tools.id")
    tool_name: str
    status: str = Field(default="pending")  # pending | approved | denied
    requested_at: datetime = Field(default_factory=datetime.utcnow)
    decided_at: Optional[datetime] = None
    decided_by: Optional[str] = None  # Placeholder for future authentication
    decision_reason: Optional[str] = None
