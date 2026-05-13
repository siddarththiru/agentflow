import json
from datetime import datetime, timezone

from app import models


def test_query_logs_and_stats(api_client, db_session, create_agent, create_session_record) -> None:
    agent = create_agent(name="NCI Log Route Agent")
    session_record = create_session_record(session_id="session-log-route-001", agent_id=agent.id)

    log = models.Log(
        session_id=session_record.session_id,
        agent_id=agent.id,
        event_type="tool_call_attempt",
        event_data=json.dumps({"tool_name": "Weather API", "params_provided": True}),
        timestamp=datetime.now(timezone.utc),
    )
    db_session.add(log)
    db_session.commit()

    query_resp = api_client.get("/logs?event_type=tool_call_attempt&limit=20&offset=0")
    stats_resp = api_client.get("/logs/stats")

    assert query_resp.status_code == 200
    assert query_resp.json()["count"] >= 1
    assert stats_resp.status_code == 200
    assert stats_resp.json()["total_logs"] >= 1


def test_query_logs_rejects_invalid_time(api_client) -> None:
    response = api_client.get("/logs?from_time=not-a-time")

    assert response.status_code == 400
