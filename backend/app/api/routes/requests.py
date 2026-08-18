from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.api.deps import require_citizen, require_provider, get_current_active_user
from app.models.user import User, UserRole
from app.models.provider import Provider
from app.models.request import ServiceRequest, RequestStatus, RequestProvider, InteractionStatus
from app.schemas.request import (
    ServiceRequestCreate,
    ServiceRequestUpdateStatus,
    ServiceRequestOut,
    RequestProviderOut,
    DocumentRequestInput,
    InterestedProviderOut,
)

from app.services.request_service import (
    create_citizen_request,
    respond_to_request,
    accept_provider_service,
    request_completion_service,
    complete_service_request,
)
from app.services.provider_service import calculate_profile_completion


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
    description="Returns OPEN service requests matching the provider's preferred provider type that the provider has not yet responded to."
)
def get_eligible_requests(
    current_user: User = Depends(require_provider),
    db: Session = Depends(get_db)
) -> List[ServiceRequestOut]:
    provider = db.query(Provider).filter(Provider.user_id == current_user.id).first()
    if not provider:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Provider profile not found")

    calculate_profile_completion(provider, db)
    if not provider.is_profile_complete:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Provider profile incomplete. Please complete your professional profile before accessing citizen requests."
        )

    # Subquery for requests provider has already interacted with
    interacted_ids_query = db.query(RequestProvider.request_id).filter(
        RequestProvider.provider_id == provider.id
    )

    requests = db.query(ServiceRequest).filter(
        ServiceRequest.status.in_([RequestStatus.OPEN, RequestStatus.CONTACTED]),
        ServiceRequest.preferred_provider_type == provider.provider_type,
        ~ServiceRequest.id.in_(interacted_ids_query)
    ).order_by(ServiceRequest.created_at.desc()).all()

    return requests


@router.get(
    "/provider/my-cases",
    response_model=List[ServiceRequestOut],
    status_code=status.HTTP_200_OK,
    summary="Get current provider's active/interacted cases",
    description="Returns service requests where the provider has expressed interest."
)
def get_provider_my_cases(
    current_user: User = Depends(require_provider),
    db: Session = Depends(get_db)
) -> List[ServiceRequestOut]:
    provider = db.query(Provider).filter(Provider.user_id == current_user.id).first()
    if not provider:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Provider profile not found")

    requests = db.query(ServiceRequest).join(
        RequestProvider, RequestProvider.request_id == ServiceRequest.id
    ).filter(
        RequestProvider.provider_id == provider.id
    ).order_by(RequestProvider.created_at.desc()).all()

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

    calculate_profile_completion(provider, db)
    if not provider.is_profile_complete:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Provider profile incomplete. Please complete your professional profile before expressing interest."
        )

    # Check for existing interaction to prevent duplicate interest
    existing_interaction = db.query(RequestProvider).filter(
        RequestProvider.request_id == req.id,
        RequestProvider.provider_id == provider.id
    ).first()
    if existing_interaction:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You have already expressed interest in this service request."
        )

    interaction = respond_to_request(db, provider, req)
    return interaction


@router.post(
    "/{request_id}/request-completion",
    response_model=ServiceRequestOut,
    status_code=status.HTTP_200_OK,
    summary="Provider marks service as completed (requests citizen confirmation)",
    description="Provider requests completion of an active service request (IN_PROGRESS -> COMPLETION_REQUESTED)."
)
def request_completion(
    request_id: int,
    current_user: User = Depends(require_provider),
    db: Session = Depends(get_db)
) -> ServiceRequestOut:
    req = db.query(ServiceRequest).filter(ServiceRequest.id == request_id).first()
    if not req:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Service request not found")

    provider = db.query(Provider).filter(Provider.user_id == current_user.id).first()
    if not provider:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Provider profile not found")

    interaction = db.query(RequestProvider).filter(
        RequestProvider.request_id == req.id,
        RequestProvider.provider_id == provider.id,
        RequestProvider.status == InteractionStatus.ACCEPTED
    ).first()
    if not interaction:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not the assigned provider for this service request"
        )

    if req.status not in (RequestStatus.IN_PROGRESS, RequestStatus.COMPLETION_REQUESTED):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot request completion for a request with status {req.status}"
        )

    if req.status == RequestStatus.COMPLETION_REQUESTED:
        return req

    return request_completion_service(db, req, current_user.id)


