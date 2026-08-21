from typing import Optional, List, Dict, Any
from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field
from app.models.provider import ProviderType, VerificationStatus, AvailabilityStatus


class ProviderFieldValueInput(BaseModel):
    field_name: str
    value: Optional[str] = None


class ProviderFieldValueDetail(BaseModel):
    field_name: str
    field_label: str
    field_type: str
    is_required: bool
    value: Optional[str] = None


class ProviderProfileBase(BaseModel):
    provider_type: ProviderType = ProviderType.ADVOCATE
    full_name: str
    phone: Optional[str] = None
    location: Optional[str] = None
    experience_years: int = 0
    bio: Optional[str] = None


class ProviderProfileCreate(ProviderProfileBase):
    pass


class ProviderProfileUpdate(BaseModel):
    provider_type: Optional[ProviderType] = None
    full_name: Optional[str] = None
    phone: Optional[str] = None
    location: Optional[str] = None
    experience_years: Optional[int] = None
    bio: Optional[str] = None
    availability_status: Optional[AvailabilityStatus] = None
    field_values: Optional[List[ProviderFieldValueInput]] = Field(default_factory=list)



class ProviderProfileDetailOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    provider_type: ProviderType
    full_name: str
    phone: Optional[str] = None
    location: Optional[str] = None
    experience_years: int
    bio: Optional[str] = None
    verification_status: VerificationStatus
    profile_completion_percentage: float = 0.0
    is_profile_complete: bool = False
    points: int = 0

    reliability_score: float
    rating: float
    response_rate: float
    completed_requests: int
    total_requests: int
    availability_status: AvailabilityStatus
    created_at: datetime
    updated_at: datetime
    generic_fields: List[ProviderFieldValueDetail] = Field(default_factory=list)


class VerificationTransparencyDetail(BaseModel):
    """Structured, citizen-facing verification details with zero exposure of private documents or notes."""
    model_config = ConfigDict(from_attributes=True)

    professional_credential_verified: bool = Field(default=False, description="Primary professional credential status")
    profession: str = Field(default="Advocate", description="Provider profession type name")
    registration_authority: Optional[str] = Field(default="State Bar Council", description="Licensing or registration authority")
    enrollment_number_masked: Optional[str] = Field(default=None, description="Partially masked enrollment/registration ID")
    enrollment_year: Optional[int] = Field(default=None, description="Enrollment year")
    verification_status: VerificationStatus = Field(default=VerificationStatus.PENDING)
    last_verified_date: Optional[str] = Field(default=None, description="Formatted date of last verification activity")
    practice_evidence_status: str = Field(default="Not available", description="Practice evidence status: Reviewed | Not yet reviewed | Not available")
    practice_evidence_count: int = Field(default=0, description="Count of verified practice case references")


class ProviderPublicOut(BaseModel):
    """Publicly discoverable provider profile (hides sensitive user info, password hash, private documents, audit data)."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    provider_type: ProviderType
    full_name: str
    location: Optional[str] = None
    experience_years: int
    bio: Optional[str] = None
    verification_status: VerificationStatus
    reliability_score: float
    rating: float
    availability_status: AvailabilityStatus
    completed_requests: int
    generic_fields: List[ProviderFieldValueDetail] = Field(default_factory=list)

    # Phase 5 Public Verification Flags
    professional_credential_verified: bool = Field(default=False, description="Whether primary professional credential is verified")
    practice_evidence_reviewed: bool = Field(default=False, description="Whether secondary practice evidence has been reviewed")
    practice_evidence_count: int = Field(default=0, description="Count of verified practice case references")

    # Phase 6 Verification Transparency Section
    verification_transparency: Optional[VerificationTransparencyDetail] = Field(default=None, description="Detailed public verification transparency breakdown")


class ProviderVerificationSubmit(BaseModel):
    notes: Optional[str] = Field(default=None, description="Optional submission notes or license numbers for verification review")


class AdminVerificationDecision(BaseModel):
    status: VerificationStatus = Field(..., description="Target verification status (VERIFIED or REJECTED)")
    notes: Optional[str] = Field(default=None, description="Admin verification decision notes")


class ProviderDashboardOut(BaseModel):
    """Provider dashboard metric overview."""
    model_config = ConfigDict(from_attributes=True)

    provider_id: int
    provider_type: ProviderType
    full_name: str
    profile_completion_percentage: float
    is_profile_complete: bool
    points: int
    reliability_score: float
    total_requests: int
    completed_requests: int
    response_rate: float
    verification_status: VerificationStatus
    availability_status: AvailabilityStatus

