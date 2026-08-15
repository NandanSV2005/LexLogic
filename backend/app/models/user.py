from datetime import datetime, timezone
import enum
from typing import Optional, List, TYPE_CHECKING
from sqlalchemy import String, Boolean, DateTime, Enum as SQLEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base

if TYPE_CHECKING:
    from app.models.provider import Provider
    from app.models.request import ServiceRequest
    from app.models.document import Document
    from app.models.audit import AuditLog



class UserRole(str, enum.Enum):
    CITIZEN = "CITIZEN"
    PROVIDER = "PROVIDER"
    ADMIN = "ADMIN"


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[UserRole] = mapped_column(SQLEnum(UserRole), default=UserRole.CITIZEN, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
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
    provider: Mapped[Optional["Provider"]] = relationship(
        "Provider", back_populates="user", uselist=False, cascade="all, delete-orphan"
    )
    service_requests: Mapped[List["ServiceRequest"]] = relationship(
        "ServiceRequest", foreign_keys="ServiceRequest.citizen_id", back_populates="citizen"
    )
    documents: Mapped[List["Document"]] = relationship(
        "Document", foreign_keys="Document.owner_id", back_populates="owner"
    )

    audit_logs: Mapped[List["AuditLog"]] = relationship(
        "AuditLog", back_populates="user"
    )
