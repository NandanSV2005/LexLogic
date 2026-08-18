from fastapi import APIRouter, Depends, status
from app.api.deps import get_current_active_user
from app.models.user import User
from app.schemas.navigator import NavigatorInput, NavigatorOutput
from app.services.navigator_service import classify_legal_need


router = APIRouter(prefix="/navigator", tags=["AI Legal Need Navigator"])


@router.post(
    "/classify",
    response_model=NavigatorOutput,
    status_code=status.HTTP_200_OK,
    summary="Classify natural language legal need",
    description="Analyzes problem description and returns recommended service category, provider type, context summary, and legal disclaimer."
)
def classify_need(
    input_data: NavigatorInput,
    current_user: User = Depends(get_current_active_user)
) -> NavigatorOutput:
    return classify_legal_need(input_data.description)
