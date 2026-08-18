from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field
from app.models.appointment import AppointmentStatus


class AppointmentCreate(BaseModel):
    slot_datetime: datetime = Field(..., description="Date and time for scheduled consultation slot")
    purpose: str = Field(..., description="Purpose or title of appointment slot")


class AppointmentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    request_id: int
    provider_id: int
    citizen_id: int
    slot_datetime: datetime
    purpose: str
    status: AppointmentStatus
    created_at: datetime
