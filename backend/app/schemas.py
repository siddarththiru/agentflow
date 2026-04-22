from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field, validator


class AgentBase(BaseModel):
    name: str = Field(..., min_length=1)
    description: str = Field(..., min_length=10)
    purpose: str = Field(..., min_length=5)
    model: str = Field(..., min_length=1)


class AgentCreate(AgentBase):
    pass


class AgentUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1)
    description: Optional[str] = Field(None, min_length=10)
    purpose: Optional[str] = Field(None, min_length=5)
    model: Optional[str] = Field(None, min_length=1)


class AgentRead(AgentBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        orm_mode = True


class AgentPolicySummary(BaseModel):
    frequency_limit: Optional[int] = None
    require_approval_for_all_tool_calls: bool = False


class AgentSummaryRead(BaseModel):
    id: int
    name: str
    description: str
    model: str
    created_at: datetime
    updated_at: datetime
    sessions_count: int
    tools_count: int
    pending_approvals: int
    latest_session_status: Optional[str] = None
    health_status: str
    latest_risk_level: Optional[str] = None
    policy: Optional[AgentPolicySummary] = None


class AgentRecentSessionRead(BaseModel):
    session_id: str
    status: str
    created_at: datetime
    updated_at: datetime
    latest_risk_level: Optional[str] = None


class AgentRecentApprovalRead(BaseModel):
    id: int
    session_id: str
    tool_name: str
    status: str
    requested_at: datetime
    decided_at: Optional[datetime] = None
    decided_by: Optional[str] = None
    decision_reason: Optional[str] = None
    risk_level: Optional[str] = None


class AgentLatestClassificationRead(BaseModel):
    session_id: str
    risk_level: Optional[str] = None
    confidence: Optional[float] = None
    explanation: Optional[str] = None
    timestamp: datetime


class AgentProfileRead(BaseModel):
    agent: AgentRead
    policy: Optional["PolicyRead"] = None
    tools: List["ToolRead"]
    definition: Optional["AgentDefinition"] = None
    health_status: str
    sessions_count: int
    pending_approvals: int
    recent_sessions: List[AgentRecentSessionRead]
    recent_approvals: List[AgentRecentApprovalRead]
    latest_classifications: List[AgentLatestClassificationRead]


class ToolRead(BaseModel):
    id: int
    name: str
    description: str
    input_schema: str
    output_schema: str
    usable: bool

    class Config:
        orm_mode = True


class ToolCreate(BaseModel):
    name: str = Field(..., min_length=1)
    description: str = Field(..., min_length=10)
    input_schema: str = Field(...)  # JSON schema as string
    output_schema: str = Field(...)  # JSON schema as string


class ToolValidateRequest(BaseModel):
    name: str = Field(..., min_length=1)
    description: str = Field(..., min_length=10)
    input_schema: str = Field(...)  # JSON schema as string
    output_schema: str = Field(...)  # JSON schema as string


class ToolValidateResponse(BaseModel):
    valid: bool
    name: str
    description: str
    input_schema: dict
    output_schema: dict
    errors: List[str] = []


class ToolsUpdate(BaseModel):
    tool_ids: List[int]

    @validator("tool_ids")
    def unique_tools(cls, v: List[int]) -> List[int]:
        if len(v) != len(set(v)):
            raise ValueError("tool_ids must be unique")
        return v


class PolicyBase(BaseModel):
    frequency_limit: Optional[int] = Field(None, gt=0)
    require_approval_for_all_tool_calls: bool = False


class PolicyCreate(PolicyBase):
    pass


class PolicyRead(PolicyBase):
    id: int
    agent_id: int

    class Config:
        orm_mode = True


class AgentDefinitionTool(BaseModel):
    id: int
    name: str
    description: str
    input_schema: dict
    output_schema: dict


class AgentDefinitionPolicy(BaseModel):
    allowed_tool_ids: List[int]
    frequency_limit: Optional[int]
    require_approval_for_all_tool_calls: bool


class AgentDefinition(BaseModel):
    agent_id: int
    name: str
    description: str
    purpose: str
    model: str
    tools: List[AgentDefinitionTool]
    policy: AgentDefinitionPolicy


class AgentQARequest(BaseModel):
    question: str = Field(..., min_length=1)
    session_id: Optional[str] = None


class AgentQAResponse(BaseModel):
    question: str
    answer: str
    session_id: Optional[str] = None


class SessionCreate(BaseModel):
    agent_id: int
    user_input: str


class SessionRead(BaseModel):
    id: int
    session_id: str
    agent_id: int
    title: Optional[str] = None
    status: str
    user_input: str
    created_at: datetime
    updated_at: datetime

    class Config:
        orm_mode = True


class ChatMessageRead(BaseModel):
    id: int
    session_id: str
    role: str
    content: str
    metadata: Optional[str] = None
    created_at: datetime

    class Config:
        orm_mode = True


class ChatMessageCreate(BaseModel):
    content: str = Field(..., min_length=1)
    metadata: Optional[str] = None


class SessionSummaryRead(BaseModel):
    session_id: str
    agent_id: int
    title: Optional[str] = None
    status: str
    created_at: datetime
    updated_at: datetime


class SessionUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1)


class SessionDetailRead(BaseModel):
    session_id: str
    agent_id: int
    title: Optional[str] = None
    status: str
    created_at: datetime
    updated_at: datetime
    messages: List[ChatMessageRead] = []

    class Config:
        orm_mode = True


class LogRead(BaseModel):
    id: int
    session_id: str
    agent_id: int
    event_type: str
    event_data: str
    timestamp: datetime

    class Config:
        orm_mode = True


class RunAgentRequest(BaseModel):
    agent_id: int
    user_input: str = Field(..., min_length=1)


class RunAgentResponse(BaseModel):
    session_id: str
    status: str
    final_output: Optional[str] = None
    error: Optional[str] = None


AgentProfileRead.update_forward_refs(
    PolicyRead=PolicyRead,
    ToolRead=ToolRead,
    AgentDefinition=AgentDefinition,
)
