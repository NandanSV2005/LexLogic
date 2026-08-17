from typing import Optional
from datetime import datetime
from pydantic import BaseModel, ConfigDict
from app.models.points import PointAction


class PointTransactionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    provider_id: int
    action: PointAction
    points: int
    reference_id: Optional[int] = None
    description: str
    created_at: datetime



class PointsSummaryOut(BaseModel):
    total_points: int
    transactions_count: int
