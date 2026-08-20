from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field
from app.models.verification import DetailedVerificationStatus, CredentialType, EvidenceStatus


class AdvocateCaseReferenceInput(BaseModel):
    case_number: str = Field(..., description="Case or citation reference number")
    court_name: str = Field(..., description="Name of court or tribunal")
    case_type: Optional[str] = Field(None, description="Type of case (e.g. Civil Litigation, Constitutional)")
    case_year: Optional[int] = Field(None, description="Year case was heard or filed")
    advocate_role: Optional[str] = Field(None, description="Role in case (e.g. Lead Counsel, Co-Counsel)")
    supporting_document_id: Optional[int] = Field(None, description="Optional private document ID reference")


class AdvocateCaseReferenceUpdate(BaseModel):
    case_number: Optional[str] = Field(None, description="Case or citation reference number")
    court_name: Optional[str] = Field(None, description="Name of court or tribunal")
    case_type: Optional[str] = Field(None, description="Type of case (e.g. Civil Litigation, Constitutional)")
    case_year: Optional[int] = Field(None, description="Year case was heard or filed")
    advocate_role: Optional[str] = Field(None, description="Role in case (e.g. Lead Counsel, Co-Counsel)")
    supporting_document_id: Optional[int] = Field(None, description="Optional private document ID reference")


class AdminCaseEvidenceReview(BaseModel):
    status: DetailedVerificationStatus = Field(..., description="Target verification status (VERIFIED, UNVERIFIED, NEEDS_REVIEW, PENDING_REVIEW)")
    notes: Optional[str] = Field(None, description="Admin review notes")
    evidence_source_reference: Optional[str] = Field(None, description="Verification evidence source reference or portal URL")


class AdvocateCaseReferenceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    advocate_profile_id: int
    provider_id: int
    case_number: str
    court_name: str
    case_type: Optional[str] = None
    case_year: Optional[int] = None
    advocate_role: Optional[str] = None
    supporting_document_id: Optional[int] = None
    evidence_status: EvidenceStatus
    verification_status: DetailedVerificationStatus
    evidence_source_reference: Optional[str] = None
    verification_notes: Optional[str] = None
    verified_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime


class AdvocateVerificationSubmit(BaseModel):
    full_legal_name: Optional[str] = Field(None, description="Full legal name of advocate")
    jurisdiction_city: Optional[str] = Field(None, description="Primary city of legal practice")
    jurisdiction_state: Optional[str] = Field(None, description="Primary state of legal practice")
    state_bar_council: str = Field(..., description="State Bar Council enrollment authority")
    enrollment_number: str = Field(..., description="Bar Council enrollment registration number")
    enrollment_year: int = Field(..., description="Year of Bar enrollment")
    credential_type: CredentialType = Field(CredentialType.BAR_ENROLLMENT_CERTIFICATE, description="Type of professional credential")
    credential_document_id: Optional[int] = Field(None, description="Uploaded credential document ID")
    practice_areas: Optional[str] = Field(None, description="Primary legal practice specialization areas")
    case_references: List[AdvocateCaseReferenceInput] = Field(default_factory=list, description="Optional non-confidential practice case references")


class AdvocateVerificationProfileOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    verification_record_id: int
    provider_id: int
    full_legal_name: Optional[str] = None
    jurisdiction_city: Optional[str] = None
    jurisdiction_state: Optional[str] = None
    state_bar_council: Optional[str] = None
    enrollment_number: Optional[str] = None
    enrollment_year: Optional[int] = None
    credential_type: CredentialType
    credential_document_id: Optional[int] = None
    credential_verification_status: DetailedVerificationStatus
    credential_verified_at: Optional[datetime] = None
    verification_source_reference: Optional[str] = None
    verification_notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    case_references: List[AdvocateCaseReferenceOut] = Field(default_factory=list)


class ProviderVerificationHistoryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    verification_record_id: int
    provider_id: int
    actor_id: Optional[int] = None
    action: str
    from_status: Optional[str] = None
    to_status: str
    notes: Optional[str] = None
    timestamp: datetime


class ProviderVerificationRecordOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    provider_id: int
    overall_status: DetailedVerificationStatus
    identity_status: DetailedVerificationStatus
    credential_status: DetailedVerificationStatus
    practice_status: DetailedVerificationStatus
    last_reviewed_by_admin_id: Optional[int] = None
    last_reviewed_at: Optional[datetime] = None
    verification_notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    advocate_profile: Optional[AdvocateVerificationProfileOut] = None
    history_entries: List[ProviderVerificationHistoryOut] = Field(default_factory=list)


class AdminVerificationQueueItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    provider_id: int
    user_id: int
    user_email: str
    full_name: str
    profession: str
    overall_status: DetailedVerificationStatus
    submitted_at: Optional[datetime] = None
    credential_status: DetailedVerificationStatus
    practice_evidence_status: DetailedVerificationStatus
    last_activity_timestamp: Optional[datetime] = None
    last_activity_notes: Optional[str] = None
    last_reviewed_by_admin_id: Optional[int] = None


class AdminVerificationDetailsOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    # IDENTITY
    provider_id: int
    user_id: int
    user_email: str
    full_name: str
    phone: Optional[str] = None
    location: Optional[str] = None
    bio: Optional[str] = None
    experience_years: int
    created_at: datetime

    # PROFESSIONAL CREDENTIAL
    profession: str
    state_bar_council: Optional[str] = None
    enrollment_number: Optional[str] = None
    enrollment_year: Optional[int] = None
    jurisdiction_state: Optional[str] = None
    credential_type: Optional[CredentialType] = None
    credential_document_id: Optional[int] = None
    credential_document_filename: Optional[str] = None
    credential_verification_status: DetailedVerificationStatus
    credential_notes: Optional[str] = None

    # PRACTICE EVIDENCE & OVERALL RECORD
    overall_status: DetailedVerificationStatus
    identity_status: DetailedVerificationStatus
    credential_status: DetailedVerificationStatus
    practice_status: DetailedVerificationStatus
    last_reviewed_by_admin_id: Optional[int] = None
    last_reviewed_at: Optional[datetime] = None
    verification_notes: Optional[str] = None
    case_references: List[AdvocateCaseReferenceOut] = Field(default_factory=list)
    history_entries: List[ProviderVerificationHistoryOut] = Field(default_factory=list)


class AdminDecisionInput(BaseModel):
    action: str = Field(..., description="Action: APPROVE_CREDENTIAL, REJECT_CREDENTIAL, REQUEST_ADDITIONAL_INFO, MARK_MANUAL_REVIEW")
    target_status: Optional[DetailedVerificationStatus] = Field(None, description="Optional target status override")
    notes: str = Field(..., description="Mandatory admin decision reason note")

