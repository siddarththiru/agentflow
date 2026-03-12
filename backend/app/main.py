from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import Session
from dotenv import load_dotenv, find_dotenv

from app.database import engine, get_session, init_db
from app.api.routes import agents, tools, logs, approvals, investigation
from app.seeds import seed_tools

app = FastAPI(title="Agent Builder API", version="0.1.0")

load_dotenv(find_dotenv(), override=False)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(agents.router)
app.include_router(tools.router)
app.include_router(logs.router)
app.include_router(approvals.router)
app.include_router(investigation.router)


@app.on_event("startup")
def on_startup() -> None:
    init_db()
    with Session(engine) as session:
        seed_tools(session)


@app.get("/health")
def healthcheck() -> dict[str, str]:
    return {"status": "ok"}
