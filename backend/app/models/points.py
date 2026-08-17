from datetime import datetime, timezone
import enum
from typing import Optional
from sqlalchemy import String, Integer, DateTime, Enum as SQLEnum, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base



class PointAction(str, enum.Enum):
    PROFILE_COMPLETED = "PROFILE_COMPLETED"
    AVAILABILITY_ADDED = "AVAILABILITY_ADDED"
    REQUEST_RESPONDED = "REQUEST_RESPONDED"
    SERVICE_COMPLETED = "SERVICE_COMPLETED"
    PRO_BONO_COMPLETED = "PRO_BONO_COMPLETED"


class PointTransaction(Base):
    """Point transaction audit history for provider incentive points."""
    __tablename__ = "point_transactions"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    provider_id: Mapped[int] = mapped_column(ForeignKey("providers.id"), nullable=False, index=True)
    action: Mapped[PointAction] = mapped_column(SQLEnum(PointAction), nullable=False)
    points: Mapped[int] = mapped_column(Integer, nullable=False)
    reference_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True, index=True)
    description: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )


    # Relationships
    provider: Mapped["Provider"] = relationship("Provider", back_populates="point_transactions")
