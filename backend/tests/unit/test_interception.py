from app.agents.interception import InterceptionHook


class StubLogger:
    def __init__(self) -> None:
        self.events: list[dict] = []

    def emit_event(self, session_id: str, agent_id: int, event_type: str, event_data: dict) -> None:
        self.events.append(
            {
                "session_id": session_id,
                "agent_id": agent_id,
                "event_type": event_type,
                "event_data": event_data,
            }
        )


def test_intercept_blocks_disallowed_tool() -> None:
    logger = StubLogger()
    hook = InterceptionHook(
        session_id="session-nci-2026-01",
        agent_id=11,
        logger=logger,
        allowed_tool_ids=[2, 3],
    )

    decision = hook.intercept("Weather API", {"city": "Dublin"}, tool_id=1)

    assert decision.decision == "block"
    assert "not in the allowed tools list" in decision.reason


def test_intercept_blocks_when_frequency_limit_reached() -> None:
    logger = StubLogger()
    hook = InterceptionHook(
        session_id="session-nci-2026-02",
        agent_id=11,
        logger=logger,
        frequency_limit=1,
    )

    first = hook.intercept("Weather API", {"city": "Dublin"}, tool_id=1)
    second = hook.intercept("Weather API", {"city": "Dublin"}, tool_id=1)

    assert first.decision == "allow"
    assert second.decision == "block"
    assert "frequency limit" in second.reason


def test_intercept_pauses_when_approval_required(monkeypatch) -> None:
    logger = StubLogger()
    hook = InterceptionHook(
        session_id="session-nci-2026-03",
        agent_id=11,
        logger=logger,
        require_approval_for_all=True,
    )

    created_requests: list[dict] = []

    def fake_create_approval_request(tool_name: str, tool_id: int, params_provided: bool = False) -> None:
        created_requests.append(
            {
                "tool_name": tool_name,
                "tool_id": tool_id,
                "params_provided": params_provided,
            }
        )

    monkeypatch.setattr(hook, "_create_approval_request", fake_create_approval_request)

    decision = hook.intercept("Weather API", {"city": "Dublin"}, tool_id=1)

    assert decision.decision == "pause"
    assert len(created_requests) == 1
    assert created_requests[0]["tool_name"] == "Weather API"
