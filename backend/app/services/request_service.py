from typing import Optional
from sqlalchemy.orm import Session
from app.models.request import ServiceRequest, RequestStatus, RequestProvider, InteractionStatus
from app.models.provider import Provider
from app.models.points import PointAction
from app.schemas.request import ServiceRequestCreate
from app.services.points_service import award_points
from app.services.reliability_service import calculate_reliability_score
from app.services.audit import log_audit
from app.services.timeline_service import log_timeline_event


def create_citizen_request(
    db: Session,
    citizen_id: int,
    request_in: ServiceRequestCreate
) -> ServiceRequest:
    """Creates a new citizen service request with citizen_id bound to the authenticated user."""
    req = ServiceRequest(
        citizen_id=citizen_id,
        service_category=request_in.service_category,
        description=request_in.description,
        location=request_in.location,
        preferred_provider_type=request_in.preferred_provider_type,
        urgency=request_in.urgency,
        legal_aid_interest=request_in.legal_aid_interest,
        status=RequestStatus.OPEN,
    )
    db.add(req)
    db.commit()
    db.refresh(req)

    log_timeline_event(
        db=db,
        request_id=req.id,
        event_type="LEGAL_REQUEST_SUBMITTED",
        title="Legal request submitted",
        description=f"Category: {req.service_category} in {req.location}",
        actor_id=citizen_id,
    )

    log_audit(
        db=db,
        user_id=citizen_id,
        action="SERVICE_REQUEST_CREATE",
        resource_type="service_request",
        resource_id=req.id,
        metadata_json={"service_category": req.service_category, "legal_aid": req.legal_aid_interest}
    )

    return req


def respond_to_request(
    db: Session,
    provider: Provider,
    req: ServiceRequest
) -> RequestProvider:
    """Handles provider expressing interest/responding to an open request."""
    interaction = db.query(RequestProvider).filter(
        RequestProvider.request_id == req.id,
        RequestProvider.provider_id == provider.id
    ).first()

    if not interaction:
        interaction = RequestProvider(
            request_id=req.id,
            provider_id=provider.id,
            status=InteractionStatus.CONTACTED
        )
        db.add(interaction)
        provider.total_requests += 1

    interaction.status = InteractionStatus.CONTACTED

    if req.status == RequestStatus.OPEN:
        req.status = RequestStatus.CONTACTED

    db.commit()
    db.refresh(interaction)

    award_points(db, provider, PointAction.REQUEST_RESPONDED, reference_id=req.id)
    calculate_reliability_score(provider)
    db.commit()

    log_timeline_event(
        db=db,
        request_id=req.id,
        event_type="PROVIDER_EXPRESSED_INTEREST",
        title=f"Provider {provider.full_name} expressed interest",
        description=f"Profession: {provider.provider_type.value}",
        actor_id=provider.user_id,
    )

    log_audit(
        db=db,
        user_id=provider.user_id,
        action="PROVIDER_REQUEST_RESPOND",
        resource_type="service_request",
        resource_id=req.id,
        metadata_json={"provider_id": provider.id}
    )

    return interaction


def accept_provider_service(
    db: Session,
    req: ServiceRequest,
    target_interaction: RequestProvider,
    citizen_user_id: int
) -> ServiceRequest:
    """Citizen accepts a provider interest. Sets target interaction to ACCEPTED,
    declines all other pending/contacted interactions for this request, and advances status to IN_PROGRESS.
    """
    target_interaction.status = InteractionStatus.ACCEPTED
    req.status = RequestStatus.IN_PROGRESS

    other_interactions = db.query(RequestProvider).filter(
        RequestProvider.request_id == req.id,
        RequestProvider.id != target_interaction.id
    ).all()
    for other in other_interactions:
        if other.status in (InteractionStatus.PENDING, InteractionStatus.CONTACTED):
            other.status = InteractionStatus.DECLINED

    db.commit()
    db.refresh(req)

    p_name = target_interaction.provider.full_name if target_interaction.provider else "Provider"
    log_timeline_event(
        db=db,
        request_id=req.id,
        event_type="PROVIDER_SELECTED",
        title=f"Provider selected: {p_name}",
        description="Citizen accepted provider representation",
        actor_id=citizen_user_id,
    )

    log_audit(
        db=db,
        user_id=citizen_user_id,
        action="CITIZEN_ACCEPT_PROVIDER",
        resource_type="service_request",
        resource_id=req.id,
        metadata_json={"accepted_provider_id": target_interaction.provider_id}
    )

    return req


def request_completion_service(
    db: Session,
    req: ServiceRequest,
    provider_user_id: int
) -> ServiceRequest:
    """Provider requests service completion. Advances status to COMPLETION_PENDING."""
    req.status = RequestStatus.COMPLETION_PENDING
    db.commit()
    db.refresh(req)

    log_timeline_event(
        db=db,
        request_id=req.id,
        event_type="COMPLETION_SUBMITTED",
        title="Completion submitted",
        description=f"Note: {req.completion_note or 'Provider marked service as completed'}",
        actor_id=provider_user_id,
    )

    log_audit(
        db=db,
        user_id=provider_user_id,
        action="PROVIDER_REQUEST_COMPLETION",
        resource_type="service_request",
        resource_id=req.id,
        metadata_json={"status": RequestStatus.COMPLETION_PENDING.value}
    )

    return req


def complete_service_request(
    db: Session,
    req: ServiceRequest,
    provider: Optional[Provider] = None
) -> ServiceRequest:
    """Centralized completion logic for a service request.
    
    Increments provider completed requests, awards points rewards, and recalculates reliability.
    """
    req.status = RequestStatus.COMPLETED

    if not provider:
        accepted_inter = req.accepted_interaction
        if accepted_inter:
            provider = accepted_inter.provider

    if provider:
        provider.completed_requests += 1
        award_points(db, provider, PointAction.SERVICE_COMPLETED, reference_id=req.id)

        if req.legal_aid_interest:
            award_points(db, provider, PointAction.PRO_BONO_COMPLETED, reference_id=req.id)

        calculate_reliability_score(provider)

    db.commit()
    db.refresh(req)

    log_timeline_event(
        db=db,
        request_id=req.id,
        event_type="CITIZEN_CONFIRMATION",
        title="Citizen confirmation",
        description="Case completed successfully",
        actor_id=req.citizen_id,
    )

    log_audit(
        db=db,
        user_id=provider.user_id if provider else req.citizen_id,
        action="SERVICE_REQUEST_COMPLETE",
        resource_type="service_request",
        resource_id=req.id,
        metadata_json={"status": RequestStatus.COMPLETED.value, "legal_aid": req.legal_aid_interest}
    )

    return req
