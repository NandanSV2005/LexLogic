from typing import List, Optional
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.api.deps import require_citizen, require_provider, get_current_active_user
from app.models.user import User, UserRole
from app.models.provider import Provider
from app.models.request import (
    ServiceRequest,
    RequestStatus,
    RequestProvider,
    InteractionStatus,
    CaseTimelineEvent,
    CaseMilestone,
    CaseUpdate,
)
from app.models.document import Document
from app.models.appointment import Appointment
from app.schemas.appointment import AppointmentCreate, AppointmentOut
from app.schemas.request import (
    ServiceRequestCreate,
    ServiceRequestUpdateStatus,
    ServiceRequestOut,
    RequestProviderOut,
    DocumentRequestInput,
    InterestedProviderOut,
    CaseTimelineEventOut,
    CaseMilestoneOut,
    CaseMilestoneUpdateInput,
    CaseUpdateInput,
    CaseUpdateOut,
    CaseCompletionNoteInput,
    CaseDisputeInput,
    CaseSummaryOut,
)

from app.services.request_service import (
    create_citizen_request,
    respond_to_request,
    accept_provider_service,
    request_completion_service,
    complete_service_request,
)
from app.services.provider_service import calculate_profile_completion
from app.services.timeline_service import log_timeline_event
from app.services.milestone_service import seed_default_milestones


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
    return ServiceRequestOut.model_validate(req)


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
    return [ServiceRequestOut.model_validate(r) for r in requests]


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

    return [ServiceRequestOut.model_validate(r) for r in requests]


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

    return [ServiceRequestOut.model_validate(r) for r in requests]


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
    if current_user.role not in (UserRole.PROVIDER, UserRole.ADMIN):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Providers and Admins can access legal-aid requests."
        )

    requests = db.query(ServiceRequest).filter(
        ServiceRequest.legal_aid_interest == True
    ).order_by(ServiceRequest.created_at.desc()).all()
    return [ServiceRequestOut.model_validate(r) for r in requests]


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
        return ServiceRequestOut.model_validate(req)

    # 2. Admin access allowed
    if current_user.role == UserRole.ADMIN:
        return ServiceRequestOut.model_validate(req)

    # 3. Provider access allowed if provider has responded/interacted OR request is OPEN & eligible
    if current_user.role == UserRole.PROVIDER:
        provider = db.query(Provider).filter(Provider.user_id == current_user.id).first()
        if provider:
            if req.status in (RequestStatus.OPEN, RequestStatus.CONTACTED) and req.preferred_provider_type == provider.provider_type:
                return ServiceRequestOut.model_validate(req)

            interaction = db.query(RequestProvider).filter(
                RequestProvider.request_id == req.id,
                RequestProvider.provider_id == provider.id
            ).first()
            if interaction:
                return ServiceRequestOut.model_validate(req)

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
    return RequestProviderOut.model_validate(interaction)


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
        return ServiceRequestOut.model_validate(req)

    comp_req = request_completion_service(db, req, current_user.id)
    return ServiceRequestOut.model_validate(comp_req)


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
        return ServiceRequestOut.model_validate(req)

    if req.status not in (RequestStatus.IN_PROGRESS, RequestStatus.COMPLETION_REQUESTED):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot confirm completion for a request with status {req.status}"
        )

    completed_req = complete_service_request(db, req)
    return ServiceRequestOut.model_validate(completed_req)


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
        if not provider:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Provider profile not found")
        interaction = db.query(RequestProvider).filter(
            RequestProvider.request_id == req.id,
            RequestProvider.provider_id == provider.id
        ).first()
        if not interaction:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You are not authorized to complete this request")

        if req.status == RequestStatus.IN_PROGRESS:
            comp_req = request_completion_service(db, req, current_user.id)
            return ServiceRequestOut.model_validate(comp_req)
    elif current_user.role == UserRole.CITIZEN and req.citizen_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You are not authorized to complete this request")

    completed_req = complete_service_request(db, req, provider)
    return ServiceRequestOut.model_validate(completed_req)


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

    # Verify authorization (Citizen owner, assigned provider, or Admin)
    is_owner = (req.citizen_id == current_user.id)
    is_admin = (current_user.role == UserRole.ADMIN)
    is_assigned_provider = False

    if current_user.role == UserRole.PROVIDER:
        provider = db.query(Provider).filter(Provider.user_id == current_user.id).first()
        if provider:
            interaction = db.query(RequestProvider).filter(
                RequestProvider.request_id == req.id,
                RequestProvider.provider_id == provider.id,
                RequestProvider.status == InteractionStatus.ACCEPTED
            ).first()
            if interaction:
                is_assigned_provider = True

    if not (is_owner or is_admin or is_assigned_provider):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not have permission to update this request status")

    req.status = status_in.status
    db.commit()
    db.refresh(req)
    return ServiceRequestOut.model_validate(req)


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

    return RequestProviderOut.model_validate(interaction)


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

    acc_req = accept_provider_service(db, req, target_interaction, current_user.id)
    return ServiceRequestOut.model_validate(acc_req)


