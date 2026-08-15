from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.api.deps import require_admin
from app.models.user import User
from app.models.audit import AuditLog
from app.schemas.audit import AuditLogOut

router = APIRouter(prefix="/audit", tags=["Security Audit Logs"])


@router.get(
    "",
    response_model=List[AuditLogOut],
    status_code=status.HTTP_200_OK,
    summary="Get security audit log history (Admin Only)",
    description="Returns security audit log history with filtering capabilities. Restricted strictly to Admin accounts."
)
def get_audit_logs(
    action: Optional[str] = Query(None, description="Filter by audit action name"),
    user_id: Optional[int] = Query(None, description="Filter by user ID"),
    resource_type: Optional[str] = Query(None, description="Filter by resource type"),
    start_date: Optional[datetime] = Query(None, description="Filter by start timestamp"),
    end_date: Optional[datetime] = Query(None, description="Filter by end timestamp"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    admin_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
) -> List[AuditLogOut]:
    query = db.query(AuditLog)

    if action:
        query = query.filter(AuditLog.action == action)
    if user_id is not None:
        query = query.filter(AuditLog.user_id == user_id)
    if resource_type:
        query = query.filter(AuditLog.resource_type == resource_type)
    if start_date:
        query = query.filter(AuditLog.timestamp >= start_date)
    if end_date:
        query = query.filter(AuditLog.timestamp <= end_date)

    logs = query.order_by(AuditLog.timestamp.desc()).offset(skip).limit(limit).all()
    return logs
