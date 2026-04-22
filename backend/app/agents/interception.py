from typing import Any, Dict

from sqlmodel import Session, Session as DBSession
from datetime import datetime

from app.agents.event_logger import EventLogger
from app import models
from app.database import engine

class InterceptionDecision:   
    def __init__(
        self,
        decision: str,  # "allow" | "block" | "pause"
        reason: str,
        policy_id: int = None
    ):
        self.decision = decision
        self.reason = reason
        self.policy_id = policy_id
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "decision": self.decision,
            "reason": self.reason,
            "policy_id": self.policy_id
        }


class InterceptionHook:  
    def __init__(
        self,
        session_id: str,
        agent_id: int,
        logger: EventLogger,
        db_session: DBSession | None = None,
        allowed_tool_ids: list = None,
        frequency_limit: int = None,
        require_approval_for_all: bool = False
    ):
        self.session_id = session_id
        self.agent_id = agent_id
        self.logger = logger
        self.db_session = db_session
        self.allowed_tool_ids = allowed_tool_ids or []
        self.frequency_limit = frequency_limit
        self.require_approval_for_all = require_approval_for_all
        self.tool_call_count = {}  # Track per-tool call counts
    
    def intercept(self, tool_name: str, params: Dict[str, Any], tool_id: int = None) -> InterceptionDecision:
        self.logger.emit_event(
            session_id=self.session_id,
            agent_id=self.agent_id,
            event_type="tool_call_attempt",
            event_data={
                "tool_name": tool_name,
                "tool_id": tool_id,
                "params_provided": bool(params),
                "timestamp": datetime.utcnow().isoformat(),
            },
        )

        # Rule 1: Check if tool is allowed
        if self.allowed_tool_ids and tool_id is not None:
            if tool_id not in self.allowed_tool_ids:
                decision = InterceptionDecision(
                    decision="block",
                    reason=f"Tool '{tool_name}' (ID: {tool_id}) is not in the allowed tools list for this agent",
                    policy_id=None
                )
                self._log_enforcement_decision(tool_name, decision, tool_id)
                return decision
        
        # Rule 2: Check frequency limit
        if self.frequency_limit is not None:
            current_count = self.tool_call_count.get(tool_name, 0)
            if current_count >= self.frequency_limit:
                decision = InterceptionDecision(
                    decision="block",
                    reason=f"Tool '{tool_name}' has reached frequency limit ({current_count}/{self.frequency_limit})",
                    policy_id=None
                )
                self._log_enforcement_decision(tool_name, decision, tool_id)
                return decision
        
        # Rule 3: Check approval requirement
        if self.require_approval_for_all:
            decision = InterceptionDecision(
                decision="pause",
                reason=f"Tool '{tool_name}' requires user approval before execution",
                policy_id=None
            )
            self._create_approval_request(tool_name, tool_id, bool(params))
            self._log_enforcement_decision(tool_name, decision, tool_id)
            return decision
        
        # All checks passed - allow execution
        decision = InterceptionDecision(
            decision="allow",
            reason=f"Tool '{tool_name}' passed all policy checks",
            policy_id=None
        )
        
        # Increment tool call count for frequency tracking
        self.tool_call_count[tool_name] = self.tool_call_count.get(tool_name, 0) + 1
        
        self._log_enforcement_decision(tool_name, decision, tool_id)
        return decision
    
    def _log_enforcement_decision(
        self,
        tool_name: str,
        decision: InterceptionDecision,
        tool_id: int = None
    ) -> None:
        event_data = {
            "tool_name": tool_name,
            "tool_id": tool_id,
            "decision": decision.decision,
            "reason": decision.reason,
            "policy_id": decision.policy_id
        }
        
        self.logger.emit_event(
            session_id=self.session_id,
            agent_id=self.agent_id,
            event_type="enforcement_decision",
            event_data=event_data
        )
    
    def _create_approval_request(
        self,
        tool_name: str,
        tool_id: int,
        params_provided: bool = False
    ) -> None:
        with Session(engine) as session:
            approval = models.Approval(
                session_id=self.session_id,
                agent_id=self.agent_id,
                tool_id=tool_id,
                tool_name=tool_name,
                status="pending",
                requested_at=datetime.utcnow()
            )
            session.add(approval)

            from sqlmodel import select
            stmt = select(models.Session).where(models.Session.session_id == self.session_id)
            session_record = session.exec(stmt).first()
            if session_record:
                session_record.status = "paused"
                session_record.updated_at = datetime.utcnow()
                session.add(session_record)

            session.commit()
        
        # Log approval_requested event
        event_data = {
            "tool_name": tool_name,
            "tool_id": tool_id,
            "params_provided": params_provided,
            "timestamp": datetime.utcnow().isoformat()
        }
        
        self.logger.emit_event(
            session_id=self.session_id,
            agent_id=self.agent_id,
            event_type="approval_requested",
            event_data=event_data
        )
