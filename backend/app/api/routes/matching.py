from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.api.deps import get_current_active_user
from app.models.user import User
from app.models.provider import Provider, ProviderType, ProviderFieldDefinition, ProviderFieldValue
from app.models.request import ServiceRequest
from app.schemas.provider import ProviderFieldValueDetail
from app.schemas.matching import MatchQueryInput, MatchedProviderOut, MatchResponse
from app.services.matching_service import find_matching_providers, count_pending_matching_providers
from app.services.audit import log_audit

router = APIRouter(prefix="/matching", tags=["Matching Engine"])


from app.models.verification import (
    ProviderVerificationRecord,
    AdvocateCaseReference,
    DetailedVerificationStatus,
)


def _build_generic_fields_list(provider: Provider, db: Session) -> List[ProviderFieldValueDetail]:
    """Helper function to construct generic fields list for matched provider."""
    definitions = db.query(ProviderFieldDefinition).filter(
        ProviderFieldDefinition.provider_type == provider.provider_type
    ).all()

    values = db.query(ProviderFieldValue).filter(
        ProviderFieldValue.provider_id == provider.id
    ).all()
    val_map = {v.field_definition_id: v.value for v in values}

    result = []
    for f_def in definitions:
        result.append(
            ProviderFieldValueDetail(
                field_name=f_def.field_name,
                field_label=f_def.field_label,
                field_type=f_def.field_type,
                is_required=f_def.is_required,
                value=val_map.get(f_def.id)
            )
        )
    return result


@router.post(
    "/providers",
    response_model=MatchResponse,
    status_code=status.HTTP_200_OK,
    summary="Match providers to a citizen service request",
    description="Executes deterministic weighted matching engine. For ADVOCATE providers, outputs neutral factual details without promotional ranking labels."
)
def match_providers_for_request(
    query_in: MatchQueryInput,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
) -> MatchResponse:
    request = db.query(ServiceRequest).filter(ServiceRequest.id == query_in.request_id).first()
    if not request:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Service request with ID {query_in.request_id} not found"
        )

    matched_tuples = find_matching_providers(
        request=request,
        db=db,
        min_score=query_in.min_match_score or 0.0
    )

    pending_count = count_pending_matching_providers(
        request=request,
        db=db
    )

    output_providers: List[MatchedProviderOut] = []

    for provider, raw_score in matched_tuples:
        fields = _build_generic_fields_list(provider, db)

        is_advocate = (provider.provider_type == ProviderType.ADVOCATE)

        # Calculate Phase 5 public verification metadata (no private documents or notes exposed)
        verif_rec = db.query(ProviderVerificationRecord).filter(
            ProviderVerificationRecord.provider_id == provider.id
        ).first()

        cred_verified = (
            provider.verification_status.value == "VERIFIED" or
            (verif_rec is not None and verif_rec.credential_status == DetailedVerificationStatus.VERIFIED)
        )

        verified_cases_count = 0
        if verif_rec and verif_rec.advocate_profile:
            cases = db.query(AdvocateCaseReference).filter(
                AdvocateCaseReference.advocate_profile_id == verif_rec.advocate_profile.id,
                AdvocateCaseReference.verification_status == DetailedVerificationStatus.VERIFIED
            ).all()
            verified_cases_count = len(cases)

        out_obj = MatchedProviderOut(
            provider_id=provider.id,
            provider_type=provider.provider_type,
            full_name=provider.full_name,
            phone=provider.phone,
            location=provider.location,
            experience_years=provider.experience_years,
            bio=provider.bio,
            verification_status=provider.verification_status,
            availability_status=provider.availability_status,
            generic_fields=fields,
            # Regulatory compliance rule: For ADVOCATE, do not present promotional ranking scores
            match_score=None if is_advocate else raw_score,
            is_advocate_factual_match=is_advocate,
            professional_credential_verified=cred_verified,
            practice_evidence_reviewed=(verified_cases_count > 0),
            practice_evidence_count=verified_cases_count,
        )
        output_providers.append(out_obj)

    log_audit(
        db=db,
        user_id=current_user.id,
        action="PROVIDER_MATCHING_EXECUTE",
        resource_type="service_request",
        resource_id=request.id,
        metadata_json={
            "matched_count": len(output_providers),
            "pending_count": pending_count,
            "preferred_type": request.preferred_provider_type.value
        }
    )

    return MatchResponse(
        request_id=request.id,
        service_category=request.service_category,
        preferred_provider_type=request.preferred_provider_type,
        total_matches=len(output_providers),
        matched_providers=output_providers,
        pending_verification_count=pending_count,
        has_pending_matches=(pending_count > 0)
    )
