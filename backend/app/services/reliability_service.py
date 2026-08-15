from app.models.provider import Provider, VerificationStatus, AvailabilityStatus


def calculate_reliability_score(provider: Provider) -> float:
    """Calculates provider reliability score (0-100) using a transparent weighted formula.
    
    Formula Component Weights:
    - Profile Completeness (20%): profile_completion_percentage
    - Verification Status  (25%): VERIFIED = 100.0, SUBMITTED = 50.0, PENDING/REJECTED = 0.0
    - Response Rate        (20%): response_rate (0-100)
    - Availability Status  (15%): AVAILABLE = 100.0, BUSY = 50.0, UNAVAILABLE = 0.0
    - Request Completion   (20%): (completed_requests / total_requests * 100) if total_requests > 0 else 50.0
    """
    # 1. Profile Completeness component (20%)
    completion_score = provider.profile_completion_percentage

    # 2. Verification Status component (25%)
    if provider.verification_status == VerificationStatus.VERIFIED:
        verification_score = 100.0
    elif provider.verification_status == VerificationStatus.SUBMITTED:
        verification_score = 50.0
    else:
        verification_score = 0.0

    # 3. Response Rate component (20%)
    response_score = provider.response_rate

    # 4. Availability Status component (15%)
    if provider.availability_status == AvailabilityStatus.AVAILABLE:
        availability_score = 100.0
    elif provider.availability_status == AvailabilityStatus.BUSY:
        availability_score = 50.0
    else:
        availability_score = 0.0

    # 5. Activity / Request Completion component (20%)
    if provider.total_requests > 0:
        activity_score = (provider.completed_requests / provider.total_requests) * 100.0
    else:
        activity_score = 50.0  # Baseline neutral score for new providers

    # Calculate weighted total
    raw_score = (
        (0.20 * completion_score) +
        (0.25 * verification_score) +
        (0.20 * response_score) +
        (0.15 * availability_score) +
        (0.20 * activity_score)
    )

    # Normalize to 0 - 100.0
    normalized_score = round(max(0.0, min(100.0, raw_score)), 1)

    provider.reliability_score = normalized_score
    return normalized_score