@router.post(
    "/{request_id}/review-documents",
    response_model=ServiceRequestOut,
    status_code=status.HTTP_200_OK,
    summary="Provider reviews submitted documents (Sufficient vs Additional Required)",
    description="Provider marks documents as sufficient (DOCUMENTS_REVIEWED) or requests additional info (ADDITIONAL_INFORMATION_REQUIRED)."
)
def review_documents(
    request_id: int,
    action: str = Query(..., description="Action: SUFFICIENT or ADDITIONAL_REQUIRED"),
    reason: Optional[str] = Query(None, description="Reason if additional info required"),
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
        RequestProvider.provider_id == provider.id
    ).first()
    if not interaction:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You are not authorized for this case")

    act_upper = action.upper()
    if act_upper == "SUFFICIENT":
        req.status = RequestStatus.DOCUMENTS_REVIEWED
        log_timeline_event(
            db=db,
            request_id=req.id,
            event_type="DOCUMENT_REVIEWED",
            title="Document reviewed",
            description="Provider marked submitted documents as sufficient",
            actor_id=current_user.id,
        )
    elif act_upper in ("ADDITIONAL_REQUIRED", "REQUEST_MORE"):
        req.status = RequestStatus.ADDITIONAL_INFORMATION_REQUIRED
        if reason:
            interaction.requested_documents = reason.strip()
        log_timeline_event(
            db=db,
            request_id=req.id,
            event_type="ADDITIONAL_DOCUMENT_REQUESTED",
            title="Additional document requested",
            description=reason or "Provider requested additional information",
            actor_id=current_user.id,
        )
    else:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Action must be SUFFICIENT or ADDITIONAL_REQUIRED")

    db.commit()
    db.refresh(req)
    return ServiceRequestOut.model_validate(req)


