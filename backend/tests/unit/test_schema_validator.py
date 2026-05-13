import pytest

from app.utils.schema_validator import validate_payload_against_schema, validate_tool_schema


def test_validate_payload_against_schema_accepts_valid_payload() -> None:
    schema = {
        "type": "object",
        "properties": {"project": {"type": "string"}},
        "required": ["project"],
    }

    validate_payload_against_schema(schema, {"project": "National College of Ireland 2026"})


def test_validate_payload_against_schema_rejects_invalid_payload() -> None:
    schema = {
        "type": "object",
        "properties": {"project": {"type": "string"}},
        "required": ["project"],
    }

    with pytest.raises(ValueError):
        validate_payload_against_schema(schema, {"project": 2026})


def test_validate_tool_schema_requires_valid_json_schema() -> None:
    with pytest.raises(ValueError):
        validate_tool_schema(
            name="Campus Data",
            description="Resolve Final Year Project campus data requests",
            input_schema='{"type": "object", "properties": {"x": {"type": "string"}}',
            output_schema='{"type": "object"}',
        )
