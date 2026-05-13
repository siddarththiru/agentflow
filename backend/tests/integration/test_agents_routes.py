from app.api.routes import agents as agents_routes


class StubRuntime:
    def __init__(self, *_args, **_kwargs) -> None:
        self.last_state_snapshot = None

    def execute(self, _user_input: str, session_id: str | None = None):
        return {
            "session_id": session_id,
            "status": "completed",
            "final_output": "National College of Ireland Final Year Project update completed.",
            "error": None,
        }

    def resume_session(self, session_id: str):
        return {
            "session_id": session_id,
            "status": "completed",
            "final_output": "Session resumed and completed successfully.",
            "error": None,
        }


def _create_agent_payload(name: str) -> dict:
    return {
        "name": name,
        "description": "Agent for National College of Ireland operations monitoring",
        "purpose": "Handle Final Year Project runtime tasks",
        "model": "gemini-2.5-flash",
    }


def test_create_agent_and_reject_duplicate(api_client) -> None:
    payload = _create_agent_payload("NCI Agent 2026")

    first = api_client.post("/agents", json=payload)
    second = api_client.post("/agents", json=payload)

    assert first.status_code == 201
    assert second.status_code == 400


def test_set_policy_and_get_definition(api_client, create_tool) -> None:
    tool = create_tool(name="Campus Weather API")
    create_agent_resp = api_client.post("/agents", json=_create_agent_payload("NCI Definition Agent"))
    agent_id = create_agent_resp.json()["id"]

    assign_resp = api_client.post(f"/agents/{agent_id}/tools", json={"tool_ids": [tool.id]})
    assert assign_resp.status_code == 200

    policy_resp = api_client.post(
        f"/agents/{agent_id}/policy",
        json={
            "frequency_limit": 2,
            "require_approval_for_all_tool_calls": False,
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

    definition_resp = api_client.get(f"/agents/{agent_id}/definition")

    assert policy_resp.status_code == 200
    assert definition_resp.status_code == 200
    assert definition_resp.json()["tools"][0]["name"] == "Campus Weather API"


def test_run_agent_uses_runtime_adapter(api_client, create_tool, monkeypatch) -> None:
    monkeypatch.setattr(agents_routes, "AgentRuntime", StubRuntime)
    monkeypatch.setattr(agents_routes, "get_agent_chat_model", lambda _agent: object())
    monkeypatch.setattr(agents_routes, "get_guard_chat_model", lambda _agent, _policy: object())

    tool = create_tool(name="Run Tool API")
    agent_resp = api_client.post("/agents", json=_create_agent_payload("Run Agent NCI"))
    agent_id = agent_resp.json()["id"]

    api_client.post(f"/agents/{agent_id}/tools", json={"tool_ids": [tool.id]})
    api_client.post(
        f"/agents/{agent_id}/policy",
        json={
            "frequency_limit": 1,
            "require_approval_for_all_tool_calls": False,
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

    response = api_client.post(
        "/agents/run-agent",
        json={
            "agent_id": agent_id,
            "user_input": "Provide final project status for National College of Ireland",
        },
    )

    assert response.status_code == 200
    assert response.json()["status"] == "completed"
