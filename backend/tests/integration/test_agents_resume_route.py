from app import models
from app.api.routes import agents as agents_routes


class StubRuntime:
    def __init__(self, *_args, **_kwargs):
        pass

    def resume_session(self, session_id: str):
        return {
            "session_id": session_id,
            "status": "completed",
            "final_output": "Session resumed for National College of Ireland review.",
            "error": None,
        }


def test_resume_agent_route_returns_completed(api_client, create_tool, db_session, monkeypatch) -> None:
    monkeypatch.setattr(agents_routes, "AgentRuntime", StubRuntime)
    monkeypatch.setattr(agents_routes, "get_agent_chat_model", lambda _agent: object())
    monkeypatch.setattr(agents_routes, "get_guard_chat_model", lambda _agent, _policy: object())

    tool = create_tool(name="NCI Resume Tool")
    agent_resp = api_client.post(
        "/agents",
        json={
            "name": "NCI Resume Agent",
            "description": "Agent for resume route checks in Final Year Project",
            "purpose": "Resume paused sessions",
            "model": "gemini-2.5-flash",
        },
    )
    agent_id = agent_resp.json()["id"]

    api_client.post(f"/agents/{agent_id}/tools", json={"tool_ids": [tool.id]})
    api_client.post(
        f"/agents/{agent_id}/policy",
        json={
            "frequency_limit": 2,
            "require_approval_for_all_tool_calls": True,
            "intent_guard_enabled": True,
            "intent_guard_model_mode": "dedicated",
            "intent_guard_model": "gemini-2.5-flash",
            "intent_guard_include_conversation": True,
            "intent_guard_include_tool_args": False,
            "intent_guard_risk_tolerance": "balanced",
            "intent_guard_action_low": "ignore",
            "intent_guard_action_medium": "clarify",
            "intent_guard_action_high": "pause_for_approval",
            "intent_guard_action_critical": "block",
        },
    )

    session = models.Session(
        session_id="resume-session-nci-001",
        agent_id=agent_id,
        status="paused",
        user_input="Resume this session",
    )
    db_session.add(session)
    db_session.commit()

    response = api_client.post("/agents/resume-agent/resume-session-nci-001")

    assert response.status_code == 200
    assert response.json()["status"] == "completed"


def test_resume_agent_route_404_for_missing_session(api_client) -> None:
    response = api_client.post("/agents/resume-agent/session-does-not-exist")

    assert response.status_code == 404
