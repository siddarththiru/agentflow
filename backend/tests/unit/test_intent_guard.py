import json

from langchain_core.messages import AIMessage, HumanMessage

from app.agents.intent_guard import IntentGuard
from app.schemas import AgentDefinition, AgentDefinitionPolicy


class StubGuardModel:
    def __init__(self, payload: dict) -> None:
        self.payload = payload

    def invoke(self, _messages):
        return AIMessage(content=json.dumps(self.payload))


def _definition() -> AgentDefinition:
    return AgentDefinition(
        agent_id=1,
        name="NCI Safety Agent",
        description="Supports Final Year Project sessions safely.",
        purpose="Evaluate requests and enforce guardrails",
        model="gemini-2.5-flash",
        tools=[],
        policy=AgentDefinitionPolicy(
            allowed_tool_ids=[],
            frequency_limit=None,
            require_approval_for_all_tool_calls=False,
            intent_guard_enabled=True,
            intent_guard_action_low="ignore",
            intent_guard_action_medium="clarify",
            intent_guard_action_high="pause_for_approval",
            intent_guard_action_critical="block",
        ),
    )


def test_intent_guard_classify_returns_structured_result() -> None:
    guard = IntentGuard(
        _definition(),
        StubGuardModel(
            {
                "risk_level": "medium",
                "intent": "ambiguous",
                "confidence": 0.72,
                "explanation": "Needs clarification before tool usage",
                "categories": {"policy": "medium"},
                "clarifying_question": "Can you confirm the approved project context?",
            }
        ),
    )

    result = guard.classify([HumanMessage(content="Check college weather")], checkpoint="prompt")

    assert result.risk_level == "medium"
    assert result.intent == "ambiguous"
    assert result.categories["policy"] == "medium"


def test_intent_guard_action_for_risk_uses_policy_mapping() -> None:
    guard = IntentGuard(_definition(), StubGuardModel({"risk_level": "low", "intent": "benign", "confidence": 1, "explanation": "ok", "categories": {}}))

    assert guard.action_for_risk("low") == "ignore"
    assert guard.action_for_risk("high") == "pause_for_approval"
    assert guard.action_for_risk("critical") == "block"


def test_intent_guard_failure_result_fails_closed() -> None:
    guard = IntentGuard(_definition(), StubGuardModel({}))

    result = guard.failure_result(RuntimeError("guard model timeout"))

    assert result.risk_level == "high"
    assert "failed closed" in result.explanation
