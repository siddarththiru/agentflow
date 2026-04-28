import json
from typing import Any, Dict, List, Optional

from sqlmodel import Session, select

from app import models
from app.repository.log_repository import LogRepository

_BLOCKED_FIELDS = frozenset({
    "params", "parameters", "raw_output", "output", "prompt", "user_input",
    "result", "final_output", "traceback", "stack_trace", "credentials", "password", "token", "secret",
    "api_key", "apikey",
    "conversation", "messages", "tool_args",
})

def _safe_metadata(event_data: Dict[str, Any], event_type: str) -> Dict[str, Any]:
    # Return event_data with sensitive fields stripped.
    return {k: v for k, v in event_data.items() if k.lower() not in _BLOCKED_FIELDS}

def _session_summary(session: models.Session) -> Dict[str, Any]:
    return {
        "session_id": session.session_id,
        "agent_id": session.agent_id,
        "status": session.status,
        "created_at": session.created_at.isoformat(),
        "last_updated": session.updated_at.isoformat(),
    }

class InvestigationService:
    def __init__(self, db: Session) -> None:
        self._db = db
        self._repo = LogRepository(db)

    def list_sessions(
        self,
        agent_id: Optional[int] = None,
        status: Optional[str] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> Dict[str, Any]:
        limit = min(max(limit, 1), 1000)
        offset = max(offset, 0)
        stmt = select(models.Session)
        if agent_id is not None:
            stmt = stmt.where(models.Session.agent_id == agent_id)
        if status is not None:
            stmt = stmt.where(models.Session.status == status)
        all_sessions = self._db.exec(stmt).all()
        total = len(all_sessions)
        all_sessions = sorted(all_sessions, key=lambda s: s.created_at, reverse=True)
        page = all_sessions[offset: offset + limit]
        return {
            "sessions": [_session_summary(s) for s in page],
            "total": total,
            "count": len(page),
            "limit": limit,
            "offset": offset,
        }

    def get_session(self, session_id: str) -> Optional[Dict[str, Any]]:
        record = self._db.exec(
            select(models.Session).where(models.Session.session_id == session_id)
        ).first()
        if record is None:
            return None
        latest = self._get_latest_classification(session_id)
        approval = self._db.exec(
            select(models.Approval).where(models.Approval.session_id == session_id)
        ).first()
        approval_dict = None
        if approval:
            approval_dict = {
                "id": approval.id,
                "status": approval.status,
                "tool_name": approval.tool_name,
                "requested_at": approval.requested_at.isoformat(),
                "decided_at": approval.decided_at.isoformat() if approval.decided_at else None,
                "decided_by": approval.decided_by,
            }
        return {
            "session_id": record.session_id,
            "agent_id": record.agent_id,
            "status": record.status,
            "created_at": record.created_at.isoformat(),
            "last_updated": record.updated_at.isoformat(),
            "latest_classification": latest,
            "approval": approval_dict,
        }

    def get_session_timeline(self, session_id: str) -> Optional[Dict[str, Any]]:
        record = self._db.exec(
            select(models.Session).where(models.Session.session_id == session_id)
        ).first()
        if record is None:
            return None
        logs_raw = self._db.exec(
            select(models.Log)
            .where(models.Log.session_id == session_id)
            .order_by(models.Log.timestamp.asc())
        ).all()
        events = []
        for log in logs_raw:
            try:
                event_data = json.loads(log.event_data)
            except (json.JSONDecodeError, TypeError):
                event_data = {}
            events.append({
                "timestamp": log.timestamp.isoformat(),
                "event_type": log.event_type,
                "metadata": _safe_metadata(event_data, log.event_type),
            })
        return {
            "session_id": session_id,
            "agent_id": record.agent_id,
            "status": record.status,
            "events": events,
            "event_count": len(events),
        }
    
    def get_agent_activity(
        self,
        agent_id: int,
        limit: int = 50,
        offset: int = 0,
    ) -> Optional[Dict[str, Any]]:
        agent = self._db.get(models.Agent, agent_id)
        if agent is None:
            return None
        limit = min(max(limit, 1), 1000)
        offset = max(offset, 0)
        all_sessions = self._db.exec(
            select(models.Session).where(models.Session.agent_id == agent_id)
        ).all()
        total_sessions = len(all_sessions)
        all_sessions = sorted(all_sessions, key=lambda s: s.created_at, reverse=True)
        recent = all_sessions[offset: offset + limit]
        all_logs, _ = self._repo.get_logs(agent_id=agent_id, limit=10000)
        tool_counts: Dict[str, int] = {}
        block_count = 0
        approval_count = 0
        risk_classifications: List[Dict[str, Any]] = []
        for log in all_logs:
            if log.event_type == "tool_call":
                tool = log.event_data.get("tool", "unknown")
                tool_counts[tool] = tool_counts.get(tool, 0) + 1
            elif log.event_type == "enforcement_decision":
                if str(log.event_data.get("decision", "")).lower() == "block":
                    block_count += 1
            elif log.event_type == "approval_requested":
                approval_count += 1
            elif log.event_type == "threat_classification":
                risk = str(log.event_data.get("risk_level", "")).lower()
                if risk in {"high", "critical"}:
                    risk_classifications.append({
                        "session_id": log.session_id,
                        "risk_level": risk,
                        "timestamp": log.timestamp.isoformat(),
                    })
        return {
            "agent_id": agent_id,
            "agent_name": agent.name,
            "recent_sessions": [_session_summary(s) for s in recent],
            "total_sessions": total_sessions,
            "tool_usage_counts": tool_counts,
            "block_count": block_count,
            "approval_count": approval_count,
            "risk_classifications": risk_classifications,
            "limit": limit,
            "offset": offset,
        }

    def list_classifications(
        self,
        agent_id: Optional[int] = None,
        session_id: Optional[str] = None,
        risk_level: Optional[str] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> Dict[str, Any]:
        limit = min(max(limit, 1), 1000)
        offset = max(offset, 0)
        all_logs, _ = self._repo.get_logs(
            agent_id=agent_id,
            session_id=session_id,
            event_type="threat_classification",
            limit=10000,
        )
        rows = []
        for log in all_logs:
            entry_risk = str(log.event_data.get("risk_level", "")).lower()
            if risk_level is not None and entry_risk != risk_level.lower():
                continue
            rows.append({
                "session_id": log.session_id,
                "agent_id": log.agent_id,
                "risk_level": log.event_data.get("risk_level"),
                "confidence": log.event_data.get("confidence"),
                "explanation": log.event_data.get("explanation"),
                "timestamp": log.timestamp.isoformat(),
            })
        paginated = rows[offset: offset + limit]
        return {
            "classifications": paginated,
            "total": len(rows),
            "count": len(paginated),
            "limit": limit,
            "offset": offset,
        }

    def list_approvals(
        self,
        agent_id: Optional[int] = None,
        session_id: Optional[str] = None,
        status: Optional[str] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> Dict[str, Any]:
        limit = min(max(limit, 1), 1000)
        offset = max(offset, 0)
        stmt = select(models.Approval)
        if agent_id is not None:
            stmt = stmt.where(models.Approval.agent_id == agent_id)
        if session_id is not None:
            stmt = stmt.where(models.Approval.session_id == session_id)
        if status is not None:
            stmt = stmt.where(models.Approval.status == status)
        all_approvals = self._db.exec(
            stmt.order_by(models.Approval.requested_at.desc())
        ).all()
        total = len(all_approvals)
        paginated = all_approvals[offset: offset + limit]
        return {
            "approvals": [
                {
                    "id": a.id,
                    "agent_id": a.agent_id,
                    "session_id": a.session_id,
                    "tool_name": a.tool_name,
                    "status": a.status,
                    "decided_by": a.decided_by,
                    "created_at": a.requested_at.isoformat(),
                    "decided_at": a.decided_at.isoformat() if a.decided_at else None,
                }
                for a in paginated
            ],
            "total": total,
            "count": len(paginated),
            "limit": limit,
            "offset": offset,
        }

    def _get_latest_classification(self, session_id: str) -> Optional[Dict[str, Any]]:
        logs, _ = self._repo.get_logs(
            session_id=session_id,
            event_type="threat_classification",
            limit=1,
        )
        if not logs:
            return None
        log = logs[0]
        return {
            "risk_level": log.event_data.get("risk_level"),
            "confidence": log.event_data.get("confidence"),
            "timestamp": log.timestamp.isoformat(),
        }
    
