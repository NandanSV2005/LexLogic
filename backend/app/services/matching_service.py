from typing import List, Dict, Any, Optional, Tuple
from sqlalchemy.orm import Session
from app.models.provider import Provider, ProviderType, VerificationStatus, AvailabilityStatus, ProviderFieldValue, ProviderFieldDefinition
from app.models.request import ServiceRequest, RequestStatus
from app.models.verification import ProviderVerificationRecord, AdvocateVerificationProfile
from app.core.normalization import normalize_location, calculate_service_match_score

# Configurable transparent weight factors (Summing to 1.0)
MATCH_WEIGHTS = {
    "SERVICE_MATCH": 0.35,
    "LOCATION_MATCH": 0.25,
    "VERIFICATION": 0.15,
    "RELIABILITY": 0.15,
    "EXPERIENCE": 0.10,
}


def _extract_combined_provider_text(provider: Provider, db: Session) -> str:
    """Extracts practice areas, field values, bio, and case reference metadata into a single searchable text string."""
    text_parts = []
    
    # 1. Provider Field Values (e.g. practice_area, specialization, etc.)
    field_values = db.query(ProviderFieldValue).join(
        ProviderFieldDefinition, ProviderFieldValue.field_definition_id == ProviderFieldDefinition.id
    ).filter(
        ProviderFieldValue.provider_id == provider.id
    ).all()
    for f in field_values:
        if f.value:
            text_parts.append(f.value)

    # 2. Advocate Case References metadata (if advocate)
    if provider.verification_record and provider.verification_record.advocate_profile:
        adv_p = provider.verification_record.advocate_profile
        if adv_p.case_references:
            for c_ref in adv_p.case_references:
                if c_ref.case_type:
                    text_parts.append(c_ref.case_type)
                if c_ref.court_name:
                    text_parts.append(c_ref.court_name)

    # 3. Provider Bio
    if provider.bio:
        text_parts.append(provider.bio)

    return " ".join(text_parts)


def calculate_provider_match_score(
    provider: Provider,
    request: ServiceRequest,
    db: Session
) -> float:
    """Calculates a transparent deterministic match score (0-100) for a provider against a service request.
    
    Formula Component Weights:
    - Service Match (35%): Tiered match (100.0 exact, 60.0 related/partial, 40.0 baseline) using centralized normalization
    - Location Match (25%): Canonical city match (100.0 exact/alias match, 80.0 substring/part, 20.0 fallback)
    - Verification   (15%): VERIFIED = 100.0, SUBMITTED = 50.0, PENDING/REJECTED = 0.0
    - Reliability    (15%): provider.reliability_score (0-100)
    - Experience     (10%): Min(100.0, provider.experience_years * 10.0)
    
    Note: Payment/subscription status has 0 weight and 0 influence on matching.
    """
    # 1. Service/Category Match Score (35%)
    combined_provider_text = _extract_combined_provider_text(provider, db)
    service_score = calculate_service_match_score(
        request_category=request.service_category,
        request_description=request.description or "",
        combined_provider_text=combined_provider_text
    )

    # 2. Location Match Score (25%) using centralized canonical normalization
    loc_score = 0.0
    if provider.location and request.location:
        prov_canon_loc = normalize_location(provider.location)
        req_canon_loc = normalize_location(request.location)

        if prov_canon_loc == req_canon_loc:
            loc_score = 100.0
        elif req_canon_loc in prov_canon_loc or prov_canon_loc in req_canon_loc:
            loc_score = 80.0
        else:
            # Substring fallback check
            prov_raw = provider.location.lower().strip()
            req_raw = request.location.lower().strip()
            if any(part in prov_raw for part in req_raw.split(",") if len(part) > 2):
                loc_score = 80.0
            else:
                loc_score = 20.0

    # 3. Verification Score (15%)
    if provider.verification_status == VerificationStatus.VERIFIED:
        ver_score = 100.0
    elif provider.verification_status == VerificationStatus.SUBMITTED:
        ver_score = 50.0
    else:
        ver_score = 0.0

    # 4. Reliability Score (15%)
    rel_score = provider.reliability_score

    # 5. Experience Score (10%)
    exp_score = min(100.0, provider.experience_years * 10.0)

    # Weighted calculation
    total_score = (
        (MATCH_WEIGHTS["SERVICE_MATCH"] * service_score) +
        (MATCH_WEIGHTS["LOCATION_MATCH"] * loc_score) +
        (MATCH_WEIGHTS["VERIFICATION"] * ver_score) +
        (MATCH_WEIGHTS["RELIABILITY"] * rel_score) +
        (MATCH_WEIGHTS["EXPERIENCE"] * exp_score)
    )

    return round(max(0.0, min(100.0, total_score)), 1)


def find_matching_providers(
    request: ServiceRequest,
    db: Session,
    min_score: float = 0.0
) -> List[Tuple[Provider, float]]:
    """Filters eligible providers and calculates match scores for a service request.

    HARD SAFETY CONDITION (PHASE 5):
    Only providers who have completed professional verification (verification_status == VERIFIED)
    are eligible for citizen matching. Unverified or pending providers are strictly filtered out at backend.
    """
    query = db.query(Provider).filter(
        Provider.provider_type == request.preferred_provider_type,
        Provider.availability_status != AvailabilityStatus.UNAVAILABLE,
        Provider.verification_status == VerificationStatus.VERIFIED
    )

    providers = query.all()
    results = []

    for prov in providers:
        score = calculate_provider_match_score(prov, request, db)
        if score >= min_score:
            results.append((prov, score))

    # Sort deterministically by match score descending
    results.sort(key=lambda x: x[1], reverse=True)
    return results


def count_pending_matching_providers(
    request: ServiceRequest,
    db: Session
) -> int:
    """Returns an anonymized integer count of registered providers matching request profession, location,
    and category whose verification is currently SUBMITTED or PENDING.
    
    Privacy Guarantee: Exposes ZERO individual provider records or personal fields.
    """
    query = db.query(Provider).filter(
        Provider.provider_type == request.preferred_provider_type,
        Provider.availability_status != AvailabilityStatus.UNAVAILABLE,
        Provider.verification_status.in_([VerificationStatus.SUBMITTED, VerificationStatus.PENDING])
    )

    pending_providers = query.all()
    matching_pending_count = 0

    req_canon_loc = normalize_location(request.location)

    for prov in pending_providers:
        prov_canon_loc = normalize_location(prov.location)
        # Check canonical location match or substring match
        is_loc_match = (
            prov_canon_loc == req_canon_loc or
            req_canon_loc in prov_canon_loc or
            prov_canon_loc in req_canon_loc
        )

        if is_loc_match:
            combined_text = _extract_combined_provider_text(prov, db)
            service_score = calculate_service_match_score(
                request_category=request.service_category,
                request_description=request.description or "",
                combined_provider_text=combined_text
            )
            # If provider matches category (above baseline 40.0 or exact/related match)
            if service_score >= 40.0:
                matching_pending_count += 1

    return matching_pending_count
