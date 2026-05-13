from app import models


def test_approve_session_updates_approval(api_client, db_session, create_agent, create_session_record) -> None:
    agent = create_agent(name="NCI Approval Agent")
    session_record = create_session_record(
        session_id="session-approval-001",
        agent_id=agent.id,
        status="paused",
    )

    approval = models.Approval(
        session_id=session_record.session_id,
        agent_id=agent.id,
        tool_id=1,
        tool_name="Weather API",
        status="pending",
    )
    db_session.add(approval)
    db_session.commit()

    response = api_client.post(
        f"/approvals/{session_record.session_id}/approve",
        json={"decided_by": "project-supervisor", "reason": "Approved for review run"},
    )

    assert response.status_code == 200
    assert response.json()["status"] == "approved"


def test_deny_session_terminates_session(api_client, db_session, create_agent, create_session_record) -> None:
    agent = create_agent(name="NCI Deny Agent")
    session_record = create_session_record(
        session_id="session-approval-002",
        agent_id=agent.id,
        status="paused",
    )

    approval = models.Approval(
        session_id=session_record.session_id,
        agent_id=agent.id,
        tool_id=1,
        tool_name="Weather API",
        status="pending",
    )
    db_session.add(approval)
    db_session.commit()

    response = api_client.post(
        f"/approvals/{session_record.session_id}/deny",
        json={"decided_by": "project-supervisor", "reason": "Denied by policy"},
    )

    assert response.status_code == 200
    assert response.json()["status"] == "denied"

    db_session.expire_all()
    updated = db_session.get(models.Session, session_record.id)
    assert updated is not None
    assert updated.status == "terminated"
