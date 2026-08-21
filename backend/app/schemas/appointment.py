from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field
from app.models.appointment import AppointmentStatus


class ScheduleSlotInput(BaseModel):
    day_of_week: int = Field(..., ge=0, le=6, description="0=Monday ... 6=Sunday")
    start_time: str = Field(..., description="Format HH:MM e.g. 10:00")
    end_time: str = Field(..., description="Format HH:MM e.g. 13:00")
    is_available: bool = Field(default=True)


class ProviderAvailabilityScheduleInput(BaseModel):
    schedules: List[ScheduleSlotInput]


class ProviderScheduleSlotOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    provider_id: int
    day_of_week: int
    start_time: str
    end_time: str
    is_available: bool


class ProviderBlockedDateInput(BaseModel):
    blocked_date: str = Field(..., description="Format YYYY-MM-DD e.g. 2026-08-25")
    reason: Optional[str] = Field(None, description="Optional reason for blocking date")


class ProviderBlockedDateOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    provider_id: int
    blocked_date: str
    reason: Optional[str] = None


class AppointmentCreate(BaseModel):
    request_id: Optional[int] = Field(None, description="ID of active service request")
    provider_id: Optional[int] = Field(None, description="ID of provider")
    slot_datetime: datetime = Field(..., description="Date and time for requested appointment slot")
    purpose: str = Field(..., description="Purpose or title of appointment slot")
    duration_minutes: int = Field(default=30, description="Duration in minutes")
    notes: Optional[str] = Field(None, description="Optional notes or details")


class AppointmentDeclineInput(BaseModel):
    decline_reason: str = Field(..., description="Reason for declining appointment request")


class AppointmentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    request_id: int
    provider_id: int
    citizen_id: int
    slot_datetime: datetime
    end_datetime: Optional[datetime] = None
    duration_minutes: int = 30
    purpose: str
    status: AppointmentStatus
    notes: Optional[str] = None
    decline_reason: Optional[str] = None
    created_at: datetime
    provider_name: Optional[str] = None
    citizen_name: Optional[str] = None
    service_category: Optional[str] = None


class AvailableSlotsOut(BaseModel):
    provider_id: int
    date: str
    day_of_week: int
    is_blocked: bool
    blocked_reason: Optional[str] = None
    available_slots: List[str]