@router.post(
    "/{request_id}/confirm-completion",
    response_model=ServiceRequestOut,
    status_code=status.HTTP_200_OK,
    summary="Citizen confirms service completion",
    description="Citizen confirms completion for a service request (COMPLETION_REQUESTED -> COMPLETED). Awards points to provider."
)
def confirm_completion(
    request_id: int,
    current_user: User = Depends(require_citizen),
    db: Session = Depends(get_db)
) -> ServiceRequestOut:
    req = db.query(ServiceRequest).filter(ServiceRequest.id == request_id).first()
    if not req:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Service request not found")

    if req.citizen_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to confirm completion for this request"
        )

    if req.status == RequestStatus.COMPLETED:
        return req

    if req.status not in (RequestStatus.IN_PROGRESS, RequestStatus.COMPLETION_REQUESTED):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot confirm completion for a request with status {req.status}"
        )

    return complete_service_request(db, req)


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

        if req.status == RequestStatus.IN_PROGRESS:
            return request_completion_service(db, req, current_user.id)
    elif current_user.role == UserRole.CITIZEN and req.citizen_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You are not authorized to complete this request")

    completed_req = complete_service_request(db, req, provider)
    return completed_req


@router.put(
    "/{request_id}/status",
    response_model=ServiceRequestOut,
    status_code=status.HTTP_200_OK,
    summary="Update request status",
    description="Updates request status (OPEN, MATCHED, CONTACTED, IN_PROGRESS, COMPLETION_REQUESTED, COMPLETED, CANCELLED)."
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


@router.post(
    "/{request_id}/request-documents",
    response_model=RequestProviderOut,
    status_code=status.HTTP_200_OK,
    summary="Provider requests specific documents or case info from citizen",
    description="Provider sets requested documents list for an interacted service request."
)
def request_documents(
    request_id: int,
    doc_req_in: DocumentRequestInput,
    current_user: User = Depends(require_provider),
    db: Session = Depends(get_db)
) -> RequestProviderOut:
    provider = db.query(Provider).filter(Provider.user_id == current_user.id).first()
    if not provider:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Provider profile not found")

    interaction = db.query(RequestProvider).filter(
        RequestProvider.request_id == request_id,
        RequestProvider.provider_id == provider.id
    ).first()
    if not interaction:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="You have not expressed interest in this service request")

    interaction.requested_documents = doc_req_in.requested_documents.strip()
    db.commit()
    db.refresh(interaction)

    return interaction


@router.get(
    "/{request_id}/interested-providers",
    response_model=List[InterestedProviderOut],
    status_code=status.HTTP_200_OK,
    summary="List providers who expressed interest in citizen's service request",
    description="Retrieves interested providers for a request. Access allowed to citizen owner or admin."
)
def get_interested_providers(
    request_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
) -> List[InterestedProviderOut]:
    req = db.query(ServiceRequest).filter(ServiceRequest.id == request_id).first()
    if not req:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Service request not found")

    if req.citizen_id != current_user.id and current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not have permission to view interested providers for this request")

    interactions = db.query(RequestProvider).filter(
        RequestProvider.request_id == request_id
    ).all()

    results = []
    for inter in interactions:
        p = inter.provider
        if p:
            results.append(
                InterestedProviderOut(
                    provider_id=p.id,
                    full_name=p.full_name,
                    provider_type=p.provider_type,
                    phone=p.phone,
                    location=p.location,
                    experience_years=p.experience_years,
                    bio=p.bio,
                    rating=p.rating,
                    verification_status=p.verification_status.value if p.verification_status else "PENDING",
                    reliability_score=p.reliability_score,
                    interaction_status=inter.status,
                    requested_documents=inter.requested_documents,
                )
            )

    return results


@router.post(
    "/{request_id}/accept-provider/{provider_id}",
    response_model=ServiceRequestOut,
    status_code=status.HTTP_200_OK,
    summary="Citizen accepts/assigns a provider for their service request",
    description="Citizen accepts provider interest. Updates interaction status to ACCEPTED, declines other provider interests, and advances request status to IN_PROGRESS."
)
def accept_provider(
    request_id: int,
    provider_id: int,
    current_user: User = Depends(require_citizen),
    db: Session = Depends(get_db)
) -> ServiceRequestOut:
    req = db.query(ServiceRequest).filter(ServiceRequest.id == request_id).first()
    if not req:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Service request not found")

    if req.citizen_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not have permission to accept providers for this request")

    target_interaction = db.query(RequestProvider).filter(
        RequestProvider.request_id == request_id,
        RequestProvider.provider_id == provider_id
    ).first()
    if not target_interaction:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Provider has not expressed interest in this request")

    return accept_provider_service(db, req, target_interaction, current_user.id)
