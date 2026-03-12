import os
from dataclasses import dataclass
from typing import Optional

@dataclass
class NotificationSettings:
    notifications_enabled: bool = True
    alert_poll_interval: int = 300
    block_alert_threshold: int = 5
    block_alert_window_minutes: int = 10
    notification_webhook_url: Optional[str] = None

    @classmethod
    def from_env(cls) -> "NotificationSettings":
        enabled_raw = os.getenv("NOTIFICATIONS_ENABLED", "true").strip().lower()
        notifications_enabled = enabled_raw in {"1", "true", "yes", "on"}

        return cls(
            notifications_enabled=notifications_enabled,
            alert_poll_interval=int(os.getenv("ALERT_POLL_INTERVAL", "300")),
            block_alert_threshold=int(os.getenv("BLOCK_ALERT_THRESHOLD", "5")),
            block_alert_window_minutes=int(os.getenv("BLOCK_ALERT_WINDOW_MINUTES", "10")),
            notification_webhook_url=os.getenv("NOTIFICATION_WEBHOOK_URL"),
        )

def get_notification_settings() -> NotificationSettings:
    return NotificationSettings.from_env()
