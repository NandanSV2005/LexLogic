from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.api.deps import get_current_active_user
from app.models.user import User, UserRole
from app.models.provider import Provider
from app.models.request import ServiceRequest, RequestStatus, RequestProvider, InteractionStatus
from app.models.document import Document, DocumentShare, DocumentShareStatus
from app.models.audit import AuditLog
from app.schemas.workspace import WorkspaceSummaryOut, TimelineEventOut, NextActionOut
from app.schemas.request import ServiceRequestOut, InterestedProviderOut


router = APIRouter(prefix="/requests", tags=["Service Workspace"])


@router.get(
    "/{request_id}/workspace",
    response_model=WorkspaceSummaryOut,
    status_code=status.HTTP_200_OK,
    summary="Get unified case workspace summary",
    description="Returns request info, connected provider, timeline events, and current recommended next action."
)
def get_case_workspace(
    request_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
) -> WorkspaceSummaryOut:
    req = db.query(ServiceRequest).filter(ServiceRequest.id == request_id).first()
    if not req:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Service request not found")

    # Authorization Check
    provider = None
    is_owner = (req.citizen_id == current_user.id)
    is_admin = (current_user.role == UserRole.ADMIN)
    is_connected_provider = False

    if current_user.role == UserRole.PROVIDER:
        provider = db.query(Provider).filter(Provider.user_id == current_user.id).first()
        if provider:
            inter = db.query(RequestProvider).filter(
                RequestProvider.request_id == req.id,
                RequestProvider.provider_id == provider.id
            ).first()
            if inter:
                is_connected_provider = True

    if not (is_owner or is_admin or is_connected_provider):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have authorization to access this case workspace"
        )

    # Fetch accepted provider details if any
    accepted_inter = req.accepted_interaction
    connected_prov_out = None
    if accepted_inter and accepted_inter.provider:
        p = accepted_inter.provider
        connected_prov_out = InterestedProviderOut(
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
            interaction_status=accepted_inter.status,
            requested_documents=accepted_inter.requested_documents,
        )

    # Build Timeline Events
    timeline: List[TimelineEventOut] = [
        TimelineEventOut(
            id=f"create-{req.id}",
            event_type="REQUEST_CREATED",
            title="Service Request Created",
            description=f"Citizen described legal need under {req.service_category}.",
            timestamp=req.created_at
        )
    ]

    # Provider interactions timeline
    for inter in req.provider_interactions:
        p_name = inter.provider.full_name if inter.provider else f"Provider #{inter.provider_id}"
        if inter.status == InteractionStatus.CONTACTED or inter.status == InteractionStatus.PENDING:
            timeline.append(TimelineEventOut(
                id=f"interest-{inter.id}",
                event_type="INTEREST_EXPRESSED",
                title=f"{p_name} Expressed Interest",
                description=f"Provider offered professional representation for this request.",
                timestamp=inter.created_at
            ))
        elif inter.status == InteractionStatus.ACCEPTED:
            timeline.append(TimelineEventOut(
                id=f"accept-{inter.id}",
                event_type="PROVIDER_CONNECTED",
                title=f"Connected with {p_name}",
                description=f"Citizen accepted {p_name} for active representation.",
                timestamp=inter.updated_at
            ))

    # Audit events for completion
    if req.status == RequestStatus.COMPLETION_REQUESTED:
        timeline.append(TimelineEventOut(
            id=f"comp-req-{req.id}",
            event_type="COMPLETION_REQUESTED",
            title="Completion Requested by Provider",
            description="Provider submitted work as completed. Awaiting Citizen confirmation.",
            timestamp=req.updated_at
        ))
    elif req.status == RequestStatus.COMPLETED:
        timeline.append(TimelineEventOut(
            id=f"completed-{req.id}",
            event_type="SERVICE_COMPLETED",
            title="Service Request Completed & Closed",
            description="Completion confirmed by Citizen. Incentives awarded.",
            timestamp=req.updated_at
        ))

    # Sort timeline by timestamp ascending
    timeline.sort(key=lambda x: x.timestamp)

    # Determine Next Action based on state and current user role
    if req.status == RequestStatus.OPEN:
        if req.provider_interactions:
            next_action = NextActionOut(
                action_key="ACCEPT_PROVIDER",
                title="Review Interested Providers",
                description="Providers have expressed interest in your case. Select a provider to begin representation.",
                actor_role="CITIZEN"
            )
        else:
            next_action = NextActionOut(
                action_key="AWAIT_MATCHES",
                title="Awaiting Provider Interest",
                description="Verified providers are reviewing your request.",
                actor_role="CITIZEN"
            )
    elif req.status == RequestStatus.CONTACTED:
        next_action = NextActionOut(
            action_key="ACCEPT_PROVIDER",
            title="Accept & Engage Provider",
            description="Review expressed provider interests and accept representation.",
            actor_role="CITIZEN"
        )
    elif req.status == RequestStatus.IN_PROGRESS:
        if current_user.role == UserRole.PROVIDER:
            next_action = NextActionOut(
                action_key="MARK_COMPLETED",
                title="Provide Legal Service & Mark Completed",
                description="Review requested documents and mark work completed when finished.",
                actor_role="PROVIDER"
            )
        else:
            next_action = NextActionOut(
                action_key="ATTACH_DOCUMENTS",
                title="Upload & Share Requested Documents",
                description="Attach required case documents and set explicit permission levels.",
                actor_role="CITIZEN"
            )
    elif req.status == RequestStatus.COMPLETION_REQUESTED:
        if current_user.role == UserRole.CITIZEN:
            next_action = NextActionOut(
                action_key="CONFIRM_COMPLETION",
                title="Confirm Service Completion",
                description="Your provider has marked work completed. Click to confirm and close this request.",
                actor_role="CITIZEN"
            )
        else:
            next_action = NextActionOut(
                action_key="AWAIT_CONFIRMATION",
                title="Awaiting Citizen Confirmation",
                description="Completion request submitted. Waiting for Citizen confirmation.",
                actor_role="PROVIDER"
            )
    else:
        next_action = NextActionOut(
            action_key="CLOSED",
            title="Service Request Resolved",
            description="This service request is officially completed and archived.",
            actor_role="BOTH"
        )

    # Document count for this citizen
    doc_count = db.query(Document).filter(Document.owner_id == req.citizen_id).count()

    req_out = ServiceRequestOut.model_validate(req)

    return WorkspaceSummaryOut(
        request=req_out,
        connected_provider=connected_prov_out,
        next_action=next_action,
        timeline=timeline,
        documents_count=doc_count
    )
