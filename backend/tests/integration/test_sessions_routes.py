from app.api.routes import sessions as sessions_routes


class StubRuntime:
    def __init__(self, *_args, **_kwargs) -> None:
        self.last_state_snapshot = None

    def run_chat_turn(self, session_id: str, _messages):
        return {
            "session_id": session_id,
            "status": "completed",
            "final_output": "The Final Year Project timeline remains on track for 2026.",
            "error": None,
            "state": {},
        }


def test_add_message_generates_assistant_reply(api_client, monkeypatch) -> None:
    monkeypatch.setattr(sessions_routes, "AgentRuntime", StubRuntime)
    monkeypatch.setattr(sessions_routes, "get_agent_chat_model", lambda _agent: object())
    monkeypatch.setattr(sessions_routes, "get_guard_chat_model", lambda _agent, _policy: object())

    agent_resp = api_client.post(
        "/agents",
        json={
            "name": "NCI Session Agent",
            "description": "Session test agent for National College of Ireland runtime checks",
            "purpose": "Assist user chat sessions",
            "model": "gemini-2.5-flash",
        },
    )
    agent_id = agent_resp.json()["id"]

    create_session_resp = api_client.post(f"/agents/{agent_id}/sessions")
    session_id = create_session_resp.json()["session_id"]

    response = api_client.post(
        f"/sessions/{session_id}/messages",
        json={"content": "Can you summarize the project milestones?", "metadata": None},
    )

    assert response.status_code == 200
    assert response.json()["role"] == "assistant"
    assert "Final Year Project" in response.json()["content"]


def test_list_sessions_with_filters(api_client) -> None:
    agent_resp = api_client.post(
        "/agents",
        json={
            "name": "NCI Filter Agent",
            "description": "Agent for checking list session filters in integration tests",
            "purpose": "Drive session filter checks",
            "model": "gemini-2.5-flash",
        },
    )
    agent_id = agent_resp.json()["id"]

    api_client.post(f"/agents/{agent_id}/sessions")

    response = api_client.get(f"/sessions?agent_id={agent_id}&limit=10&offset=0")

    assert response.status_code == 200
    body = response.json()
    assert body["total"] >= 1
    assert body["count"] >= 1
