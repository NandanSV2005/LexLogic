from datetime import datetime, timezone
import enum
from typing import Optional, TYPE_CHECKING
from sqlalchemy import String, Integer, DateTime, Enum as SQLEnum, ForeignKey, Boolean, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base

if TYPE_CHECKING:
    from app.models.request import ServiceRequest
    from app.models.provider import Provider
    from app.models.user import User


class AppointmentStatus(str, enum.Enum):
    REQUESTED = "REQUESTED"
    CONFIRMED = "CONFIRMED"
    SCHEDULED = "SCHEDULED"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"
    DECLINED = "DECLINED"


class Appointment(Base):
    """Appointment booking model bound to service request and provider availability schedule."""
    __tablename__ = "appointments"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    request_id: Mapped[int] = mapped_column(ForeignKey("service_requests.id"), nullable=False, index=True)
    provider_id: Mapped[int] = mapped_column(ForeignKey("providers.id"), nullable=False, index=True)
    citizen_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)

    slot_datetime: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    end_datetime: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    duration_minutes: Mapped[int] = mapped_column(Integer, default=30, nullable=False)
    purpose: Mapped[str] = mapped_column(String(255), nullable=False)
    status: Mapped[AppointmentStatus] = mapped_column(
        SQLEnum(AppointmentStatus), default=AppointmentStatus.REQUESTED, nullable=False
    )
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    decline_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )

    request: Mapped["ServiceRequest"] = relationship("ServiceRequest", foreign_keys=[request_id])
    provider: Mapped["Provider"] = relationship("Provider", foreign_keys=[provider_id])
    citizen: Mapped["User"] = relationship("User", foreign_keys=[citizen_id])


class ProviderAvailabilitySchedule(Base):
    """Configurable weekly availability schedule for a provider."""
    __tablename__ = "provider_availability_schedules"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    provider_id: Mapped[int] = mapped_column(ForeignKey("providers.id"), nullable=False, index=True)
    day_of_week: Mapped[int] = mapped_column(Integer, nullable=False)  # 0=Monday ... 6=Sunday
    start_time: Mapped[str] = mapped_column(String(10), nullable=False)  # e.g. "10:00"
    end_time: Mapped[str] = mapped_column(String(10), nullable=False)    # e.g. "13:00"
    is_available: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    __table_args__ = (
        UniqueConstraint("provider_id", "day_of_week", "start_time", name="uq_provider_schedule_slot"),
    )


class ProviderBlockedDate(Base):
    """Specific dates when provider is unavailable."""
    __tablename__ = "provider_blocked_dates"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    provider_id: Mapped[int] = mapped_column(ForeignKey("providers.id"), nullable=False, index=True)
    blocked_date: Mapped[str] = mapped_column(String(20), nullable=False)  # "YYYY-MM-DD"
    reason: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    __table_args__ = (
        UniqueConstraint("provider_id", "blocked_date", name="uq_provider_blocked_date"),
    )
