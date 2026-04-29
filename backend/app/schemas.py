from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field, root_validator, validator


GUARD_ACTIONS = {
    "ignore": 0,
    "clarify": 1,
    "autonomous_decide": 2,
    "pause_for_approval": 3,
    "block": 4,
}
GUARD_RISK_TOLERANCES = {"lenient", "balanced", "strict"}
GUARD_MODEL_MODES = {"dedicated", "same_as_agent"}


def validate_guard_action_order(values: dict) -> dict:
    actions = [
        values.get("intent_guard_action_low", "ignore"),
        values.get("intent_guard_action_medium", "clarify"),
        values.get("intent_guard_action_high", "pause_for_approval"),
        values.get("intent_guard_action_critical", "block"),
    ]
    invalid = [action for action in actions if action not in GUARD_ACTIONS]
    if invalid:
        raise ValueError(f"Invalid intent guard action: {invalid[0]}")

    ranks = [GUARD_ACTIONS[action] for action in actions]
    if ranks != sorted(ranks):
        raise ValueError("Intent guard actions must get stricter as risk increases")

    tolerance = values.get("intent_guard_risk_tolerance", "balanced")
    if tolerance not in GUARD_RISK_TOLERANCES:
        raise ValueError("intent_guard_risk_tolerance must be lenient, balanced, or strict")

    model_mode = values.get("intent_guard_model_mode", "dedicated")
    if model_mode not in GUARD_MODEL_MODES:
        raise ValueError("intent_guard_model_mode must be dedicated or same_as_agent")

    return values


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
    intent_guard_enabled: bool = True
    intent_guard_action_medium: str = "clarify"
    intent_guard_action_high: str = "pause_for_approval"
    intent_guard_action_critical: str = "block"


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
    policy: Optional[AgentPolicySummary] = None


class AgentRecentSessionRead(BaseModel):
    session_id: str
    status: str
    created_at: datetime
    updated_at: datetime


class AgentRecentApprovalRead(BaseModel):
    id: int
    session_id: str
    tool_name: str
    status: str
    requested_at: datetime
    decided_at: Optional[datetime] = None
    decided_by: Optional[str] = None
    decision_reason: Optional[str] = None



class AgentProfileRead(BaseModel):
    agent: AgentRead
    policy: Optional["PolicyRead"] = None
    tools: List["ToolRead"]
    definition: Optional["AgentDefinition"] = None
    sessions_count: int
    pending_approvals: int
    recent_sessions: List[AgentRecentSessionRead]
    recent_approvals: List[AgentRecentApprovalRead]


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
    intent_guard_enabled: bool = True
    intent_guard_model_mode: str = "dedicated"
    intent_guard_model: Optional[str] = "gemini-2.5-flash"
    intent_guard_include_conversation: bool = True
    intent_guard_include_tool_args: bool = False
    intent_guard_risk_tolerance: str = "balanced"
    intent_guard_action_low: str = "ignore"
    intent_guard_action_medium: str = "clarify"
    intent_guard_action_high: str = "pause_for_approval"
    intent_guard_action_critical: str = "block"

    @root_validator
    def guard_actions_are_ordered(cls, values: dict) -> dict:
        return validate_guard_action_order(values)


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
    intent_guard_enabled: bool = True
    intent_guard_model_mode: str = "dedicated"
    intent_guard_model: Optional[str] = "gemini-2.5-flash"
    intent_guard_include_conversation: bool = True
    intent_guard_include_tool_args: bool = False
    intent_guard_risk_tolerance: str = "balanced"
    intent_guard_action_low: str = "ignore"
    intent_guard_action_medium: str = "clarify"
    intent_guard_action_high: str = "pause_for_approval"
    intent_guard_action_critical: str = "block"

    @root_validator
    def guard_actions_are_ordered(cls, values: dict) -> dict:
        return validate_guard_action_order(values)


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
