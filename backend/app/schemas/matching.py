from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field
from app.models.provider import ProviderType, VerificationStatus, AvailabilityStatus
from app.schemas.provider import ProviderFieldValueDetail


class MatchQueryInput(BaseModel):
    request_id: int = Field(..., description="ID of the citizen service request to match against")
    min_match_score: Optional[float] = Field(default=0.0, description="Optional minimum score filter (0-100)")


class MatchedProviderOut(BaseModel):
    """Output schema for matched provider details.
    
    Adheres strictly to Advocate regulatory compliance:
    For ADVOCATE providers, promotional ranking titles ('Top Lawyer', 'Rank #1') are strictly omitted.
    Matches are presented as neutral factual responses based on citizen-stated requirements.
    """
    model_config = ConfigDict(from_attributes=True)

    provider_id: int
    provider_type: ProviderType
    full_name: str
    phone: Optional[str] = None
    location: str
    experience_years: int
    bio: Optional[str] = None
    verification_status: VerificationStatus
    availability_status: AvailabilityStatus
    generic_fields: List[ProviderFieldValueDetail] = []
    
    # Matching metrics
    # For non-Advocate providers, match_score is exposed.
    # For Advocates, match_score is omitted (None) to avoid promotional ranking presentation.
    match_score: Optional[float] = Field(default=None, description="Deterministic match score (omitted for ADVOCATE per regulatory rules)")
    is_advocate_factual_match: bool = Field(default=False, description="Flag indicating factual non-promotional advocate match")

    # Phase 5 Factual Verification Info (Publicly safe)
    professional_credential_verified: bool = Field(default=False, description="Whether primary professional credential is verified")
    practice_evidence_reviewed: bool = Field(default=False, description="Whether secondary practice evidence has been reviewed")
    practice_evidence_count: int = Field(default=0, description="Count of verified practice case references")


class MatchResponse(BaseModel):
    request_id: int
    service_category: str
    preferred_provider_type: ProviderType
    total_matches: int
    matched_providers: List[MatchedProviderOut]
    pending_verification_count: int = Field(default=0, description="Anonymized count of matching providers awaiting verification")
    has_pending_matches: bool = Field(default=False, description="Flag indicating if matching providers exist under verification review")
