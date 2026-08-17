from typing import Optional
from sqlalchemy.orm import Session
from app.models.request import ServiceRequest, RequestStatus, RequestProvider, InteractionStatus
from app.models.provider import Provider
from app.models.points import PointAction
from app.schemas.request import ServiceRequestCreate
from app.services.points_service import award_points
from app.services.reliability_service import calculate_reliability_score
from app.services.audit import log_audit


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
    # Look for existing interaction or create new
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

    # Advance request status from OPEN to CONTACTED
    if req.status == RequestStatus.OPEN:
        req.status = RequestStatus.CONTACTED

    db.commit()
    db.refresh(interaction)

    # Award points for responding (+10 points)
    award_points(db, provider, PointAction.REQUEST_RESPONDED, reference_id=req.id)

    # Recalculate reliability score
    calculate_reliability_score(provider)
    db.commit()

    log_audit(
        db=db,
        user_id=provider.user_id,
        action="PROVIDER_REQUEST_RESPOND",
        resource_type="service_request",
        resource_id=req.id,
        metadata_json={"provider_id": provider.id}
    )

    return interaction


def complete_service_request(
    db: Session,
    req: ServiceRequest,
    provider: Optional[Provider] = None
) -> ServiceRequest:
    """Centralized completion logic for a service request.
    
    Increments provider completed requests, awards points rewards, and recalculates reliability.
    """
    req.status = RequestStatus.COMPLETED

    if provider:
        provider.completed_requests += 1

        # Award standard completion reward (+20 points)
        award_points(db, provider, PointAction.SERVICE_COMPLETED, reference_id=req.id)

        # If flagged for legal aid interest, award pro-bono incentive (+30 points)
        if req.legal_aid_interest:
            award_points(db, provider, PointAction.PRO_BONO_COMPLETED, reference_id=req.id)

        # Recalculate provider reliability score
        calculate_reliability_score(provider)


    db.commit()
    db.refresh(req)

    log_audit(
        db=db,
        user_id=provider.user_id if provider else req.citizen_id,
        action="SERVICE_REQUEST_COMPLETE",
        resource_type="service_request",
        resource_id=req.id,
        metadata_json={"status": RequestStatus.COMPLETED.value, "legal_aid": req.legal_aid_interest}
    )

    return req
