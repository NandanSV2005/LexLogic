from typing import Optional
from sqlalchemy.orm import Session
from app.models.request import CaseTimelineEvent


def log_timeline_event(
    db: Session,
    request_id: int,
    event_type: str,
    title: str,
    description: Optional[str] = None,
    actor_id: Optional[int] = None
) -> CaseTimelineEvent:
    """Centralized service to record real backend case activity timeline events."""
    event = CaseTimelineEvent(
        request_id=request_id,
        actor_id=actor_id,
        event_type=event_type,
        title=title,
        description=description,
    )
    db.add(event)
    db.commit()
    db.refresh(event)
    return event
