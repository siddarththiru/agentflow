from datetime import datetime, timezone

from app.config.notifications import NotificationSettings
from app.repository.log_repository import LogQuery
from app.workers.notification_channels import NotificationDispatcher
from app.workers.notification_worker import NotificationWorker


class FakeRepo:
    def __init__(self, logs: list[LogQuery]) -> None:
        self.logs = logs
        self.calls: list[dict] = []

    def get_logs(self, **kwargs):
        self.calls.append(kwargs)
        if kwargs.get("event_type") == "enforcement_decision":
            filtered = [
                log
                for log in self.logs
                if log.event_type == "enforcement_decision"
                and log.agent_id == kwargs.get("agent_id")
                and kwargs.get("from_time") <= log.timestamp <= kwargs.get("to_time")
            ]
            return filtered, len(filtered)
        if kwargs.get("session_id"):
            filtered = [log for log in self.logs if log.session_id == kwargs["session_id"]]
            return filtered, len(filtered)
        return self.logs, len(self.logs)


class FakeDispatcher:
    def __init__(self) -> None:
        self.payloads: list[dict] = []

    def send(self, payload: dict) -> int:
        self.payloads.append(payload)
        return 1


def _log(log_id: int, event_type: str, event_data: dict, *, agent_id: int = 12, session_id: str = "session-nci-001") -> LogQuery:
    return LogQuery(
        id=log_id,
        session_id=session_id,
        agent_id=agent_id,
        event_type=event_type,
        event_data=event_data,
        timestamp=datetime(2026, 5, 7, 12, log_id, tzinfo=timezone.utc),
    )


def test_poll_once_emits_approval_and_runtime_alerts() -> None:
    logs = [
        _log(1, "approval_requested", {"tool_name": "Weather API"}),
        _log(2, "runtime_error", {"error_type": "timeout"}),
    ]
    repo = FakeRepo(logs)
    dispatcher = FakeDispatcher()
    settings = NotificationSettings(notifications_enabled=True, alert_poll_interval=1)
    worker = NotificationWorker(db_session=object(), dispatcher=dispatcher, settings=settings)
    worker.repo = repo

    stats = worker.poll_once()

    assert stats == {"processed_logs": 2, "alerts_sent": 2}
    assert worker.last_processed_log_id == 2
    assert [payload["event_type"] for payload in dispatcher.payloads] == [
        "approval_requested",
        "runtime_error",
    ]


def test_repeated_block_alert_triggers_at_threshold() -> None:
    logs = [
        _log(1, "enforcement_decision", {"decision": "block", "tool_name": "Weather API"}),
        _log(2, "enforcement_decision", {"decision": "block", "tool_name": "News API"}),
    ]
    repo = FakeRepo(logs)
    dispatcher = FakeDispatcher()
    settings = NotificationSettings(notifications_enabled=True, block_alert_threshold=2, block_alert_window_minutes=10)
    worker = NotificationWorker(db_session=object(), dispatcher=dispatcher, settings=settings)
    worker.repo = repo

    stats = worker.poll_once()

    assert stats == {"processed_logs": 2, "alerts_sent": 1}
    assert dispatcher.payloads[0]["block_count"] == 2
    assert dispatcher.payloads[0]["tool_names"] == ["News API", "Weather API"]


def test_poll_once_returns_zero_when_disabled() -> None:
    worker = NotificationWorker(
        db_session=object(),
        dispatcher=FakeDispatcher(),
        settings=NotificationSettings(notifications_enabled=False),
    )

    assert worker.poll_once() == {"processed_logs": 0, "alerts_sent": 0}


def test_notification_dispatcher_continues_after_channel_error() -> None:
    class FailingChannel:
        def send(self, payload: dict) -> None:
            raise ValueError("boom")

    class RecordingChannel:
        def __init__(self) -> None:
            self.received: list[dict] = []

        def send(self, payload: dict) -> None:
            self.received.append(payload)

    recorder = RecordingChannel()
    dispatcher = NotificationDispatcher([FailingChannel(), recorder])

    sent = dispatcher.send({"title": "Alert"})

    assert sent == 1
    assert recorder.received == [{"title": "Alert"}]
