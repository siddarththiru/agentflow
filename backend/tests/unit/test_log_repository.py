import json
from datetime import datetime, timezone

import pytest

from app import models
from app.repository.log_repository import LogRepository


def test_get_logs_sanitizes_tool_call_params(db_session, create_agent, create_session_record) -> None:
    agent = create_agent(name="NCI Log Agent")
    create_session_record(session_id="session-log-001", agent_id=agent.id)

    log = models.Log(
        session_id="session-log-001",
        agent_id=agent.id,
        event_type="tool_call",
        event_data=json.dumps({"tool": "Weather API", "params": {"api_key": "secret"}}),
        timestamp=datetime.now(timezone.utc),
    )
    db_session.add(log)
    db_session.commit()

    repo = LogRepository(db_session)
    logs, total = repo.get_logs(session_id="session-log-001")

    assert total == 1
    assert len(logs) == 1
    assert "params" not in logs[0].event_data
    assert logs[0].event_data["params_provided"] is True


def test_get_logs_rejects_invalid_event_type(db_session) -> None:
    repo = LogRepository(db_session)

    with pytest.raises(ValueError):
        repo.get_logs(event_type="not_supported")


def test_get_session_logs_missing_session_raises(db_session) -> None:
    repo = LogRepository(db_session)

    with pytest.raises(ValueError):
        repo.get_session_logs("session-missing-2026")
