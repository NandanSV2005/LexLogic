from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.api.deps import require_citizen, require_provider, get_current_active_user
from app.models.user import User, UserRole
from app.models.provider import Provider
from app.models.request import ServiceRequest, RequestStatus, RequestProvider
from app.schemas.request import (
    ServiceRequestCreate,
    ServiceRequestUpdateStatus,
    ServiceRequestOut,
    RequestProviderOut,
)
from app.services.request_service import (
    create_citizen_request,
    respond_to_request,
    complete_service_request,
)

router = APIRouter(prefix="/requests", tags=["Service Requests"])


@router.post(
    "",
    response_model=ServiceRequestOut,
    status_code=status.HTTP_201_CREATED,
    summary="Create a citizen service request",
    description="Creates a service-first legal request. citizen_id is bound strictly to the authenticated user."
)
def create_request(
    request_in: ServiceRequestCreate,
    current_user: User = Depends(require_citizen),
    db: Session = Depends(get_db)
) -> ServiceRequestOut:
    req = create_citizen_request(db, citizen_id=current_user.id, request_in=request_in)
    return req


@router.get(
    "/me",
    response_model=List[ServiceRequestOut],
    status_code=status.HTTP_200_OK,
    summary="Get current citizen's service requests",
    description="Returns list of requests created by the authenticated citizen (Citizen isolation enforced)."
)
def get_my_requests(
    current_user: User = Depends(require_citizen),
    db: Session = Depends(get_db)
) -> List[ServiceRequestOut]:
    requests = db.query(ServiceRequest).filter(
        ServiceRequest.citizen_id == current_user.id
    ).order_by(ServiceRequest.created_at.desc()).all()
    return requests


@router.get(
    "/eligible",
    response_model=List[ServiceRequestOut],
    status_code=status.HTTP_200_OK,
    summary="Get open requests eligible for provider",
    description="Returns OPEN service requests matching the provider's preferred provider type."
)
def get_eligible_requests(
    current_user: User = Depends(require_provider),
    db: Session = Depends(get_db)
) -> List[ServiceRequestOut]:
    provider = db.query(Provider).filter(Provider.user_id == current_user.id).first()
    if not provider:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Provider profile not found")

    requests = db.query(ServiceRequest).filter(
        ServiceRequest.status.in_([RequestStatus.OPEN, RequestStatus.CONTACTED]),
        ServiceRequest.preferred_provider_type == provider.provider_type
    ).order_by(ServiceRequest.created_at.desc()).all()
    return requests


@router.get(
    "/legal-aid",
    response_model=List[ServiceRequestOut],
    status_code=status.HTTP_200_OK,
    summary="List service requests flagged for legal aid interest",
    description="Identifies requests with legal_aid_interest=True for legal-aid eligibility routing."
)
def get_legal_aid_requests(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
) -> List[ServiceRequestOut]:
    requests = db.query(ServiceRequest).filter(
        ServiceRequest.legal_aid_interest == True
    ).order_by(ServiceRequest.created_at.desc()).all()
    return requests


@router.get(
    "/{request_id}",
    response_model=ServiceRequestOut,
    status_code=status.HTTP_200_OK,
    summary="Get service request by ID with authorization check",
    description="Retrieves request details. Access is restricted to the citizen owner, responding provider, or admin."
)
def get_request_by_id(
    request_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
) -> ServiceRequestOut:
    req = db.query(ServiceRequest).filter(ServiceRequest.id == request_id).first()
    if not req:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Service request not found")

    # 1. Citizen owner access allowed
    if req.citizen_id == current_user.id:
        return req

    # 2. Admin access allowed
    if current_user.role == UserRole.ADMIN:
        return req

    # 3. Provider access allowed if provider has responded/interacted OR request is OPEN & eligible
    if current_user.role == UserRole.PROVIDER:
        provider = db.query(Provider).filter(Provider.user_id == current_user.id).first()
        if provider:
            if req.status in (RequestStatus.OPEN, RequestStatus.CONTACTED) and req.preferred_provider_type == provider.provider_type:
                return req

            interaction = db.query(RequestProvider).filter(
                RequestProvider.request_id == req.id,
                RequestProvider.provider_id == provider.id
            ).first()
            if interaction:
                return req

    # Horizontal Privilege Escalation Protection
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="You do not have permission to access this service request"
    )


@router.post(
    "/{request_id}/respond",
    response_model=RequestProviderOut,
    status_code=status.HTTP_200_OK,
    summary="Provider responds to a service request",
    description="Provider expresses interest in an open service request. Awards REQUEST_RESPONDED (+10 points)."
)
def respond_request(
    request_id: int,
    current_user: User = Depends(require_provider),
    db: Session = Depends(get_db)
) -> RequestProviderOut:
    req = db.query(ServiceRequest).filter(ServiceRequest.id == request_id).first()
    if not req:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Service request not found")

    provider = db.query(Provider).filter(Provider.user_id == current_user.id).first()
    if not provider:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Provider profile not found")

    interaction = respond_to_request(db, provider, req)
    return interaction


@router.post(
    "/{request_id}/complete",
    response_model=ServiceRequestOut,
    status_code=status.HTTP_200_OK,
    summary="Complete a service request",
    description="Marks service request COMPLETED, increments completed_requests, awards points, and recalculates reliability."
)
def complete_request(
    request_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
) -> ServiceRequestOut:
    req = db.query(ServiceRequest).filter(ServiceRequest.id == request_id).first()
    if not req:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Service request not found")

    # Verify user permission to complete (Citizen owner, responding provider, or admin)
    provider = None
    if current_user.role == UserRole.PROVIDER:
        provider = db.query(Provider).filter(Provider.user_id == current_user.id).first()
        interaction = db.query(RequestProvider).filter(
            RequestProvider.request_id == req.id,
            RequestProvider.provider_id == provider.id if provider else -1
        ).first()
        if not interaction:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You are not authorized to complete this request")
    elif current_user.role == UserRole.CITIZEN and req.citizen_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You are not authorized to complete this request")

    completed_req = complete_service_request(db, req, provider)
    return completed_req


@router.put(
    "/{request_id}/status",
    response_model=ServiceRequestOut,
    status_code=status.HTTP_200_OK,
    summary="Update request status",
    description="Updates request status (OPEN, MATCHED, CONTACTED, IN_PROGRESS, COMPLETED, CANCELLED)."
)
def update_request_status(
    request_id: int,
    status_in: ServiceRequestUpdateStatus,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
) -> ServiceRequestOut:
    req = db.query(ServiceRequest).filter(ServiceRequest.id == request_id).first()
    if not req:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Service request not found")

    # Verify authorization
    if current_user.role == UserRole.CITIZEN and req.citizen_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not have permission to update this request")

    req.status = status_in.status
    db.commit()
    db.refresh(req)
    return req
