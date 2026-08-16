from datetime import datetime, timezone
import enum
from typing import Optional, List, TYPE_CHECKING
from sqlalchemy import String, Float, Boolean, DateTime, Enum as SQLEnum, ForeignKey, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base
from app.models.provider import ProviderType

if TYPE_CHECKING:
    from app.models.user import User
    from app.models.provider import Provider



class RequestStatus(str, enum.Enum):
    OPEN = "OPEN"
    MATCHED = "MATCHED"
    CONTACTED = "CONTACTED"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"


class InteractionStatus(str, enum.Enum):
    PENDING = "PENDING"
    CONTACTED = "CONTACTED"
    ACCEPTED = "ACCEPTED"
    DECLINED = "DECLINED"


class RequestUrgency(str, enum.Enum):
    NORMAL = "NORMAL"
    HIGH = "HIGH"
    URGENT = "URGENT"


class ServiceRequest(Base):
    """Citizen service request model supporting service-first description and legal-aid interest."""
    __tablename__ = "service_requests"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    citizen_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    service_category: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    location: Mapped[str] = mapped_column(String(255), nullable=False)
    preferred_provider_type: Mapped[ProviderType] = mapped_column(SQLEnum(ProviderType), nullable=False)
    urgency: Mapped[RequestUrgency] = mapped_column(SQLEnum(RequestUrgency), default=RequestUrgency.NORMAL, nullable=False)
    legal_aid_interest: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    status: Mapped[RequestStatus] = mapped_column(
        SQLEnum(RequestStatus), default=RequestStatus.OPEN, nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False
    )

    # Relationships
    citizen: Mapped["User"] = relationship("User", foreign_keys=[citizen_id], back_populates="service_requests")
    provider_interactions: Mapped[List["RequestProvider"]] = relationship(
        "RequestProvider", back_populates="request", cascade="all, delete-orphan"
    )


class RequestProvider(Base):
    """Relationship interaction model between ServiceRequests and Providers."""
    __tablename__ = "request_providers"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    request_id: Mapped[int] = mapped_column(ForeignKey("service_requests.id"), nullable=False, index=True)
    provider_id: Mapped[int] = mapped_column(ForeignKey("providers.id"), nullable=False, index=True)
    status: Mapped[InteractionStatus] = mapped_column(
        SQLEnum(InteractionStatus), default=InteractionStatus.PENDING, nullable=False
    )
    response_time_seconds: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    requested_documents: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False
    )

    __table_args__ = (
        UniqueConstraint("request_id", "provider_id", name="uq_request_provider"),
    )

    # Relationships
    request: Mapped["ServiceRequest"] = relationship("ServiceRequest", back_populates="provider_interactions")
    provider: Mapped["Provider"] = relationship("Provider", back_populates="request_interactions")
