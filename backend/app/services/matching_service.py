from typing import List, Dict, Any, Optional, Tuple
from sqlalchemy.orm import Session
from app.models.provider import Provider, ProviderType, VerificationStatus, AvailabilityStatus, ProviderFieldValue, ProviderFieldDefinition
from app.models.request import ServiceRequest, RequestStatus

# Configurable transparent weight factors (Summing to 1.0)
MATCH_WEIGHTS = {
    "SERVICE_MATCH": 0.35,
    "LOCATION_MATCH": 0.25,
    "VERIFICATION": 0.15,
    "RELIABILITY": 0.15,
    "EXPERIENCE": 0.10,
}


def calculate_provider_match_score(
    provider: Provider,
    request: ServiceRequest,
    db: Session
) -> float:
    """Calculates a transparent deterministic match score (0-100) for a provider against a service request.
    
    Formula Component Weights:
    - Service Match (35%): Matches request service_category/description against generic field values (practice_area, specialization, etc.)
    - Location Match (25%): Substring/exact match between provider location and request location
    - Verification   (15%): VERIFIED = 100.0, SUBMITTED = 50.0, PENDING/REJECTED = 0.0
    - Reliability    (15%): provider.reliability_score (0-100)
    - Experience     (10%): Min(100.0, provider.experience_years * 10.0)
    
    Note: Payment/subscription status has 0 weight and 0 influence on matching.
    """
    # 1. Service/Category Match Score (35%)
    # Fetch provider's generic field values
    field_values = db.query(ProviderFieldValue).join(
        ProviderFieldDefinition, ProviderFieldValue.field_definition_id == ProviderFieldDefinition.id
    ).filter(
        ProviderFieldValue.provider_id == provider.id
    ).all()

    combined_field_text = " ".join([v.value.lower() for v in field_values if v.value])
    cat_lower = request.service_category.lower()
    desc_lower = request.description.lower()

    service_score = 0.0
    if cat_lower in combined_field_text or any(word in combined_field_text for word in cat_lower.split() if len(word) > 3):
        service_score = 100.0
    elif desc_lower and any(word in combined_field_text for word in desc_lower.split() if len(word) > 4):
        service_score = 60.0
    else:
        service_score = 40.0  # Baseline type match score

    # 2. Location Match Score (25%)
    loc_score = 0.0
    if provider.location and request.location:
        prov_loc = provider.location.lower().strip()
        req_loc = request.location.lower().strip()
        if prov_loc == req_loc:
            loc_score = 100.0
        elif req_loc in prov_loc or prov_loc in req_loc or any(part in prov_loc for part in req_loc.split(",") if len(part) > 2):
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
    """Filters eligible providers and calculates match scores for a service request."""
    # Filter 1: Provider type match & non-UNAVAILABLE status
    query = db.query(Provider).filter(
        Provider.provider_type == request.preferred_provider_type,
        Provider.availability_status != AvailabilityStatus.UNAVAILABLE
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
