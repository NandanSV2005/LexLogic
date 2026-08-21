from datetime import datetime, timezone
import enum
from typing import Optional, List, TYPE_CHECKING
from sqlalchemy import String, Float, Boolean, DateTime, Enum as SQLEnum, ForeignKey, Text, UniqueConstraint, Integer
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
    DOCUMENTS_SUBMITTED = "DOCUMENTS_SUBMITTED"
    DOCUMENTS_REVIEWED = "DOCUMENTS_REVIEWED"
    ADDITIONAL_INFORMATION_REQUIRED = "ADDITIONAL_INFORMATION_REQUIRED"
    READY_FOR_SERVICE = "READY_FOR_SERVICE"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETION_REQUESTED = "COMPLETION_REQUESTED"
    COMPLETION_PENDING = "COMPLETION_PENDING"
    COMPLETED = "COMPLETED"
    COMPLETION_DISPUTED = "COMPLETION_DISPUTED"
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
    completion_note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    dispute_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

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
    timeline_events: Mapped[List["CaseTimelineEvent"]] = relationship(
        "CaseTimelineEvent", back_populates="request", cascade="all, delete-orphan"
    )
    milestones: Mapped[List["CaseMilestone"]] = relationship(
        "CaseMilestone", back_populates="request", cascade="all, delete-orphan"
    )
    case_updates: Mapped[List["CaseUpdate"]] = relationship(
        "CaseUpdate", back_populates="request", cascade="all, delete-orphan"
    )

    @property
    def accepted_interaction(self) -> Optional["RequestProvider"]:
        if not self.provider_interactions:
            return None
        for inter in self.provider_interactions:
            if inter.status == InteractionStatus.ACCEPTED:
                return inter
        return None

    @property
    def accepted_provider_id(self) -> Optional[int]:
        inter = self.accepted_interaction
        return inter.provider_id if inter else None

    @property
    def accepted_provider_name(self) -> Optional[str]:
        inter = self.accepted_interaction
        return inter.provider.full_name if (inter and inter.provider) else None


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


class CaseTimelineEvent(Base):
    """Real backend event log for case activity timeline."""
    __tablename__ = "case_timeline_events"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    request_id: Mapped[int] = mapped_column(ForeignKey("service_requests.id"), nullable=False, index=True)
    actor_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"), nullable=True)
    event_type: Mapped[str] = mapped_column(String(100), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )

    request: Mapped["ServiceRequest"] = relationship("ServiceRequest", back_populates="timeline_events")


class CaseMilestone(Base):
    """Provider-reported service milestones for cases in progress."""
    __tablename__ = "case_milestones"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    request_id: Mapped[int] = mapped_column(ForeignKey("service_requests.id"), nullable=False, index=True)
    milestone_name: Mapped[str] = mapped_column(String(255), nullable=False)
    status: Mapped[str] = mapped_column(String(50), default="PENDING", nullable=False)  # PENDING, IN_PROGRESS, COMPLETED
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )

    request: Mapped["ServiceRequest"] = relationship("ServiceRequest", back_populates="milestones")


class CaseUpdate(Base):
    """Lightweight structured case activity update posted by provider or citizen."""
    __tablename__ = "case_updates"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    request_id: Mapped[int] = mapped_column(ForeignKey("service_requests.id"), nullable=False, index=True)
    author_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    author_role: Mapped[str] = mapped_column(String(50), nullable=False)  # PROVIDER, CITIZEN
    update_text: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )

    request: Mapped["ServiceRequest"] = relationship("ServiceRequest", back_populates="case_updates")
