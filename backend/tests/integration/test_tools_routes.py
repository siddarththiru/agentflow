def test_validate_tool_schema_success(tools_api_client) -> None:
    payload = {
        "name": "Campus Event Lookup",
        "description": "Fetch event details for National College of Ireland 2026 activities",
        "input_schema": '{"type":"object","properties":{"event_code":{"type":"string"}},"required":["event_code"]}',
        "output_schema": '{"type":"object","properties":{"status":{"type":"string"}}}',
    }

    response = tools_api_client.post("/tools/validate", json=payload)

    assert response.status_code == 200
    body = response.json()
    assert body["valid"] is True
    assert body["name"] == payload["name"]


def test_validate_tool_schema_failure(tools_api_client) -> None:
    payload = {
        "name": "Broken Schema Tool",
        "description": "Validation request with malformed schema to test API contract",
        "input_schema": '{"type": "object", "properties": {"x": {"type": "string"}}',
        "output_schema": '{"type":"object"}',
    }

    response = tools_api_client.post("/tools/validate", json=payload)

    assert response.status_code == 200
    body = response.json()
    assert body["valid"] is False
    assert len(body["errors"]) >= 1
