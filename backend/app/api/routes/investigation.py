from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlmodel import Session

from app.database import get_session
from app.services.investigation_service import InvestigationService

router = APIRouter(prefix="/investigation", tags=["investigation"])

def _get_service(db: Session = Depends(get_session)) -> InvestigationService:
    return InvestigationService(db)

@router.get("/sessions")
def list_sessions(
    agent_id: Optional[int] = Query(None),
    status: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    service: InvestigationService = Depends(_get_service),
) -> dict:
    return service.list_sessions(agent_id=agent_id, status=status, limit=limit, offset=offset)

@router.get("/sessions/{session_id}")
def get_session_detail(
    session_id: str,
    service: InvestigationService = Depends(_get_service),
) -> dict:
    result = service.get_session(session_id)
    if result is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Session {session_id} not found",
        )
    return result

@router.get("/sessions/{session_id}/events")
def get_session_events(
    session_id: str,
    service: InvestigationService = Depends(_get_service),
) -> dict:
    result = service.get_session_timeline(session_id)
    if result is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Session {session_id} not found",
        )
    return result

@router.get("/agents/{agent_id}/activity")
def get_agent_activity(
    agent_id: int,
    limit: int = Query(50, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    service: InvestigationService = Depends(_get_service),
) -> dict:
    result = service.get_agent_activity(agent_id=agent_id, limit=limit, offset=offset)
    if result is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Agent {agent_id} not found",
        )
    return result

@router.get("/classifications")
def list_classifications(
    agent_id: Optional[int] = Query(None),
    session_id: Optional[str] = Query(None),
    risk_level: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    service: InvestigationService = Depends(_get_service),
) -> dict:
    return service.list_classifications(
        agent_id=agent_id,
        session_id=session_id,
        risk_level=risk_level,
        limit=limit,
        offset=offset,
    )

@router.get("/approvals")
def list_approvals(
    agent_id: Optional[int] = Query(None),
    session_id: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    service: InvestigationService = Depends(_get_service),
) -> dict:
    return service.list_approvals(
        agent_id=agent_id,
        session_id=session_id,
        status=status,
        limit=limit,
        offset=offset,
    )