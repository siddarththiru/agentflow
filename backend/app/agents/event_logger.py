import json
from datetime import datetime
from typing import Any, Dict

from sqlmodel import Session

from app import models
from app.database import engine


class EventLogger:    
    def __init__(self, db_session: Session | None = None):
        self.db_session = db_session
    
    def emit_event(
        self,
        session_id: str,
        agent_id: int,
        event_type: str,
        event_data: Dict[str, Any]
    ) -> None:
        log_entry = models.Log(
            session_id=session_id,
            agent_id=agent_id,
            event_type=event_type,
            event_data=json.dumps(event_data),
            timestamp=datetime.utcnow()
        )
        with Session(engine) as session:
            session.add(log_entry)
            session.commit()
    
    def log_session_start(self, session_id: str, agent_id: int, user_input: str) -> None:
        self.emit_event(
            session_id=session_id,
            agent_id=agent_id,
            event_type="session_start",
            event_data={"user_input": user_input}
        )
    
    def log_node_transition(self, session_id: str, agent_id: int, from_node: str, to_node: str) -> None:
        self.emit_event(
            session_id=session_id,
            agent_id=agent_id,
            event_type="node_transition",
            event_data={"from": from_node, "to": to_node}
        )
    
    def log_tool_call(
        self,
        session_id: str,
        agent_id: int,
        tool_name: str,
        tool_params: Dict[str, Any],
        interception_result: str
    ) -> None:
        self.emit_event(
            session_id=session_id,
            agent_id=agent_id,
            event_type="tool_call",
            event_data={
                "tool": tool_name,
                "params": tool_params,
                "interception": interception_result,
                "timestamp": datetime.utcnow().isoformat()
            }
        )
    
    def log_tool_result(
        self,
        session_id: str,
        agent_id: int,
        tool_name: str,
        result: Any,
        duration_ms: float,
        success: bool = True
    ) -> None:
        output_type = type(result).__name__ if result is not None else "none"
        self.emit_event(
            session_id=session_id,
            agent_id=agent_id,
            event_type="tool_call_result",
            event_data={
                "tool": tool_name,
                "status": "success" if success else "failure",
                "result": str(result),
                "output_type": output_type,
                "duration_ms": duration_ms
            }
        )
    
    def log_session_end(
        self,
        session_id: str,
        agent_id: int,
        status: str,
        final_output: str = None,
        error: str = None
    ) -> None:
        event_data = {"status": status}
        if final_output:
            event_data["final_output"] = final_output
        if error:
            event_data["error"] = error
        
        self.emit_event(
            session_id=session_id,
            agent_id=agent_id,
            event_type="session_end",
            event_data=event_data
        )
