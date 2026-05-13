def test_register_tool_and_set_usable(api_client) -> None:
    payload = {
        "name": "NCI Campus Events API",
        "description": "Fetches event details for National College of Ireland project activities",
        "input_schema": '{"type":"object","properties":{"event_id":{"type":"string"}},"required":["event_id"]}',
        "output_schema": '{"type":"object","properties":{"title":{"type":"string"}}}',
    }

    create_resp = api_client.post("/tools", json=payload)
    assert create_resp.status_code == 201
    tool_id = create_resp.json()["id"]

    list_resp = api_client.get("/tools")
    assert list_resp.status_code == 200
    assert any(tool["id"] == tool_id for tool in list_resp.json())

    set_unusable_resp = api_client.patch(f"/tools/{tool_id}/usable?usable=false")
    assert set_unusable_resp.status_code == 200
    assert set_unusable_resp.json()["usable"] is False


def test_get_tool_returns_404_when_missing(api_client) -> None:
    response = api_client.get("/tools/999999")

    assert response.status_code == 404


def test_register_tool_rejects_duplicate_name(api_client) -> None:
    payload = {
        "name": "NCI Duplicate Tool",
        "description": "Used to test duplicate validation for Final Year Project tool registration",
        "input_schema": '{"type":"object","properties":{"query":{"type":"string"}},"required":["query"]}',
        "output_schema": '{"type":"object"}',
    }

    first = api_client.post("/tools", json=payload)
    second = api_client.post("/tools", json=payload)

    assert first.status_code == 201
    assert second.status_code == 400
