from typing import Annotated, Optional, Sequence, TypedDict

from langchain_core.messages import BaseMessage
from langgraph.graph.message import add_messages

class RuntimeState(TypedDict):
    session_id: str
    agent_id: int
    messages: Annotated[Sequence[BaseMessage], add_messages]
    pending_tool_call: Optional[dict]
    pending_tool_decision: Optional[str]
    execution_status: str
    final_output: Optional[str]
    error: Optional[str]
