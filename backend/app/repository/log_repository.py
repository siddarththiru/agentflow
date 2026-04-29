import json
from datetime import datetime
from typing import Any, Dict, List, Optional

from sqlmodel import Session, and_, func, select

from app import models

class LogQuery:    
    def __init__(
        self,
        id: int,
        session_id: str,
        agent_id: int,
        event_type: str,
        event_data: Dict[str, Any],
        timestamp: datetime
    ):
        self.id = id
        self.session_id = session_id
        self.agent_id = agent_id
        self.event_type = event_type
        self.event_data = event_data
        self.timestamp = timestamp
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "session_id": self.session_id,
            "agent_id": self.agent_id,
            "event_type": self.event_type,
            "event_data": self.event_data,
            "timestamp": self.timestamp.isoformat() if self.timestamp else None
        }

class LogRepository:  
    # Supported event types
    VALID_EVENT_TYPES = {
        "session_start",
        "session_end",
        "node_transition",
        "tool_call",
        "tool_call_attempt",
        "tool_call_result",
        "tool_result",
        "enforcement_decision",
        "runtime_error",
        "intent_guard_decision",
        "approval_requested",
        "approval_decision",
    }
    
    def __init__(self, session: Session):
        self.session = session
    
    def get_logs(
        self,
        session_id: Optional[str] = None,
        agent_id: Optional[int] = None,
        event_type: Optional[str] = None,
        from_time: Optional[datetime] = None,
        to_time: Optional[datetime] = None,
        limit: int = 100,
        offset: int = 0
    ) -> tuple[List[LogQuery], int]:
        # Validate inputs
        if limit > 1000:
            limit = 1000
        if limit < 1:
            limit = 10
        if offset < 0:
            offset = 0
        
        if event_type and event_type not in self.VALID_EVENT_TYPES:
            raise ValueError(f"Invalid event_type: {event_type}")
        
        # Build filters
        filters = []
        
        if session_id:
            filters.append(models.Log.session_id == session_id)
        
        if agent_id:
            filters.append(models.Log.agent_id == agent_id)
        
        if event_type:
            filters.append(models.Log.event_type == event_type)
        
        if from_time:
            filters.append(models.Log.timestamp >= from_time)
        
        if to_time:
            filters.append(models.Log.timestamp <= to_time)
        
        # Build query
        query = select(models.Log).where(and_(*filters)) if filters else select(models.Log)
        
        # Get total count
        count_query = select(func.count()).select_from(models.Log)
        if filters:
            count_query = count_query.where(and_(*filters))
        total = self.session.exec(count_query).one()
        
        # Get paginated results, ordered by timestamp DESC
        logs = self.session.exec(
            query.order_by(models.Log.timestamp.desc()).limit(limit).offset(offset)
        ).all()
        
        # Convert to LogQuery objects
        return [self._to_log_query(log) for log in logs], total
    
    def get_session_logs(
        self,
        session_id: str,
        order_asc: bool = True
    ) -> List[LogQuery]:
        logs = self.session.exec(
            select(models.Log)
            .where(models.Log.session_id == session_id)
            .order_by(
                models.Log.timestamp.asc() if order_asc else models.Log.timestamp.desc()
            )
        ).all()
        
        if not logs:
            # Check if session exists
            session_record = self.session.exec(
                select(models.Session).where(models.Session.session_id == session_id)
            ).first()
            if not session_record:
                raise ValueError(f"Session not found: {session_id}")
        
        return [self._to_log_query(log) for log in logs]
    
    def get_agent_logs(
        self,
        agent_id: int,
        limit: int = 1000,
        offset: int = 0
    ) -> tuple[List[LogQuery], int]:

        return self.get_logs(
            agent_id=agent_id,
            limit=limit,
            offset=offset
        )
    
    def get_session_count(self) -> int:
        return self.session.exec(select(func.count()).select_from(models.Session)).one()
    
    def get_log_count(
        self,
        session_id: Optional[str] = None,
        agent_id: Optional[int] = None
    ) -> int:
        query = select(func.count()).select_from(models.Log)
        filters = []
        
        if session_id:
            filters.append(models.Log.session_id == session_id)
        if agent_id:
            filters.append(models.Log.agent_id == agent_id)
        
        if filters:
            query = query.where(and_(*filters))
        
        return self.session.exec(query).one()
    
    def get_event_type_counts(
        self,
        session_id: Optional[str] = None
    ) -> Dict[str, int]:
        query = select(
            models.Log.event_type,
            func.count().label("count")
        ).group_by(models.Log.event_type)
        
        if session_id:
            query = query.where(models.Log.session_id == session_id)
        
        results = self.session.exec(query).all()
        return {event_type: count for event_type, count in results}
    
    @staticmethod
    def _to_log_query(log_model: models.Log) -> LogQuery:
        try:
            event_data = json.loads(log_model.event_data)
        except (json.JSONDecodeError, TypeError):
            event_data = {"error": "Failed to parse event_data"}
        
        # Safe serialization - ensure no sensitive data leaks
        event_data = _sanitize_event_data(event_data, log_model.event_type)
        
        return LogQuery(
            id=log_model.id,
            session_id=log_model.session_id,
            agent_id=log_model.agent_id,
            event_type=log_model.event_type,
            event_data=event_data,
            timestamp=log_model.timestamp
        )

def _sanitize_event_data(
    event_data: Dict[str, Any],
    event_type: str
) -> Dict[str, Any]:
    # Create a copy to avoid mutations
    sanitized = dict(event_data)
    
    # Remove sensitive fields based on event type
    if event_type == "tool_call":
        # Don't expose full parameters - they might contain secrets
        # Keep tool name and timestamp but remove params
        sanitized = {
            k: v for k, v in sanitized.items()
            if k not in ["params", "parameters"]
        }
        if "params" in event_data:
            sanitized["params_provided"] = True  # Flag that params existed
    
    if event_type == "tool_call_attempt":
        # Similar - don't expose parameters
        sanitized = {
            k: v for k, v in sanitized.items()
            if k not in ["params", "parameters"]
        }

    if event_type == "tool_call_result":
        sanitized = {
            k: v for k, v in sanitized.items()
            if k not in ["result", "raw_output", "output"]
        }

    if event_type == "session_end":
        sanitized = {
            k: v for k, v in sanitized.items()
            if k not in ["final_output", "raw_output", "output"]
        }
    
    # Never expose internal error details
    if event_type == "runtime_error":
        if "traceback" in sanitized:
            del sanitized["traceback"]
        if "stack_trace" in sanitized:
            del sanitized["stack_trace"]
    
    return sanitized
