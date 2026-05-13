import json

from langchain_core.messages import AIMessage, ToolMessage
from sqlmodel import SQLModel

from app.agents.runtime import AgentRuntime
from app import models
from app.schemas import AgentDefinition, AgentDefinitionPolicy, AgentDefinitionTool


class ScriptedChatModel:
    def __init__(self) -> None:
        self.bound_tools = []

    def bind_tools(self, tools):
        self.bound_tools = tools
        return self

    def invoke(self, messages):
        if any(isinstance(message, ToolMessage) for message in messages):
            return AIMessage(content="National College of Ireland 2026 forecast is clear for project demo day.")

        return AIMessage(
            content="",
            tool_calls=[
                {
                    "name": "tool_1",
                    "args": {"city": "Dublin"},
                    "id": "call-nci-001",
                    "type": "tool_call",
                }
            ],
        )


class GuardModel:
    def invoke(self, _messages):
        return AIMessage(
            content=json.dumps(
                {
                    "risk_level": "low",
                    "intent": "benign",
                    "confidence": 0.95,
                    "explanation": "Normal weather request",
                    "categories": {"policy": "low"},
                    "clarifying_question": None,
                }
            )
        )


def _definition(require_approval: bool) -> AgentDefinition:
    return AgentDefinition(
        agent_id=44,
        name="NCI Runtime Agent",
        description="Runtime system test agent for Final Year Project.",
        purpose="Execute safe tool-driven responses",
        model="gemini-2.5-flash",
        tools=[
            AgentDefinitionTool(
                id=1,
                name="Weather API",
                description="Get weather by city",
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
            frequency_limit=3,
            require_approval_for_all_tool_calls=require_approval,
            intent_guard_enabled=True,
            intent_guard_action_low="ignore",
            intent_guard_action_medium="clarify",
            intent_guard_action_high="pause_for_approval",
            intent_guard_action_critical="block",
        ),
    )


def test_runtime_execute_completes_with_tool_result(monkeypatch, db_engine, db_session) -> None:
    monkeypatch.setattr("app.database.engine", db_engine)
    monkeypatch.setattr("app.agents.event_logger.engine", db_engine)
    monkeypatch.setattr("app.agents.interception.engine", db_engine)
    monkeypatch.setattr("app.agents.runtime.engine", db_engine)
    SQLModel.metadata.create_all(db_engine)

    session_record = models.Session(
        session_id="system-runtime-001",
        agent_id=44,
        status="running",
        user_input="Weather check for National College of Ireland event",
    )
    db_session.add(session_record)
    db_session.commit()

    runtime = AgentRuntime(
        agent_definition=_definition(require_approval=False),
        chat_model=ScriptedChatModel(),
        db_session=db_session,
        guard_model=GuardModel(),
    )

    result = runtime.execute("Get weather update", session_id="system-runtime-001")

    assert result["status"] == "completed"
    assert "National College of Ireland" in (result["final_output"] or "")


def test_runtime_execute_pauses_when_policy_requires_approval(monkeypatch, db_engine, db_session) -> None:
    monkeypatch.setattr("app.database.engine", db_engine)
    monkeypatch.setattr("app.agents.event_logger.engine", db_engine)
    monkeypatch.setattr("app.agents.interception.engine", db_engine)
    monkeypatch.setattr("app.agents.runtime.engine", db_engine)
    SQLModel.metadata.create_all(db_engine)

    session_record = models.Session(
        session_id="system-runtime-002",
        agent_id=44,
        status="running",
        user_input="Need weather before final presentation",
    )
    db_session.add(session_record)
    db_session.commit()

    runtime = AgentRuntime(
        agent_definition=_definition(require_approval=True),
        chat_model=ScriptedChatModel(),
        db_session=db_session,
        guard_model=GuardModel(),
    )

    result = runtime.execute("Weather before demo", session_id="system-runtime-002")

    assert result["status"] == "paused"
    assert runtime.last_state_snapshot is not None
