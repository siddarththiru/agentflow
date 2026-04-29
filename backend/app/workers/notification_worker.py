import logging
import time
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

from sqlmodel import Session

from app.config.notifications import NotificationSettings, get_notification_settings
from app.repository.log_repository import LogQuery, LogRepository
from app.workers.notification_channels import NotificationDispatcher

logger = logging.getLogger(__name__)

class NotificationWorker:
    def __init__(
        self,
        db_session: Session,
        dispatcher: NotificationDispatcher,
        settings: Optional[NotificationSettings] = None,
    ):
        self.db_session = db_session
        self.repo = LogRepository(db_session)
        self.dispatcher = dispatcher
        self.settings = settings or get_notification_settings()
        self.last_processed_log_id: Optional[int] = None

    def poll_once(self) -> Dict[str, int]:
        if not self.settings.notifications_enabled:
            return {"processed_logs": 0, "alerts_sent": 0}

        logs, _ = self.repo.get_logs(limit=1000, offset=0)
        if not logs:
            return {"processed_logs": 0, "alerts_sent": 0}

        new_logs = self._filter_new_logs(logs)
        if not new_logs:
            return {"processed_logs": 0, "alerts_sent": 0}

        alerts: List[Dict[str, Any]] = []
        for log in new_logs:
            alerts.extend(self._detect_alerts(log))

        alerts_sent = 0
        for payload in alerts:
            alerts_sent += self.dispatcher.send(payload)

        self.last_processed_log_id = max(log.id for log in new_logs)

        return {
            "processed_logs": len(new_logs),
            "alerts_sent": alerts_sent,
        }

    def run_forever(self) -> None:
        while True:
            try:
                stats = self.poll_once()
                logger.info(
                    "Notification poll complete: processed=%s alerts_sent=%s",
                    stats["processed_logs"],
                    stats["alerts_sent"],
                )
            except (OSError, ValueError, TypeError) as exc:
                logger.error("Notification worker cycle failed: %s", exc, exc_info=True)

            time.sleep(self.settings.alert_poll_interval)

    def _filter_new_logs(self, logs: List[LogQuery]) -> List[LogQuery]:
        # Repository returns logs newest first; process oldest to newest for stable alert ordering.
        logs_asc = sorted(logs, key=lambda l: l.id)

        if self.last_processed_log_id is None:
            return logs_asc

        return [log for log in logs_asc if log.id > self.last_processed_log_id]

    def _detect_alerts(self, log: LogQuery) -> List[Dict[str, Any]]:
        if log.event_type == "approval_requested":
            return [self._approval_alert(log)]

        if log.event_type == "enforcement_decision":
            decision = str(log.event_data.get("decision", "")).lower()
            if decision == "block":
                repeated = self._repeated_block_alert(log)
                return [repeated] if repeated else []
            return []

        if log.event_type == "runtime_error":
            return [self._runtime_error_alert(log)]

        return []

    def _approval_alert(self, log: LogQuery) -> Dict[str, Any]:
        return {
            "title": "Approval required",
            "event_type": "approval_requested",
            "agent_id": log.agent_id,
            "session_id": log.session_id,
            "tool_name": log.event_data.get("tool_name"),
            "timestamp": self._iso(log.timestamp),
        }

    def _repeated_block_alert(self, log: LogQuery) -> Optional[Dict[str, Any]]:
        window_start = log.timestamp - timedelta(minutes=self.settings.block_alert_window_minutes)
        block_logs, _ = self.repo.get_logs(
            agent_id=log.agent_id,
            event_type="enforcement_decision",
            from_time=window_start,
            to_time=log.timestamp,
            limit=1000,
        )

        block_events = [
            entry for entry in block_logs
            if str(entry.event_data.get("decision", "")).lower() == "block"
        ]
        block_count = len(block_events)

        # Only trigger when threshold is reached to avoid alert spam on every subsequent block.
        if block_count != self.settings.block_alert_threshold:
            return None

        tool_names = sorted({
            str(entry.event_data.get("tool_name", "unknown")) for entry in block_events
        })

        return {
            "title": "Repeated policy blocks detected",
            "event_type": "enforcement_decision",
            "agent_id": log.agent_id,
            "session_id": log.session_id,
            "block_count": block_count,
            "tool_names": tool_names,
            "window_minutes": self.settings.block_alert_window_minutes,
            "timestamp": self._iso(log.timestamp),
        }

    def _runtime_error_alert(self, log: LogQuery) -> Dict[str, Any]:
        return {
            "title": "Runtime error detected",
            "event_type": "runtime_error",
            "agent_id": log.agent_id,
            "session_id": log.session_id,
            "error_type": log.event_data.get("error_type", "unknown_error"),
            "timestamp": self._iso(log.timestamp),
        }


    def _iso(value: datetime) -> str:
        return value.isoformat()
