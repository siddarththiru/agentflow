from collections.abc import Iterator
import os
from sqlalchemy import text
from sqlmodel import Session, SQLModel, create_engine

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./agent_builder.db")
engine = create_engine(
    DATABASE_URL,
    echo=False,
    connect_args={"check_same_thread": False},
)

def get_db_url() -> str:
    return DATABASE_URL


def get_session() -> Iterator[Session]:
    with Session(engine) as session:
        yield session


def init_db() -> None:
    SQLModel.metadata.create_all(engine)
    _ensure_sqlite_columns()


def _ensure_sqlite_columns() -> None:
    if not DATABASE_URL.startswith("sqlite"):
        return

    table_columns = {
        "policies": {
            "intent_guard_enabled": "BOOLEAN DEFAULT 1",
            "intent_guard_model_mode": "VARCHAR DEFAULT 'dedicated'",
            "intent_guard_model": "VARCHAR DEFAULT 'gemini-2.5-flash'",
            "intent_guard_include_conversation": "BOOLEAN DEFAULT 1",
            "intent_guard_include_tool_args": "BOOLEAN DEFAULT 0",
            "intent_guard_risk_tolerance": "VARCHAR DEFAULT 'balanced'",
            "intent_guard_action_low": "VARCHAR DEFAULT 'ignore'",
            "intent_guard_action_medium": "VARCHAR DEFAULT 'clarify'",
            "intent_guard_action_high": "VARCHAR DEFAULT 'pause_for_approval'",
            "intent_guard_action_critical": "VARCHAR DEFAULT 'block'",
        },
        "agent_tools": {
            "guard_enabled": "BOOLEAN",
            "guard_include_tool_args": "BOOLEAN",
            "guard_action_low": "VARCHAR",
            "guard_action_medium": "VARCHAR",
            "guard_action_high": "VARCHAR",
            "guard_action_critical": "VARCHAR",
        },
    }

    with engine.begin() as connection:
        for table_name, columns in table_columns.items():
            existing = {
                row[1]
                for row in connection.execute(text(f"PRAGMA table_info({table_name})")).fetchall()
            }
            if not existing:
                continue
            for column_name, column_type in columns.items():
                if column_name not in existing:
                    connection.execute(
                        text(f"ALTER TABLE {table_name} ADD COLUMN {column_name} {column_type}")
                    )
