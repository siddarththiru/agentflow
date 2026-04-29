import json
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlmodel import Session, select

from app.database import get_session
from app import models
from app.repository.log_repository import LogRepository

router = APIRouter(prefix="/approvals", tags=["approvals"])

class ApprovalDecisionRequest(BaseModel):
    decided_by: str = "system"  # Placeholder for future authentication
    reason: Optional[str] = None

class ApprovalResponse(BaseModel):
    id: int
    session_id: str
    agent_id: int
    tool_id: Optional[int] = None
    tool_name: str
    status: str
    requested_at: datetime
    decided_at: Optional[datetime] = None
    decided_by: Optional[str] = None
    decision_reason: Optional[str] = None
    approval_type: str = "Policy Approval"

    class Config:
        orm_mode = True

def _get_session_or_404(session_id: str, db: Session) -> models.Session:
    stmt = select(models.Session).where(models.Session.session_id == session_id)
    session_record = db.exec(stmt).first()
    if not session_record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Session {session_id} not found"
        )
    return session_record

def _get_approval_or_404(session_id: str, db: Session) -> models.Approval:
    stmt = select(models.Approval).where(models.Approval.session_id == session_id)
    approval = db.exec(stmt).first()
    if not approval:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No approval found for session {session_id}"
        )
    return approval



def _approval_type(approval: models.Approval) -> str:
    return "Safety Approval" if approval.tool_name == "Intent Guard" else "Policy Approval"

def _log_approval_decision(
    session_id: str,
    agent_id: int,
    decision: str,
    decided_by: str,
    reason: Optional[str],
    db: Session
) -> None:
    repo = LogRepository(db)
    event_data = {
        "decision": decision,
        "decided_by": decided_by,
        "timestamp": datetime.utcnow().isoformat(),
        "reason": reason
    }
    
    log = models.Log(
        session_id=session_id,
        agent_id=agent_id,
        event_type="approval_decision",
        event_data=json.dumps(event_data),
        timestamp=datetime.utcnow()
    )
    db.add(log)
    db.commit()

@router.get("", response_model=List[ApprovalResponse])
def list_approvals(
    status_filter: Optional[str] = None,
    agent_id: Optional[int] = None,
    limit: int = 100,
    db: Session = Depends(get_session)
) -> List[ApprovalResponse]:
    stmt = select(models.Approval)
    
    if status_filter:
        if status_filter not in ["pending", "approved", "denied"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid status. Must be pending, approved, or denied"
            )
        stmt = stmt.where(models.Approval.status == status_filter)
    
    if agent_id:
        stmt = stmt.where(models.Approval.agent_id == agent_id)
    
    stmt = stmt.limit(limit).order_by(models.Approval.requested_at.desc())
    
    approvals = db.exec(stmt).all()
    
    # Convert to response model with approval type
    results = []
    for approval in approvals:
        result = ApprovalResponse.from_orm(approval)
        result.approval_type = _approval_type(approval)
        results.append(result)
    
    return results

@router.get("/{session_id}", response_model=ApprovalResponse)
def get_approval(
    session_id: str,
    db: Session = Depends(get_session)
) -> ApprovalResponse:
    # Verify session exists
    _get_session_or_404(session_id, db)
    
    # Get approval
    approval = _get_approval_or_404(session_id, db)
    
    result = ApprovalResponse.from_orm(approval)
    result.approval_type = _approval_type(approval)
    return result

@router.post("/{session_id}/approve", response_model=ApprovalResponse)
def approve_session(
    session_id: str,
    decision: ApprovalDecisionRequest,
    db: Session = Depends(get_session)
) -> ApprovalResponse:
    # Verify session exists and is paused
    session_record = _get_session_or_404(session_id, db)
    if session_record.status != "paused":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Session {session_id} is not paused (status: {session_record.status})"
        )
    
    # Get approval record
    approval = _get_approval_or_404(session_id, db)
    
    # Idempotency: if already approved, return current state
    if approval.status == "approved":
        result = ApprovalResponse.from_orm(approval)
        result.approval_type = _approval_type(approval)
        return result
    
    # Cannot approve if already denied
    if approval.status == "denied":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot approve a denied session"
        )
    
    # Update approval record
    approval.status = "approved"
    approval.decided_at = datetime.utcnow()
    approval.decided_by = decision.decided_by
    approval.decision_reason = decision.reason
    
    db.add(approval)
    db.commit()
    db.refresh(approval)
    
    # Log decision
    _log_approval_decision(
        session_id=session_id,
        agent_id=approval.agent_id,
        decision="approved",
        decided_by=decision.decided_by,
        reason=decision.reason,
        db=db
    )
    
    # Return enriched response
    result = ApprovalResponse.from_orm(approval)
    result.approval_type = _approval_type(approval)
    return result

@router.post("/{session_id}/deny", response_model=ApprovalResponse)
def deny_session(
    session_id: str,
    decision: ApprovalDecisionRequest,
    db: Session = Depends(get_session)
) -> ApprovalResponse:
    # Verify session exists
    session_record = _get_session_or_404(session_id, db)
    
    # Get approval record
    approval = _get_approval_or_404(session_id, db)
    
    # Idempotency: if already denied, return current state
    if approval.status == "denied":
        result = ApprovalResponse.from_orm(approval)
        result.approval_type = _approval_type(approval)
        return result
    
    # Session must be paused to deny
    if session_record.status != "paused":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Session {session_id} is not paused (status: {session_record.status})"
        )
    
    # Cannot deny if already approved
    if approval.status == "approved":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot deny an approved session"
        )
    
    # Update approval record
    approval.status = "denied"
    approval.decided_at = datetime.utcnow()
    approval.decided_by = decision.decided_by
    approval.decision_reason = decision.reason
    
    db.add(approval)
    
    # Update session status
    session_record.status = "terminated"
    session_record.updated_at = datetime.utcnow()
    db.add(session_record)
    
    db.commit()
    db.refresh(approval)
    
    # Log decision
    _log_approval_decision(
        session_id=session_id,
        agent_id=approval.agent_id,
        decision="denied",
        decided_by=decision.decided_by,
        reason=decision.reason,
        db=db
    )
    
    # Log session end
    repo = LogRepository(db)
    log = models.Log(
        session_id=session_id,
        agent_id=approval.agent_id,
        event_type="session_end",
        event_data=json.dumps({
            "status": "terminated",
            "reason": "approval_denied",
            "decided_by": decision.decided_by
        }),
        timestamp=datetime.utcnow()
    )
    db.add(log)
    db.commit()
    
    # Return enriched response
    result = ApprovalResponse.from_orm(approval)
    result.approval_type = _approval_type(approval)
    return result
