from datetime import datetime, timezone
import enum
from typing import Optional, List, Dict, Any, TYPE_CHECKING
from sqlalchemy import String, Integer, Float, Boolean, DateTime, Enum as SQLEnum, ForeignKey, JSON, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base

if TYPE_CHECKING:
    from app.models.user import User
    from app.models.request import RequestProvider
    from app.models.points import PointTransaction



class ProviderType(str, enum.Enum):
    ADVOCATE = "ADVOCATE"
    ARBITRATOR = "ARBITRATOR"
    MEDIATOR = "MEDIATOR"
    NOTARY = "NOTARY"
    DOCUMENT_WRITER = "DOCUMENT_WRITER"


class VerificationStatus(str, enum.Enum):
    PENDING = "PENDING"
    SUBMITTED = "SUBMITTED"
    VERIFIED = "VERIFIED"
    REJECTED = "REJECTED"


class AvailabilityStatus(str, enum.Enum):
    AVAILABLE = "AVAILABLE"
    BUSY = "BUSY"
    UNAVAILABLE = "UNAVAILABLE"


class Provider(Base):
    __tablename__ = "providers"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), unique=True, nullable=False, index=True)
    provider_type: Mapped[ProviderType] = mapped_column(SQLEnum(ProviderType), nullable=False)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    phone: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    location: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    experience_years: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    bio: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    verification_status: Mapped[VerificationStatus] = mapped_column(
        SQLEnum(VerificationStatus), default=VerificationStatus.PENDING, nullable=False
    )
    profile_completion_percentage: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    points: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    reliability_score: Mapped[float] = mapped_column(Float, default=100.0, nullable=False)
    rating: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    response_rate: Mapped[float] = mapped_column(Float, default=100.0, nullable=False)
    completed_requests: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    total_requests: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    availability_status: Mapped[AvailabilityStatus] = mapped_column(
        SQLEnum(AvailabilityStatus), default=AvailabilityStatus.AVAILABLE, nullable=False
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
    user: Mapped["User"] = relationship("User", back_populates="provider")
    field_values: Mapped[List["ProviderFieldValue"]] = relationship(
        "ProviderFieldValue", back_populates="provider", cascade="all, delete-orphan"
    )
    request_interactions: Mapped[List["RequestProvider"]] = relationship(
        "RequestProvider", back_populates="provider", cascade="all, delete-orphan"
    )
    point_transactions: Mapped[List["PointTransaction"]] = relationship(
        "PointTransaction", back_populates="provider", cascade="all, delete-orphan"
    )

    @property
    def is_profile_complete(self) -> bool:
        return self.profile_completion_percentage >= 100.0



class ProviderFieldDefinition(Base):
    """Generic field schema definitions configured per ProviderType."""
    __tablename__ = "provider_field_definitions"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    provider_type: Mapped[ProviderType] = mapped_column(SQLEnum(ProviderType), nullable=False, index=True)
    field_name: Mapped[str] = mapped_column(String(100), nullable=False)
    field_label: Mapped[str] = mapped_column(String(255), nullable=False)
    field_type: Mapped[str] = mapped_column(String(50), default="text", nullable=False)  # e.g., text, select, multiselect, number
    is_required: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    options_json: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON, nullable=True)

    __table_args__ = (
        UniqueConstraint("provider_type", "field_name", name="uq_provider_type_field_name"),
    )

    values: Mapped[List["ProviderFieldValue"]] = relationship(
        "ProviderFieldValue", back_populates="field_definition", cascade="all, delete-orphan"
    )


class ProviderFieldValue(Base):
    """Generic field values assigned to specific Provider profiles."""
    __tablename__ = "provider_field_values"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    provider_id: Mapped[int] = mapped_column(ForeignKey("providers.id"), nullable=False, index=True)
    field_definition_id: Mapped[int] = mapped_column(ForeignKey("provider_field_definitions.id"), nullable=False, index=True)
    value: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    __table_args__ = (
        UniqueConstraint("provider_id", "field_definition_id", name="uq_provider_field_val"),
    )

    provider: Mapped["Provider"] = relationship("Provider", back_populates="field_values")
    field_definition: Mapped["ProviderFieldDefinition"] = relationship("ProviderFieldDefinition", back_populates="values")
