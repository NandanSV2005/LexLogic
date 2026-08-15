from typing import Optional
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
    created_at: datetime
    updated_at: datetime


class RequestProviderOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    request_id: int
    provider_id: int
    status: InteractionStatus
    response_time_seconds: Optional[float] = None
    created_at: datetime
