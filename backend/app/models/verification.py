from datetime import datetime, timezone
import enum
from typing import Optional, List, TYPE_CHECKING
from sqlalchemy import String, Integer, DateTime, Enum as SQLEnum, ForeignKey, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base

if TYPE_CHECKING:
    from app.models.user import User
    from app.models.provider import Provider
    from app.models.document import Document


class DetailedVerificationStatus(str, enum.Enum):
    NOT_STARTED = "NOT_STARTED"
    SUBMITTED = "SUBMITTED"
    AUTOMATED_REVIEW = "AUTOMATED_REVIEW"
    MANUAL_REVIEW = "MANUAL_REVIEW"
    VERIFIED = "VERIFIED"
    REJECTED = "REJECTED"
    EXPIRED = "EXPIRED"
    SUSPENDED = "SUSPENDED"


class CredentialType(str, enum.Enum):
    BAR_ENROLLMENT_CERTIFICATE = "BAR_ENROLLMENT_CERTIFICATE"
    BAR_ID_CARD = "BAR_ID_CARD"
    PROPOSITION_CERTIFICATE = "PROPOSITION_CERTIFICATE"
    OTHER = "OTHER"


class EvidenceStatus(str, enum.Enum):
    SUBMITTED = "SUBMITTED"
    VERIFIED = "VERIFIED"
    REJECTED = "REJECTED"
    FLAGGED = "FLAGGED"


class PracticeEvidenceStatus(str, enum.Enum):
    SUBMITTED = "SUBMITTED"
    PENDING_REVIEW = "PENDING_REVIEW"
    VERIFIED = "VERIFIED"
    UNVERIFIED = "UNVERIFIED"
    NEEDS_REVIEW = "NEEDS_REVIEW"


class ProviderVerificationRecord(Base):
    """Core Provider Verification Record managing multi-level verification statuses, history, and admin reviews."""
    __tablename__ = "provider_verification_records"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    provider_id: Mapped[int] = mapped_column(ForeignKey("providers.id"), unique=True, nullable=False, index=True)

    overall_status: Mapped[DetailedVerificationStatus] = mapped_column(
        SQLEnum(DetailedVerificationStatus), default=DetailedVerificationStatus.NOT_STARTED, nullable=False
    )
    identity_status: Mapped[DetailedVerificationStatus] = mapped_column(
        SQLEnum(DetailedVerificationStatus), default=DetailedVerificationStatus.NOT_STARTED, nullable=False
    )
    credential_status: Mapped[DetailedVerificationStatus] = mapped_column(
        SQLEnum(DetailedVerificationStatus), default=DetailedVerificationStatus.NOT_STARTED, nullable=False
    )
    practice_status: Mapped[DetailedVerificationStatus] = mapped_column(
        SQLEnum(DetailedVerificationStatus), default=DetailedVerificationStatus.NOT_STARTED, nullable=False
    )

    last_reviewed_by_admin_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"), nullable=True)
    last_reviewed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    verification_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

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
    provider: Mapped["Provider"] = relationship("Provider", back_populates="verification_record")
    advocate_profile: Mapped[Optional["AdvocateVerificationProfile"]] = relationship(
        "AdvocateVerificationProfile", back_populates="verification_record", uselist=False, cascade="all, delete-orphan"
    )
    history_entries: Mapped[List["ProviderVerificationHistory"]] = relationship(
        "ProviderVerificationHistory", back_populates="verification_record", cascade="all, delete-orphan"
    )


class AdvocateVerificationProfile(Base):
    """Advocate professional credential information (Level 1 & Level 2 verification details)."""
    __tablename__ = "advocate_verification_profiles"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    verification_record_id: Mapped[int] = mapped_column(ForeignKey("provider_verification_records.id"), unique=True, nullable=False, index=True)
    provider_id: Mapped[int] = mapped_column(ForeignKey("providers.id"), nullable=False, index=True)

    # Level 1 Identity Verification Fields
    full_legal_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    jurisdiction_city: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    jurisdiction_state: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

    # Level 2 Professional Credentials (State Bar Council & Enrollment)
    state_bar_council: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    enrollment_number: Mapped[Optional[str]] = mapped_column(String(100), nullable=True, index=True)
    enrollment_year: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    credential_type: Mapped[CredentialType] = mapped_column(
        SQLEnum(CredentialType), default=CredentialType.BAR_ENROLLMENT_CERTIFICATE, nullable=False
    )
    credential_document_id: Mapped[Optional[int]] = mapped_column(ForeignKey("documents.id"), nullable=True)
    credential_verification_status: Mapped[DetailedVerificationStatus] = mapped_column(
        SQLEnum(DetailedVerificationStatus), default=DetailedVerificationStatus.NOT_STARTED, nullable=False
    )
    credential_verified_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    verification_source_reference: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    verification_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

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
    verification_record: Mapped["ProviderVerificationRecord"] = relationship("ProviderVerificationRecord", back_populates="advocate_profile")
    credential_document: Mapped[Optional["Document"]] = relationship("Document")
    case_references: Mapped[List["AdvocateCaseReference"]] = relationship(
        "AdvocateCaseReference", back_populates="advocate_profile", cascade="all, delete-orphan"
    )


class AdvocateCaseReference(Base):
    """Level 3 Practice Verification evidence (Case metadata reference only - NO sensitive files required)."""
    __tablename__ = "advocate_case_references"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    advocate_profile_id: Mapped[int] = mapped_column(ForeignKey("advocate_verification_profiles.id"), nullable=False, index=True)
    provider_id: Mapped[int] = mapped_column(ForeignKey("providers.id"), nullable=False, index=True)

    case_number: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    court_name: Mapped[str] = mapped_column(String(255), nullable=False)
    case_type: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    case_year: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    advocate_role: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

    supporting_document_id: Mapped[Optional[int]] = mapped_column(ForeignKey("documents.id"), nullable=True)
    evidence_status: Mapped[EvidenceStatus] = mapped_column(
        SQLEnum(EvidenceStatus), default=EvidenceStatus.SUBMITTED, nullable=False
    )
    verification_status: Mapped[DetailedVerificationStatus] = mapped_column(
        SQLEnum(DetailedVerificationStatus), default=DetailedVerificationStatus.NOT_STARTED, nullable=False
    )
    evidence_source_reference: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    verification_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    verified_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

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
    advocate_profile: Mapped["AdvocateVerificationProfile"] = relationship("AdvocateVerificationProfile", back_populates="case_references")
    supporting_document: Mapped[Optional["Document"]] = relationship("Document")


class ProviderVerificationHistory(Base):
    """Auditable verification trail capturing all status transitions, timestamps, actor IDs, and admin notes."""
    __tablename__ = "provider_verification_history"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    verification_record_id: Mapped[int] = mapped_column(ForeignKey("provider_verification_records.id"), nullable=False, index=True)
    provider_id: Mapped[int] = mapped_column(ForeignKey("providers.id"), nullable=False, index=True)

    actor_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"), nullable=True)
    action: Mapped[str] = mapped_column(String(100), nullable=False)
    from_status: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    to_status: Mapped[str] = mapped_column(String(50), nullable=False)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )

    # Relationships
    verification_record: Mapped["ProviderVerificationRecord"] = relationship("ProviderVerificationRecord", back_populates="history_entries")
    actor: Mapped[Optional["User"]] = relationship("User")
