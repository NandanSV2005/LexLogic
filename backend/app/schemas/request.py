from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field
from app.models.provider import ProviderType
from app.models.request import RequestStatus, InteractionStatus, RequestUrgency


class ServiceRequestCreate(BaseModel):
    service_category: str = Field(..., json_schema_extra={"example": "Property dispute"})
    description: str = Field(..., json_schema_extra={"example": "Need legal assistance regarding boundary dispute with neighbor."})
    location: str = Field(..., json_schema_extra={"example": "New Delhi"})
    preferred_provider_type: ProviderType = Field(default=ProviderType.ADVOCATE)
    urgency: RequestUrgency = Field(default=RequestUrgency.NORMAL)
    legal_aid_interest: bool = Field(default=False, description="Flag indicating potential eligibility/interest in legal aid")


class ServiceRequestUpdateStatus(BaseModel):
    status: RequestStatus


class ServiceRequestOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    citizen_id: int
    service_category: str
    description: str
    location: str
    preferred_provider_type: ProviderType
    urgency: RequestUrgency
    legal_aid_interest: bool
    status: RequestStatus
    completion_note: Optional[str] = None
    dispute_reason: Optional[str] = None
    accepted_provider_id: Optional[int] = None
    accepted_provider_name: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class RequestProviderOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    request_id: int
    provider_id: int
    status: InteractionStatus
    response_time_seconds: Optional[float] = None
    requested_documents: Optional[str] = None
    created_at: datetime


class DocumentRequestInput(BaseModel):
    requested_documents: str = Field(..., description="Comma-separated or bullet list of requested documents/information")
    reason: Optional[str] = Field(None, description="Reason for document request")


class InterestedProviderOut(BaseModel):
    provider_id: int
    full_name: str
    provider_type: ProviderType
    phone: Optional[str] = None
    location: Optional[str] = None
    experience_years: int
    bio: Optional[str] = None
    rating: float
    verification_status: str
    reliability_score: float
    interaction_status: InteractionStatus
    requested_documents: Optional[str] = None


class CaseTimelineEventOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    request_id: int
    actor_id: Optional[int] = None
    event_type: str
    title: str
    description: Optional[str] = None
    created_at: datetime


class CaseMilestoneOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    request_id: int
    milestone_name: str
    status: str
    completed_at: Optional[datetime] = None
    notes: Optional[str] = None
    created_at: datetime


class CaseMilestoneUpdateInput(BaseModel):
    status: str = Field(..., description="Target milestone status: PENDING | IN_PROGRESS | COMPLETED")
    notes: Optional[str] = Field(None, description="Optional milestone update note")


class CaseUpdateInput(BaseModel):
    update_text: str = Field(..., description="Content of structured case update")


class CaseUpdateOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    request_id: int
    author_id: int
    author_role: str
    update_text: str
    created_at: datetime


class CaseCompletionNoteInput(BaseModel):
    completion_note: str = Field(..., description="Provider completion note describing work completed")


class CaseDisputeInput(BaseModel):
    dispute_reason: str = Field(..., description="Reason for reporting an issue or disputing completion")


class CaseSummaryOut(BaseModel):
    request_id: int
    legal_need: str
    description: str
    provider_name: Optional[str] = None
    provider_profession: Optional[str] = None
    service_category: str
    start_date: str
    completion_date: Optional[str] = None
    documents_exchanged_count: int
    appointment_count: int
    timeline_events: List[CaseTimelineEventOut]
    final_completion_note: Optional[str] = None
    final_status: str
