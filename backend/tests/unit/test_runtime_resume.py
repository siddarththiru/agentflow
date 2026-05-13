import json

from langchain_core.messages import AIMessage, HumanMessage, SystemMessage, ToolMessage, messages_to_dict
from app import models
from app.agents.runtime import AgentRuntime
from app.agents.tool_adapter import ToolAdapter
from app.schemas import AgentDefinition, AgentDefinitionPolicy, AgentDefinitionTool


class ResumeChatModel:
    def __init__(self) -> None:
        self.bound_tools = []

    def bind_tools(self, tools):
        self.bound_tools = tools
        return self

    def invoke(self, messages):
        if any(isinstance(message, ToolMessage) for message in messages):
            return AIMessage(content="Resumed and completed for National College of Ireland.")
        return AIMessage(content="")


class ResumeGuardModel:
    def invoke(self, _messages):
        return AIMessage(
            content=json.dumps(
                {
                    "risk_level": "low",
                    "intent": "benign",
                    "confidence": 0.9,
                    "explanation": "safe",
                    "categories": {},
                    "clarifying_question": None,
                }
            )
        )


def _definition() -> AgentDefinition:
    return AgentDefinition(
        agent_id=44,
        name="NCI Resume Agent",
        description="Resume test agent for the final project.",
        purpose="Resume approved tool calls safely",
        model="gemini-2.5-flash",
        tools=[
            AgentDefinitionTool(
                id=1,
                name="Weather API",
                description="Weather lookup",
                input_schema={
                    "type": "object",
                    "properties": {"city": {"type": "string"}},
                    "required": ["city"],
                },
                output_schema={"type": "object"},
            )
        ],
        policy=AgentDefinitionPolicy(
            allowed_tool_ids=[1],
            frequency_limit=2,
            require_approval_for_all_tool_calls=False,
            intent_guard_enabled=True,
            intent_guard_action_low="ignore",
            intent_guard_action_medium="clarify",
            intent_guard_action_high="pause_for_approval",
            intent_guard_action_critical="block",
        ),
    )


def test_resume_session_resolves_tool_alias_and_completes(monkeypatch, db_engine, db_session) -> None:
    monkeypatch.setattr("app.database.engine", db_engine)
    monkeypatch.setattr("app.agents.runtime.engine", db_engine)
    monkeypatch.setattr("app.agents.event_logger.engine", db_engine)
    monkeypatch.setattr("app.agents.interception.engine", db_engine)

    executed_tools: list[str] = []

    def fake_execute_tool(*args):
        _, tool_name, params = args
        executed_tools.append(tool_name)
        return {"city": params.get("city", ""), "reply": "Weather is clear"}

    monkeypatch.setattr(ToolAdapter, "execute_tool", fake_execute_tool)

    session_record = models.Session(
        session_id="resume-nci-001",
        agent_id=44,
        status="paused",
        user_input="Please resume the approved request",
        state_snapshot=json.dumps(
            {
                "messages": messages_to_dict(
                    [SystemMessage(content="sys"), HumanMessage(content="Find weather in Dublin")]
                ),
                "pending_tool_call": {
                    "name": "tool_1",
                    "args": {"city": "Dublin"},
                    "id": "call-1",
                },
                "pending_tool_decision": "allow",
                "pending_guard_decision": None,
                "execution_status": "paused",
                "error": None,
            }
        ),
    )
    db_session.add(session_record)
    db_session.add(
        models.Approval(
            session_id="resume-nci-001",
            agent_id=44,
            tool_id=1,
            tool_name="Weather API",
            status="approved",
        )
    )
    db_session.commit()

    runtime = AgentRuntime(_definition(), ResumeChatModel(), db_session, guard_model=ResumeGuardModel())
    result = runtime.resume_session("resume-nci-001")

    db_session.expire_all()
    refreshed = next((row for row in db_session.exec(models.Session.__table__.select()) if row.session_id == "resume-nci-001"), None)

    assert executed_tools == ["Weather API"]
    assert result["status"] == "completed"
    assert "National College of Ireland" in (result["final_output"] or "")
    assert refreshed is not None
    assert refreshed.status == "completed"
