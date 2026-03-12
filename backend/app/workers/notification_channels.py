import json
import logging
from typing import Any, Dict, Iterable, List
from urllib import request

logger = logging.getLogger(__name__)

class NotificationChannel:
    def send(self, payload: Dict[str, Any]) -> None:
        raise NotImplementedError()

class ConsoleNotificationChannel(NotificationChannel):
    def send(self, payload: Dict[str, Any]) -> None:
        lines = [
            f"[ALERT] {payload.get('title', 'Notification')}",
            f"Event: {payload.get('event_type', 'unknown')}",
            f"Agent: {payload.get('agent_id', 'unknown')}",
            f"Session: {payload.get('session_id', 'unknown')}",
        ]

        if payload.get("tool_name"):
            lines.append(f"Tool: {payload['tool_name']}")
        if payload.get("risk_level"):
            lines.append(f"Risk: {payload['risk_level']}")
        if payload.get("block_count") is not None:
            lines.append(f"Block Count: {payload['block_count']}")

        logger.warning("\n".join(lines))

class WebhookNotificationChannel(NotificationChannel):
    def __init__(self, webhook_url: str, timeout_seconds: int = 5):
        self.webhook_url = webhook_url
        self.timeout_seconds = timeout_seconds

    def send(self, payload: Dict[str, Any]) -> None:
        body = json.dumps(payload).encode("utf-8")
        req = request.Request(
            self.webhook_url,
            data=body,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with request.urlopen(req, timeout=self.timeout_seconds):
            return

class NotificationDispatcher:
    def __init__(self, channels: Iterable[NotificationChannel]):
        self.channels: List[NotificationChannel] = list(channels)

    def send(self, payload: Dict[str, Any]) -> int:
        sent_count = 0
        for channel in self.channels:
            try:
                channel.send(payload)
                sent_count += 1
            except (OSError, ValueError, TypeError) as exc:
                logger.error("Notification channel send failed: %s", exc)
        return sent_count
