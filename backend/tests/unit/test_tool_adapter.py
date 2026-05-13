from app.agents.interception import InterceptionDecision
from app.agents.tool_adapter import ToolAdapter
from app.schemas import AgentDefinitionTool


def _tool_definitions() -> dict[str, AgentDefinitionTool]:
    return {
        "Weather API": AgentDefinitionTool(
            id=1,
            name="Weather API",
            description="Get weather for a city",
            input_schema={
                "type": "object",
                "properties": {"city": {"type": "string"}},
                "required": ["city"],
                "additionalProperties": False,
            },
            output_schema={"type": "object"},
        )
    }


def test_validate_params_accepts_valid_payload() -> None:
    adapter = ToolAdapter(_tool_definitions())

    assert adapter.validate_params("Weather API", {"city": "Dublin"}) is True


def test_validate_params_rejects_invalid_payload() -> None:
    adapter = ToolAdapter(_tool_definitions())

    assert adapter.validate_params("Weather API", {"topic": "weather"}) is False


def test_invoke_tool_returns_blocked_result() -> None:
    adapter = ToolAdapter(_tool_definitions())

    def intercept(*_args, **_kwargs):
        return InterceptionDecision(decision="block", reason="Blocked by policy")

    result = adapter.invoke_tool("Weather API", {"city": "Dublin"}, intercept)

    assert result["success"] is False
    assert result["blocked"] is True
    assert "Blocked by policy" in result["error"]


def test_invoke_tool_returns_success_result() -> None:
    adapter = ToolAdapter(_tool_definitions())

    def intercept(*_args, **_kwargs):
        return InterceptionDecision(decision="allow", reason="Allowed")

    result = adapter.invoke_tool("Weather API", {"city": "Dublin"}, intercept)

    assert result["success"] is True
    assert result["tool"] == "Weather API"
    assert result["result"]["city"] == "Dublin"
