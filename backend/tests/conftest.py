from collections.abc import Iterator
from pathlib import Path
import sys
import json
from typing import Callable
# pylint: disable=redefined-outer-name

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy.pool import StaticPool
from sqlmodel import Session, SQLModel, create_engine


BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app import models
from app.api.routes import agents as agents_routes
from app.api.routes import approvals as approvals_routes
from app.api.routes import logs as logs_routes
from app.api.routes import sessions as sessions_routes
from app.api.routes import tools as tools_routes
from app.database import get_session


@pytest.fixture()
def db_engine():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SQLModel.metadata.create_all(engine)
    return engine


@pytest.fixture()
def db_session(db_engine) -> Iterator[Session]:
    with Session(db_engine) as session:
        yield session


@pytest.fixture()
def tools_api_client(db_engine) -> Iterator[TestClient]:
    app = FastAPI()
    app.include_router(tools_routes.router)

    def override_get_session() -> Iterator[Session]:
        with Session(db_engine) as session:
            yield session

    app.dependency_overrides[tools_routes.get_session] = override_get_session

    with TestClient(app) as client:
        yield client

    app.dependency_overrides.clear()


@pytest.fixture()
def api_client(db_engine) -> Iterator[TestClient]:
    app = FastAPI()
    app.include_router(agents_routes.router)
    app.include_router(sessions_routes.router)
    app.include_router(tools_routes.router)
    app.include_router(logs_routes.router)
    app.include_router(approvals_routes.router)

    def override_get_session() -> Iterator[Session]:
        with Session(db_engine) as session:
            yield session

    app.dependency_overrides[get_session] = override_get_session

    with TestClient(app) as client:
        yield client

    app.dependency_overrides.clear()


@pytest.fixture()
def create_tool(db_session) -> Callable[..., models.Tool]:
    def _create_tool(
        *,
        name: str = "Weather API",
        description: str = "Provides weather details for a city in Ireland.",
        input_schema: dict | None = None,
        output_schema: dict | None = None,
    ) -> models.Tool:
        tool = models.Tool(
            name=name,
            description=description,
            input_schema=json.dumps(
                input_schema
                or {
                    "type": "object",
                    "properties": {"city": {"type": "string"}},
                    "required": ["city"],
                }
            ),
            output_schema=json.dumps(output_schema or {"type": "object"}),
            usable=True,
        )
        db_session.add(tool)
        db_session.commit()
        db_session.refresh(tool)
        return tool

    return _create_tool


@pytest.fixture()
def create_agent(db_session) -> Callable[..., models.Agent]:
    def _create_agent(
        *,
        name: str = "NCI Operations Assistant",
        description: str = "Supports National College of Ireland operations queries.",
        purpose: str = "Assist with Final Year Project runtime decisions",
        model: str = "gemini-2.5-flash",
    ) -> models.Agent:
        agent = models.Agent(
            name=name,
            description=description,
            purpose=purpose,
            model=model,
        )
        db_session.add(agent)
        db_session.commit()
        db_session.refresh(agent)
        return agent

    return _create_agent


@pytest.fixture()
def create_session_record(db_session) -> Callable[..., models.Session]:
    def _create_session_record(
        *,
        session_id: str = "session-nci-2026-default",
        agent_id: int,
        status: str = "running",
        user_input: str = "Need update for National College of Ireland Final Year Project",
    ) -> models.Session:
        record = models.Session(
            session_id=session_id,
            agent_id=agent_id,
            status=status,
            user_input=user_input,
        )
        db_session.add(record)
        db_session.commit()
        db_session.refresh(record)
        return record

    return _create_session_record
