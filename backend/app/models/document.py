from datetime import datetime, timezone
import enum
from typing import Optional, List, TYPE_CHECKING
from sqlalchemy import String, Integer, DateTime, Enum as SQLEnum, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base

if TYPE_CHECKING:
    from app.models.user import User
    from app.models.provider import Provider



class DocumentVisibility(str, enum.Enum):
    PRIVATE = "PRIVATE"
    SHARED = "SHARED"
    REVOKED = "REVOKED"


class DocumentShareStatus(str, enum.Enum):
    ACTIVE = "ACTIVE"
    REVOKED = "REVOKED"


class DocumentSharePermission(str, enum.Enum):
    VIEW = "VIEW"
    VIEW_AND_DOWNLOAD = "VIEW_AND_DOWNLOAD"


class Document(Base):
    """Document metadata model (stores private file reference, mime type, size, visibility status)."""
    __tablename__ = "documents"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    file_path: Mapped[str] = mapped_column(String(512), nullable=False)
    file_size_bytes: Mapped[int] = mapped_column(Integer, nullable=False)
    mime_type: Mapped[str] = mapped_column(String(100), nullable=False)
    visibility: Mapped[DocumentVisibility] = mapped_column(
        SQLEnum(DocumentVisibility), default=DocumentVisibility.PRIVATE, nullable=False
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
    owner: Mapped["User"] = relationship("User", foreign_keys=[owner_id], back_populates="documents")
    shares: Mapped[List["DocumentShare"]] = relationship(
        "DocumentShare", back_populates="document", cascade="all, delete-orphan"
    )


class DocumentShare(Base):
    """Document sharing relationship managing PRIVATE -> SHARED (ACTIVE) -> REVOKED states."""
    __tablename__ = "document_shares"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    document_id: Mapped[int] = mapped_column(ForeignKey("documents.id"), nullable=False, index=True)
    shared_with_provider_id: Mapped[int] = mapped_column(ForeignKey("providers.id"), nullable=False, index=True)
    status: Mapped[DocumentShareStatus] = mapped_column(
        SQLEnum(DocumentShareStatus), default=DocumentShareStatus.ACTIVE, nullable=False
    )
    permission: Mapped[DocumentSharePermission] = mapped_column(
        SQLEnum(DocumentSharePermission), default=DocumentSharePermission.VIEW, nullable=False
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

    __table_args__ = (
        UniqueConstraint("document_id", "shared_with_provider_id", name="uq_document_provider_share"),
    )

    # Relationships
    document: Mapped["Document"] = relationship("Document", back_populates="shares")
    provider: Mapped["Provider"] = relationship("Provider")
