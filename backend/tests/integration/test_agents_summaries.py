from app import models


def test_list_agents_includes_session_and_pending_approval_counts(api_client, db_session, create_tool) -> None:
    tool = create_tool(name="NCI Summary Tool")
    agent_resp = api_client.post(
        "/agents",
        json={
            "name": "NCI Summary Agent",
            "description": "Agent used for summary calculations in integration tests",
            "purpose": "Summarize status for Final Year Project",
            "model": "gemini-2.5-flash",
        },
    )
    agent_id = agent_resp.json()["id"]

    api_client.post(f"/agents/{agent_id}/tools", json={"tool_ids": [tool.id]})

    session_resp = api_client.post(f"/agents/{agent_id}/sessions")
    session_id = session_resp.json()["session_id"]

    pending = models.Approval(
        session_id=session_id,
        agent_id=agent_id,
        tool_id=tool.id,
        tool_name=tool.name,
        status="pending",
    )
    db_session.add(pending)
    db_session.commit()

    response = api_client.get("/agents")

    assert response.status_code == 200
    summaries = response.json()
    summary = next(item for item in summaries if item["id"] == agent_id)
    assert summary["sessions_count"] >= 1
    assert summary["tools_count"] == 1
    assert summary["pending_approvals"] >= 1
