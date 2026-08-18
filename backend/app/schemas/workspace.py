from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel, ConfigDict
from app.schemas.request import ServiceRequestOut, InterestedProviderOut
from app.schemas.document import DocumentOut


class TimelineEventOut(BaseModel):
    id: str
    event_type: str
    title: str
    description: str
    timestamp: datetime


class NextActionOut(BaseModel):
    action_key: str
    title: str
    description: str
    actor_role: str


class WorkspaceSummaryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    request: ServiceRequestOut
    connected_provider: Optional[InterestedProviderOut] = None
    next_action: NextActionOut
    timeline: List[TimelineEventOut]
    documents_count: int