@router.post(
    "/{request_id}/mark-ready",
    response_model=ServiceRequestOut,
    status_code=status.HTTP_200_OK,
    summary="Provider marks case as ready for service",
    description="Provider sets request status to READY_FOR_SERVICE after reviewing all requirements."
)
def mark_case_ready(
    request_id: int,
    current_user: User = Depends(require_provider),
    db: Session = Depends(get_db)
) -> ServiceRequestOut:
    req = db.query(ServiceRequest).filter(ServiceRequest.id == request_id).first()
    if not req:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Service request not found")

    provider = db.query(Provider).filter(Provider.user_id == current_user.id).first()
    if not provider or (req.accepted_provider_id and req.accepted_provider_id != provider.id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only assigned provider can mark case ready")

    req.status = RequestStatus.READY_FOR_SERVICE
    db.commit()
    db.refresh(req)

    log_timeline_event(
        db=db,
        request_id=req.id,
        event_type="CASE_READY_FOR_SERVICE",
        title="Case ready for service",
        description="Provider reviewed all submitted information and is ready to proceed.",
        actor_id=current_user.id,
    )

    return ServiceRequestOut.model_validate(req)


@router.post(
    "/{request_id}/start-service",
    response_model=ServiceRequestOut,
    status_code=status.HTTP_200_OK,
    summary="Provider starts service execution and seeds profession milestones",
    description="Sets status to IN_PROGRESS and seeds profession-adapted milestones."
)
def start_service(
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

    req.status = RequestStatus.IN_PROGRESS
    db.commit()

    # Seed default milestones
    seed_default_milestones(db, req.id, provider.provider_type)

    log_timeline_event(
        db=db,
        request_id=req.id,
        event_type="SERVICE_IN_PROGRESS",
        title="Service in progress",
        description="Provider initiated legal service milestones",
        actor_id=current_user.id,
    )

    db.refresh(req)
    return ServiceRequestOut.model_validate(req)


@router.get(
    "/{request_id}/milestones",
    response_model=List[CaseMilestoneOut],
    status_code=status.HTTP_200_OK,
    summary="Get case service milestones",
    description="Returns list of profession-adapted service milestones for a case."
)
def get_case_milestones(
    request_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
) -> List[CaseMilestoneOut]:
    req = db.query(ServiceRequest).filter(ServiceRequest.id == request_id).first()
    if not req:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Service request not found")

    milestones = db.query(CaseMilestone).filter(
        CaseMilestone.request_id == request_id
    ).order_by(CaseMilestone.id.asc()).all()

    return [CaseMilestoneOut.model_validate(m) for m in milestones]


@router.put(
    "/{request_id}/milestones/{milestone_id}",
    response_model=CaseMilestoneOut,
    status_code=status.HTTP_200_OK,
    summary="Provider updates a case milestone",
    description="Provider updates milestone status (PENDING -> IN_PROGRESS -> COMPLETED) and notes."
)
def update_case_milestone(
    request_id: int,
    milestone_id: int,
    ms_in: CaseMilestoneUpdateInput,
    current_user: User = Depends(require_provider),
    db: Session = Depends(get_db)
) -> CaseMilestoneOut:
    provider = db.query(Provider).filter(Provider.user_id == current_user.id).first()
    if not provider:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Provider profile not found")

    ms = db.query(CaseMilestone).filter(
        CaseMilestone.id == milestone_id,
        CaseMilestone.request_id == request_id
    ).first()
    if not ms:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Milestone not found")

    ms.status = ms_in.status.upper()
    if ms_in.notes:
        ms.notes = ms_in.notes.strip()
    if ms.status == "COMPLETED":
        ms.completed_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(ms)

    log_timeline_event(
        db=db,
        request_id=request_id,
        event_type="MILESTONE_UPDATED",
        title=f"Milestone updated: {ms.milestone_name}",
        description=f"Status: {ms.status}. {ms.notes or ''}",
        actor_id=current_user.id,
    )

    return CaseMilestoneOut.model_validate(ms)


@router.post(
    "/{request_id}/updates",
    response_model=CaseUpdateOut,
    status_code=status.HTTP_201_CREATED,
    summary="Post a lightweight structured case update",
    description="Posts a structured activity update note for a case (Provider or Citizen)."
)
def post_case_update(
    request_id: int,
    update_in: CaseUpdateInput,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
) -> CaseUpdateOut:
    req = db.query(ServiceRequest).filter(ServiceRequest.id == request_id).first()
    if not req:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Service request not found")

    author_role = "PROVIDER" if current_user.role == UserRole.PROVIDER else "CITIZEN"

    update_obj = CaseUpdate(
        request_id=request_id,
        author_id=current_user.id,
        author_role=author_role,
        update_text=update_in.update_text.strip(),
    )
    db.add(update_obj)
    db.commit()
    db.refresh(update_obj)

    log_timeline_event(
        db=db,
        request_id=request_id,
        event_type="CASE_UPDATE_POSTED",
        title=f"Case update from {author_role.capitalize()}",
        description=update_obj.update_text[:100],
        actor_id=current_user.id,
    )

    return CaseUpdateOut.model_validate(update_obj)


@router.get(
    "/{request_id}/updates",
    response_model=List[CaseUpdateOut],
    status_code=status.HTTP_200_OK,
    summary="Get lightweight case updates",
    description="Returns structured updates posted for a case."
)
def get_case_updates(
    request_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
) -> List[CaseUpdateOut]:
    req = db.query(ServiceRequest).filter(ServiceRequest.id == request_id).first()
    if not req:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Service request not found")

    updates = db.query(CaseUpdate).filter(
        CaseUpdate.request_id == request_id
    ).order_by(CaseUpdate.created_at.desc()).all()

    return [CaseUpdateOut.model_validate(u) for u in updates]


@router.get(
    "/{request_id}/timeline",
    response_model=List[CaseTimelineEventOut],
    status_code=status.HTTP_200_OK,
    summary="Get case activity timeline",
    description="Returns real backend timeline events for a case."
)
def get_case_timeline(
    request_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
) -> List[CaseTimelineEventOut]:
    req = db.query(ServiceRequest).filter(ServiceRequest.id == request_id).first()
    if not req:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Service request not found")

    events = db.query(CaseTimelineEvent).filter(
        CaseTimelineEvent.request_id == request_id
    ).order_by(CaseTimelineEvent.created_at.asc()).all()

    return [CaseTimelineEventOut.model_validate(e) for e in events]


@router.post(
    "/{request_id}/submit-completion",
    response_model=ServiceRequestOut,
    status_code=status.HTTP_200_OK,
    summary="Provider submits service completion with mandatory completion note",
    description="Provider requests completion of service. Sets status to COMPLETION_PENDING."
)
def submit_completion(
    request_id: int,
    comp_in: CaseCompletionNoteInput,
    current_user: User = Depends(require_provider),
    db: Session = Depends(get_db)
) -> ServiceRequestOut:
    req = db.query(ServiceRequest).filter(ServiceRequest.id == request_id).first()
    if not req:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Service request not found")

    req.completion_note = comp_in.completion_note.strip()
    comp_req = request_completion_service(db, req, current_user.id)
    return ServiceRequestOut.model_validate(comp_req)


@router.post(
    "/{request_id}/dispute-completion",
    response_model=ServiceRequestOut,
    status_code=status.HTTP_200_OK,
    summary="Citizen reports issue or disputes service completion",
    description="Citizen flags completion issue. Sets status to COMPLETION_DISPUTED."
)
def dispute_completion(
    request_id: int,
    dispute_in: CaseDisputeInput,
    current_user: User = Depends(require_citizen),
    db: Session = Depends(get_db)
) -> ServiceRequestOut:
    req = db.query(ServiceRequest).filter(ServiceRequest.id == request_id).first()
    if not req:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Service request not found")

    if req.citizen_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not have permission to dispute completion for this request")

    req.dispute_reason = dispute_in.dispute_reason.strip()
    req.status = RequestStatus.COMPLETION_DISPUTED
    db.commit()
    db.refresh(req)

    log_timeline_event(
        db=db,
        request_id=req.id,
        event_type="COMPLETION_DISPUTED",
        title="Completion disputed",
        description=f"Reason: {req.dispute_reason}",
        actor_id=current_user.id,
    )

    return ServiceRequestOut.model_validate(req)


@router.get(
    "/{request_id}/summary",
    response_model=CaseSummaryOut,
    status_code=status.HTTP_200_OK,
    summary="Get comprehensive final case summary",
    description="Returns complete post-completion case summary with timeline, document count, and appointment metrics."
)
def get_case_summary(
    request_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
) -> CaseSummaryOut:
    req = db.query(ServiceRequest).filter(ServiceRequest.id == request_id).first()
    if not req:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Service request not found")

    doc_count = db.query(Document).filter(Document.request_id == request_id).count()
    appt_count = db.query(Appointment).filter(Appointment.request_id == request_id).count()

    events = db.query(CaseTimelineEvent).filter(
        CaseTimelineEvent.request_id == request_id
    ).order_by(CaseTimelineEvent.created_at.asc()).all()

    p_name = req.accepted_provider_name
    p_prof = req.preferred_provider_type.value if req.preferred_provider_type else None

    completion_date_str = None
    if req.status == RequestStatus.COMPLETED:
        completion_date_str = req.updated_at.strftime("%Y-%m-%d")

    return CaseSummaryOut(
        request_id=req.id,
        legal_need=req.service_category,
        description=req.description,
        provider_name=p_name,
        provider_profession=p_prof,
        service_category=req.service_category,
        start_date=req.created_at.strftime("%Y-%m-%d"),
        completion_date=completion_date_str,
        documents_exchanged_count=doc_count,
        appointment_count=appt_count,
        timeline_events=[CaseTimelineEventOut.model_validate(e) for e in events],
        final_completion_note=req.completion_note,
        final_status=req.status.value,
    )


@router.get(
    "/{request_id}/appointments",
    response_model=List[AppointmentOut],
    status_code=status.HTTP_200_OK,
    summary="List appointment slots for a service request",
    description="Returns scheduled appointments for an active case workspace."
)
def list_request_appointments(
    request_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
) -> List[AppointmentOut]:
    req = db.query(ServiceRequest).filter(ServiceRequest.id == request_id).first()
    if not req:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Service request not found")

    appts = db.query(Appointment).filter(Appointment.request_id == request_id).all()
    res = []
    for a in appts:
        out = AppointmentOut.model_validate(a)
        if a.provider:
            out.provider_name = a.provider.full_name
        if a.citizen:
            out.citizen_name = a.citizen.email
        if a.request:
            out.service_category = a.request.service_category
        res.append(out)
    return res


@router.post(
    "/{request_id}/appointments",
    response_model=AppointmentOut,
    status_code=status.HTTP_201_CREATED,
    summary="Schedule an appointment slot for a service request",
    description="Schedules an appointment slot for a service request."
)
def schedule_request_appointment(
    request_id: int,
    appt_in: AppointmentCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
) -> AppointmentOut:
    req = db.query(ServiceRequest).filter(ServiceRequest.id == request_id).first()
    if not req:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Service request not found")

    accepted_inter = req.accepted_interaction
    if not accepted_inter:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Appointments can only be scheduled once a provider has been accepted for representation"
        )

    provider_id = accepted_inter.provider_id
    citizen_id = req.citizen_id

    appt = Appointment(
        request_id=request_id,
        provider_id=provider_id,
        citizen_id=citizen_id,
        slot_datetime=appt_in.slot_datetime,
        purpose=appt_in.purpose,
        status="SCHEDULED"
    )
    db.add(appt)
    db.commit()
    db.refresh(appt)

    log_timeline_event(
        db=db,
        request_id=request_id,
        event_type="APPOINTMENT_SCHEDULED",
        title=f"Appointment scheduled: {appt.purpose}",
        description=f"Slot: {appt.slot_datetime.strftime('%Y-%m-%d %H:%M')}",
        actor_id=current_user.id,
    )

    out = AppointmentOut.model_validate(appt)
    if appt.provider:
        out.provider_name = appt.provider.full_name
    if appt.citizen:
        out.citizen_name = appt.citizen.email
    if appt.request:
        out.service_category = appt.request.service_category
    return out

