from fastapi import APIRouter, status

router = APIRouter(prefix="/citizens", tags=["Citizens"])


@router.get("", status_code=status.HTTP_200_OK)
def list_citizens():
    """Citizens API route placeholder."""
    return {"message": "Citizens API route placeholder"}
