from typing import List, Optional
from datetime import datetime, timezone
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.api.deps import require_provider, require_admin, get_current_active_user
from app.models.user import User
from app.models.provider import (
    Provider,
    ProviderType,
    VerificationStatus,
    ProviderFieldDefinition,
    ProviderFieldValue,
)
from app.models.points import PointTransaction, PointAction
from app.models.document import Document, DocumentVisibility
from app.schemas.document import DocumentOut
from app.services.document_storage import validate_and_save_upload_file
from app.models.verification import (
    DetailedVerificationStatus,
    CredentialType,
    EvidenceStatus,
    ProviderVerificationRecord,
    AdvocateVerificationProfile,
    AdvocateCaseReference,
    ProviderVerificationHistory,
)
from app.services.practice_verifier import ManualPracticeEvidenceVerifier
from app.schemas.verification import (
    AdvocateCaseReferenceInput,
    AdvocateCaseReferenceUpdate,
    AdminCaseEvidenceReview,
    AdvocateVerificationSubmit,
    ProviderVerificationHistoryOut,
    ProviderVerificationRecordOut,
    AdvocateVerificationProfileOut,
    AdvocateCaseReferenceOut,
    AdminVerificationQueueItem,
    AdminVerificationDetailsOut,
    AdminDecisionInput,
)
from app.services.points_service import award_points

from app.schemas.provider import (
    ProviderProfileCreate,
    ProviderProfileUpdate,
    ProviderProfileDetailOut,
    ProviderFieldValueInput,
    ProviderFieldValueDetail,
    ProviderPublicOut,
    VerificationTransparencyDetail,
    ProviderVerificationSubmit,
    AdminVerificationDecision,
    ProviderDashboardOut,
)

from app.schemas.points import PointTransactionOut, PointsSummaryOut
from app.services.provider_service import (
    calculate_profile_completion,
    update_provider_generic_fields,
)
from app.services.reliability_service import calculate_reliability_score
from app.services.audit import log_audit

router = APIRouter(prefix="/providers", tags=["Providers"])


def _build_generic_fields_list(provider: Provider, db: Session) -> List[ProviderFieldValueDetail]:
    """Helper function to construct a complete generic fields list combining definitions and saved values."""
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
    "/profile",
    response_model=ProviderProfileDetailOut,
    status_code=status.HTTP_201_CREATED,
    summary="Create or initialize provider profile",
    description="Instantiates or sets up provider profile for authenticated provider user."
)
def create_provider_profile(
    profile_in: ProviderProfileCreate,
    current_user: User = Depends(require_provider),
    db: Session = Depends(get_db)
) -> ProviderProfileDetailOut:
    existing = db.query(Provider).filter(Provider.user_id == current_user.id).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Provider profile already exists. Use PUT /api/providers/me to update your profile."
        )

    provider = Provider(
        user_id=current_user.id,
        provider_type=profile_in.provider_type,
        full_name=profile_in.full_name,
        phone=profile_in.phone,
        location=profile_in.location,
        experience_years=profile_in.experience_years,
        bio=profile_in.bio,
    )
    db.add(provider)
    db.commit()
    db.refresh(provider)

    calculate_profile_completion(provider, db)

    log_audit(
        db=db,
        user_id=current_user.id,
        action="PROVIDER_PROFILE_CREATE",
        resource_type="provider",
        resource_id=provider.id,
        metadata_json={"provider_type": provider.provider_type.value}
    )

    out = ProviderProfileDetailOut.model_validate(provider)
    out.generic_fields = _build_generic_fields_list(provider, db)
    return out


@router.get(
    "/me",
    response_model=ProviderProfileDetailOut,
    status_code=status.HTTP_200_OK,
    summary="Get current provider profile",
    description="Returns full profile details, generic field values, and completion percentage for current provider."
)
def get_my_provider_profile(
    current_user: User = Depends(require_provider),
    db: Session = Depends(get_db)
) -> ProviderProfileDetailOut:
    provider = db.query(Provider).filter(Provider.user_id == current_user.id).first()
    if not provider:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Provider profile not found. Complete provider registration first."
        )

    calculate_profile_completion(provider, db)

    out = ProviderProfileDetailOut.model_validate(provider)
    out.generic_fields = _build_generic_fields_list(provider, db)
    return out


@router.put(
    "/me",
    response_model=ProviderProfileDetailOut,
    status_code=status.HTTP_200_OK,
    summary="Update current provider profile",
    description="Updates provider base fields and provider-type-specific generic fields."
)
def update_my_provider_profile(
    profile_in: ProviderProfileUpdate,
    current_user: User = Depends(require_provider),
    db: Session = Depends(get_db)
) -> ProviderProfileDetailOut:
    provider = db.query(Provider).filter(Provider.user_id == current_user.id).first()
    if not provider:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Provider profile not found"
        )

    if profile_in.provider_type is not None:
        provider.provider_type = profile_in.provider_type
    if profile_in.full_name is not None:
        provider.full_name = profile_in.full_name
    if profile_in.phone is not None:
        provider.phone = profile_in.phone
    if profile_in.location is not None:
        provider.location = profile_in.location
    if profile_in.experience_years is not None:
        provider.experience_years = profile_in.experience_years
    if profile_in.bio is not None:
        provider.bio = profile_in.bio
    if profile_in.availability_status is not None:
        provider.availability_status = profile_in.availability_status
        award_points(db, provider, PointAction.AVAILABILITY_ADDED)

    db.commit()


    if profile_in.field_values:
        field_dicts = [fv.model_dump() for fv in profile_in.field_values]
        update_provider_generic_fields(db, provider, field_dicts)

    calculate_profile_completion(provider, db)

    log_audit(
        db=db,
        user_id=current_user.id,
        action="PROVIDER_PROFILE_UPDATE",
        resource_type="provider",
        resource_id=provider.id,
        metadata_json={"completion_pct": provider.profile_completion_percentage}
    )

    out = ProviderProfileDetailOut.model_validate(provider)
    out.generic_fields = _build_generic_fields_list(provider, db)
    return out


class ProviderGenericFieldsUpdatePayload(BaseModel):
    fields: List[ProviderFieldValueInput]


@router.put(
    "/fields",
    response_model=ProviderProfileDetailOut,
    status_code=status.HTTP_200_OK,
    summary="Update provider generic fields",
    description="Updates provider-type-specific generic fields."
)
def update_my_generic_fields(
    fields_in: ProviderGenericFieldsUpdatePayload,
    current_user: User = Depends(require_provider),
    db: Session = Depends(get_db)
) -> ProviderProfileDetailOut:
    provider = db.query(Provider).filter(Provider.user_id == current_user.id).first()
    if not provider:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Provider profile not found"
        )

    field_dicts = [fv.model_dump() for fv in fields_in.fields]
    update_provider_generic_fields(db, provider, field_dicts)
    calculate_profile_completion(provider, db)
    db.commit()

    out = ProviderProfileDetailOut.model_validate(provider)
    out.generic_fields = _build_generic_fields_list(provider, db)
    return out



@router.get(
    "/me/points",
    response_model=PointsSummaryOut,
    status_code=status.HTTP_200_OK,
    summary="Get current provider points summary",
    description="Returns current provider total accumulated points and transaction count."
)
def get_my_points(
    current_user: User = Depends(require_provider),
    db: Session = Depends(get_db)
) -> PointsSummaryOut:
    provider = db.query(Provider).filter(Provider.user_id == current_user.id).first()
    if not provider:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Provider profile not found")

    count = db.query(PointTransaction).filter(PointTransaction.provider_id == provider.id).count()
    return PointsSummaryOut(total_points=provider.points, transactions_count=count)


@router.get(
    "/me/points/history",
    response_model=List[PointTransactionOut],
    status_code=status.HTTP_200_OK,
    summary="Get current provider point transaction history",
    description="Returns list of point transaction history entries for the authenticated provider (Enforces provider isolation)."
)
def get_my_points_history(
    current_user: User = Depends(require_provider),
    db: Session = Depends(get_db)
) -> List[PointTransactionOut]:
    provider = db.query(Provider).filter(Provider.user_id == current_user.id).first()
    if not provider:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Provider profile not found")

    transactions = db.query(PointTransaction).filter(
        PointTransaction.provider_id == provider.id
    ).order_by(PointTransaction.created_at.desc()).all()

    return [PointTransactionOut.model_validate(tx) for tx in transactions]


@router.get(
    "/me/dashboard",
    response_model=ProviderDashboardOut,
    status_code=status.HTTP_200_OK,
    summary="Get current provider dashboard overview",
    description="Returns metrics overview: profile completion, points, reliability score, requests, verification, availability."
)
def get_my_dashboard(
    current_user: User = Depends(require_provider),
    db: Session = Depends(get_db)
) -> ProviderDashboardOut:
    provider = db.query(Provider).filter(Provider.user_id == current_user.id).first()
    if not provider:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Provider profile not found")

    calculate_profile_completion(provider, db)
    calculate_reliability_score(provider)
    db.commit()

    return ProviderDashboardOut(
        provider_id=provider.id,
        provider_type=provider.provider_type,
        full_name=provider.full_name,
        profile_completion_percentage=provider.profile_completion_percentage,
        is_profile_complete=provider.is_profile_complete,
        points=provider.points,
        reliability_score=provider.reliability_score,
        total_requests=provider.total_requests,
        completed_requests=provider.completed_requests,
        response_rate=provider.response_rate,
        verification_status=provider.verification_status,
        availability_status=provider.availability_status,
    )


@router.post(
    "/me/verification",
    response_model=ProviderProfileDetailOut,
    status_code=status.HTTP_200_OK,
    summary="Submit profile for prototype verification",
    description="Transitions provider verification status from PENDING to SUBMITTED for admin review."
)
def submit_verification(
    verify_in: Optional[ProviderVerificationSubmit] = None,
    current_user: User = Depends(require_provider),
    db: Session = Depends(get_db)
) -> ProviderProfileDetailOut:
    provider = db.query(Provider).filter(Provider.user_id == current_user.id).first()
    if not provider:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Provider profile not found"
        )

    provider.verification_status = VerificationStatus.SUBMITTED
    db.commit()
    db.refresh(provider)

    calculate_profile_completion(provider, db)

    log_audit(
        db=db,
        user_id=current_user.id,
        action="PROVIDER_VERIFICATION_SUBMIT",
        resource_type="provider",
        resource_id=provider.id,
        metadata_json={"status": VerificationStatus.SUBMITTED.value}
    )

    out = ProviderProfileDetailOut.model_validate(provider)
    out.generic_fields = _build_generic_fields_list(provider, db)
    return out


@router.get(
    "/verification/me",
    response_model=ProviderVerificationRecordOut,
    status_code=status.HTTP_200_OK,
    summary="Get current provider verification record and advocate profile",
    description="Returns current provider verification record, detailed status indicators, advocate profile, case references, and audit history entries."
)
def get_provider_verification_record(
    current_user: User = Depends(require_provider),
    db: Session = Depends(get_db)
) -> ProviderVerificationRecordOut:
    provider = db.query(Provider).filter(Provider.user_id == current_user.id).first()
    if not provider:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Provider profile not found"
        )

    verif_record = db.query(ProviderVerificationRecord).filter(ProviderVerificationRecord.provider_id == provider.id).first()
    if not verif_record:
        verif_record = ProviderVerificationRecord(
            provider_id=provider.id,
            overall_status=DetailedVerificationStatus.NOT_STARTED,
            identity_status=DetailedVerificationStatus.NOT_STARTED,
            credential_status=DetailedVerificationStatus.NOT_STARTED,
            practice_status=DetailedVerificationStatus.NOT_STARTED,
        )
        db.add(verif_record)
        db.commit()
        db.refresh(verif_record)

    return ProviderVerificationRecordOut.model_validate(verif_record)


@router.post(
    "/verification/advocate/submit",
    response_model=ProviderVerificationRecordOut,
    status_code=status.HTTP_200_OK,
    summary="Submit advocate professional credential & practice verification",
    description="Submits State Bar Council registration, credential evidence document, and optional case metadata references. Updates verification state to SUBMITTED for admin review."
)
def submit_advocate_verification(
    submit_in: AdvocateVerificationSubmit,
    current_user: User = Depends(require_provider),
    db: Session = Depends(get_db)
) -> ProviderVerificationRecordOut:
    provider = db.query(Provider).filter(Provider.user_id == current_user.id).first()
    if not provider:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Provider profile not found"
        )

    verif_record = db.query(ProviderVerificationRecord).filter(ProviderVerificationRecord.provider_id == provider.id).first()
    if not verif_record:
        verif_record = ProviderVerificationRecord(provider_id=provider.id)
        db.add(verif_record)
        db.commit()
        db.refresh(verif_record)

    adv_profile = db.query(AdvocateVerificationProfile).filter(AdvocateVerificationProfile.verification_record_id == verif_record.id).first()
    if not adv_profile:
        adv_profile = AdvocateVerificationProfile(
            verification_record_id=verif_record.id,
            provider_id=provider.id,
        )
        db.add(adv_profile)

    adv_profile.full_legal_name = submit_in.full_legal_name or provider.full_name
    adv_profile.jurisdiction_city = submit_in.jurisdiction_city or provider.location
    adv_profile.jurisdiction_state = submit_in.jurisdiction_state
    adv_profile.state_bar_council = submit_in.state_bar_council
    adv_profile.enrollment_number = submit_in.enrollment_number
    adv_profile.enrollment_year = submit_in.enrollment_year
    adv_profile.credential_type = submit_in.credential_type
    adv_profile.credential_document_id = submit_in.credential_document_id
    adv_profile.credential_verification_status = DetailedVerificationStatus.SUBMITTED
    db.commit()
    db.refresh(adv_profile)

    if submit_in.practice_areas:
        generic_updates = [
            {"field_name": "practice_area", "value": submit_in.practice_areas},
            {"field_name": "bar_registration", "value": submit_in.enrollment_number},
        ]
        update_provider_generic_fields(db, provider, generic_updates)

    db.query(AdvocateCaseReference).filter(AdvocateCaseReference.advocate_profile_id == adv_profile.id).delete()
    db.commit()

    has_case_references = len(submit_in.case_references) > 0
    for case_in in submit_in.case_references:
        case_ref = AdvocateCaseReference(
            advocate_profile_id=adv_profile.id,
            provider_id=provider.id,
            case_number=case_in.case_number,
            court_name=case_in.court_name,
            case_type=case_in.case_type,
            case_year=case_in.case_year,
            advocate_role=case_in.advocate_role,
            supporting_document_id=case_in.supporting_document_id,
            evidence_status=EvidenceStatus.SUBMITTED,
            verification_status=DetailedVerificationStatus.SUBMITTED,
        )
        db.add(case_ref)

    old_status = verif_record.overall_status.value
    verif_record.overall_status = DetailedVerificationStatus.SUBMITTED
    verif_record.identity_status = DetailedVerificationStatus.SUBMITTED
    verif_record.credential_status = DetailedVerificationStatus.SUBMITTED
    verif_record.practice_status = DetailedVerificationStatus.SUBMITTED if has_case_references else DetailedVerificationStatus.NOT_STARTED

    history = ProviderVerificationHistory(
        verification_record_id=verif_record.id,
        provider_id=provider.id,
        actor_id=current_user.id,
        action="SUBMITTED_ADVOCATE_VERIFICATION",
        from_status=old_status,
        to_status=DetailedVerificationStatus.SUBMITTED.value,
        notes=f"Submitted Bar Enrollment {submit_in.enrollment_number} ({submit_in.state_bar_council}) with {len(submit_in.case_references)} case reference(s)."
    )
    db.add(history)

    provider.verification_status = VerificationStatus.SUBMITTED

    db.commit()
    db.refresh(verif_record)
    db.refresh(provider)

    calculate_profile_completion(provider, db)

    log_audit(
        db=db,
        user_id=current_user.id,
        action="SUBMITTED_ADVOCATE_VERIFICATION",
        resource_type="provider",
        resource_id=provider.id,
        metadata_json={
            "enrollment_number": submit_in.enrollment_number,
            "state_bar_council": submit_in.state_bar_council,
            "case_references_count": len(submit_in.case_references),
        }
    )

    return ProviderVerificationRecordOut.model_validate(verif_record)


@router.post(
    "/verification/credential-document",
    response_model=DocumentOut,
    status_code=status.HTTP_201_CREATED,
    summary="Upload advocate verification credential document into private vault",
    description="Uploads bar certificate or ID card file into private storage bound strictly to provider ownership."
)
async def upload_credential_document(
    file: UploadFile = File(...),
    current_user: User = Depends(require_provider),
    db: Session = Depends(get_db)
) -> Document:
    content = await file.read()
    storage_path, sanitized_filename, file_size, mime_type = validate_and_save_upload_file(file, content)

    doc_title = f"Credential Evidence - {sanitized_filename}"
    document = Document(
        owner_id=current_user.id,
        title=doc_title,
        filename=sanitized_filename,
        file_path=storage_path,
        file_size_bytes=file_size,
        mime_type=mime_type,
        visibility=DocumentVisibility.PRIVATE,
    )
    db.add(document)
    db.commit()
    db.refresh(document)

    log_audit(
        db=db,
        user_id=current_user.id,
        action="UPLOAD_VERIFICATION_CREDENTIAL_DOCUMENT",
        resource_type="document",
        resource_id=document.id,
        metadata_json={"filename": sanitized_filename}
    )

    return document


# ==============================================================================
# PHASE 3: ADVOCATE PRACTICE EVIDENCE ENDPOINTS
# ==============================================================================

@router.get(
    "/verification/practice-evidence",
    response_model=List[AdvocateCaseReferenceOut],
    status_code=status.HTTP_200_OK,
    summary="Get current provider's submitted practice case references",
    description="Returns practice case references for authenticated provider. Enforces strict provider ownership isolation."
)
def get_my_practice_evidence(
    current_user: User = Depends(require_provider),
    db: Session = Depends(get_db)
) -> List[AdvocateCaseReferenceOut]:
    provider = db.query(Provider).filter(Provider.user_id == current_user.id).first()
    if not provider:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Provider profile not found")

    case_refs = db.query(AdvocateCaseReference).filter(
        AdvocateCaseReference.provider_id == provider.id
    ).order_by(AdvocateCaseReference.created_at.desc()).all()

    return [AdvocateCaseReferenceOut.model_validate(ref) for ref in case_refs]


@router.post(
    "/verification/practice-evidence",
    response_model=AdvocateCaseReferenceOut,
    status_code=status.HTTP_201_CREATED,
    summary="Add a practice case evidence reference",
    description="Adds a practice case reference. Prevents duplicates, queues for manual review, and records CASE_EVIDENCE_SUBMITTED audit log."
)
def add_practice_evidence(
    case_in: AdvocateCaseReferenceInput,
    current_user: User = Depends(require_provider),
    db: Session = Depends(get_db)
) -> AdvocateCaseReferenceOut:
    provider = db.query(Provider).filter(Provider.user_id == current_user.id).first()
    if not provider:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Provider profile not found")

    verif_record = db.query(ProviderVerificationRecord).filter(ProviderVerificationRecord.provider_id == provider.id).first()
    if not verif_record:
        verif_record = ProviderVerificationRecord(provider_id=provider.id)
        db.add(verif_record)
        db.commit()
        db.refresh(verif_record)

    adv_profile = db.query(AdvocateVerificationProfile).filter(AdvocateVerificationProfile.verification_record_id == verif_record.id).first()
    if not adv_profile:
        adv_profile = AdvocateVerificationProfile(verification_record_id=verif_record.id, provider_id=provider.id)
        db.add(adv_profile)
        db.commit()
        db.refresh(adv_profile)

    existing_duplicate = db.query(AdvocateCaseReference).filter(
        AdvocateCaseReference.provider_id == provider.id,
        AdvocateCaseReference.case_number == case_in.case_number.strip(),
        AdvocateCaseReference.court_name == case_in.court_name.strip()
    ).first()

    if existing_duplicate:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Case reference '{case_in.case_number}' for court '{case_in.court_name}' has already been submitted."
        )

    case_ref = AdvocateCaseReference(
        advocate_profile_id=adv_profile.id,
        provider_id=provider.id,
        case_number=case_in.case_number.strip(),
        court_name=case_in.court_name.strip(),
        case_type=case_in.case_type.strip() if case_in.case_type else None,
        case_year=case_in.case_year,
        advocate_role=case_in.advocate_role.strip() if case_in.advocate_role else None,
        supporting_document_id=case_in.supporting_document_id,
        evidence_status=EvidenceStatus.SUBMITTED,
        verification_status=DetailedVerificationStatus.SUBMITTED,
    )

    verifier = ManualPracticeEvidenceVerifier()
    verification_res = verifier.verify_case_reference(case_ref)
    case_ref.evidence_source_reference = verification_res.get("source_reference")
    case_ref.verification_notes = verification_res.get("notes")

    db.add(case_ref)
    db.commit()
    db.refresh(case_ref)

    log_audit(
        db=db,
        user_id=current_user.id,
        action="CASE_EVIDENCE_SUBMITTED",
        resource_type="advocate_case_reference",
        resource_id=case_ref.id,
        metadata_json={
            "case_number": case_ref.case_number,
            "court_name": case_ref.court_name,
            "provider_id": provider.id,
        }
    )

    return AdvocateCaseReferenceOut.model_validate(case_ref)


@router.put(
    "/verification/practice-evidence/{case_id}",
    response_model=AdvocateCaseReferenceOut,
    status_code=status.HTTP_200_OK,
    summary="Update a practice case evidence reference",
    description="Updates existing case reference metadata. Enforces provider ownership (IDOR protection) and logs CASE_EVIDENCE_MODIFIED."
)
def update_practice_evidence(
    case_id: int,
    case_in: AdvocateCaseReferenceUpdate,
    current_user: User = Depends(require_provider),
    db: Session = Depends(get_db)
) -> AdvocateCaseReferenceOut:
    provider = db.query(Provider).filter(Provider.user_id == current_user.id).first()
    if not provider:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Provider profile not found")

    case_ref = db.query(AdvocateCaseReference).filter(AdvocateCaseReference.id == case_id).first()
    if not case_ref:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Practice evidence reference not found")

    if case_ref.provider_id != provider.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: You do not own this practice evidence reference."
        )

    if case_in.case_number is not None:
        case_ref.case_number = case_in.case_number.strip()
    if case_in.court_name is not None:
        case_ref.court_name = case_in.court_name.strip()
    if case_in.case_type is not None:
        case_ref.case_type = case_in.case_type.strip()
    if case_in.case_year is not None:
        case_ref.case_year = case_in.case_year
    if case_in.advocate_role is not None:
        case_ref.advocate_role = case_in.advocate_role.strip()
    if case_in.supporting_document_id is not None:
        case_ref.supporting_document_id = case_in.supporting_document_id

    case_ref.verification_status = DetailedVerificationStatus.SUBMITTED
    db.commit()
    db.refresh(case_ref)

    log_audit(
        db=db,
        user_id=current_user.id,
        action="CASE_EVIDENCE_MODIFIED",
        resource_type="advocate_case_reference",
        resource_id=case_ref.id,
        metadata_json={
            "case_number": case_ref.case_number,
            "court_name": case_ref.court_name,
            "provider_id": provider.id,
        }
    )

    return AdvocateCaseReferenceOut.model_validate(case_ref)


@router.delete(
    "/verification/practice-evidence/{case_id}",
    status_code=status.HTTP_200_OK,
    summary="Delete a practice case evidence reference",
    description="Deletes existing case reference. Enforces provider ownership (IDOR protection)."
)
def delete_practice_evidence(
    case_id: int,
    current_user: User = Depends(require_provider),
    db: Session = Depends(get_db)
):
    provider = db.query(Provider).filter(Provider.user_id == current_user.id).first()
    if not provider:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Provider profile not found")

    case_ref = db.query(AdvocateCaseReference).filter(AdvocateCaseReference.id == case_id).first()
    if not case_ref:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Practice evidence reference not found")

    if case_ref.provider_id != provider.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: You do not own this practice evidence reference."
        )

    db.delete(case_ref)
    db.commit()

    return {"message": "Practice evidence reference deleted successfully"}


@router.put(
    "/verification/practice-evidence/{case_id}/review",
    response_model=AdvocateCaseReferenceOut,
    status_code=status.HTTP_200_OK,
    summary="Admin review decision on practice case evidence",
    description="Admin approves, rejects, or requests changes on case evidence. Logs CASE_EVIDENCE_REVIEWED, CASE_EVIDENCE_APPROVED, or CASE_EVIDENCE_REJECTED."
)
def admin_review_practice_evidence(
    case_id: int,
    review_in: AdminCaseEvidenceReview,
    admin_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
) -> AdvocateCaseReferenceOut:
    if not review_in.notes or not review_in.notes.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Decision reason note is required for admin audit log"
        )

    case_ref = db.query(AdvocateCaseReference).filter(AdvocateCaseReference.id == case_id).first()
    if not case_ref:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Practice evidence reference not found")

    old_status = case_ref.verification_status.value if case_ref.verification_status else "NOT_STARTED"
    case_ref.verification_status = review_in.status
    case_ref.verification_notes = review_in.notes
    if review_in.evidence_source_reference:
        case_ref.evidence_source_reference = review_in.evidence_source_reference
    case_ref.verified_at = datetime.now(timezone.utc)

    if review_in.status == DetailedVerificationStatus.VERIFIED:
        case_ref.evidence_status = EvidenceStatus.VERIFIED
    elif review_in.status in (DetailedVerificationStatus.REJECTED, DetailedVerificationStatus.UNVERIFIED):
        case_ref.evidence_status = EvidenceStatus.REJECTED

    db.commit()
    db.refresh(case_ref)

    # Record Verification History entry
    verif_rec = db.query(ProviderVerificationRecord).filter(ProviderVerificationRecord.provider_id == case_ref.provider_id).first()
    if verif_rec:
        history_entry = ProviderVerificationHistory(
            verification_record_id=verif_rec.id,
            provider_id=case_ref.provider_id,
            actor_id=admin_user.id,
            action=f"PRACTICE_EVIDENCE_{review_in.status.value}",
            from_status=old_status,
            to_status=review_in.status.value,
            notes=review_in.notes,
        )
        db.add(history_entry)
        db.commit()

    log_audit(
        db=db,
        user_id=admin_user.id,
        action="CASE_EVIDENCE_REVIEWED",
        resource_type="advocate_case_reference",
        resource_id=case_ref.id,
        metadata_json={
            "target_status": review_in.status.value,
            "provider_id": case_ref.provider_id,
            "notes": review_in.notes,
        }
    )

    if review_in.status == DetailedVerificationStatus.VERIFIED:
        log_audit(
            db=db,
            user_id=admin_user.id,
            action="CASE_EVIDENCE_APPROVED",
            resource_type="advocate_case_reference",
            resource_id=case_ref.id,
            metadata_json={"provider_id": case_ref.provider_id, "notes": review_in.notes}
        )
    elif review_in.status in (DetailedVerificationStatus.REJECTED, DetailedVerificationStatus.UNVERIFIED):
        log_audit(
            db=db,
            user_id=admin_user.id,
            action="CASE_EVIDENCE_REJECTED",
            resource_type="advocate_case_reference",
            resource_id=case_ref.id,
            metadata_json={"provider_id": case_ref.provider_id, "notes": review_in.notes}
        )

    return AdvocateCaseReferenceOut.model_validate(case_ref)


@router.get(
    "/admin/verification-queue",
    response_model=List[AdminVerificationQueueItem],
    status_code=status.HTTP_200_OK,
    summary="Admin provider verification center queue",
    description="Returns filtered provider verification queue items with profession, submission date, credential status, and practice evidence status. RBAC protected (Admin only)."
)
def get_admin_verification_queue(
    profession: Optional[ProviderType] = None,
    verification_status: Optional[DetailedVerificationStatus] = None,
    manual_review_only: Optional[bool] = False,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    admin_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
) -> List[AdminVerificationQueueItem]:
    query = db.query(Provider).join(User, Provider.user_id == User.id)

    if profession:
        query = query.filter(Provider.provider_type == profession)

    providers = query.order_by(Provider.updated_at.desc()).all()
    queue_items: List[AdminVerificationQueueItem] = []

    for provider in providers:
        verif_rec = db.query(ProviderVerificationRecord).filter(
            ProviderVerificationRecord.provider_id == provider.id
        ).first()

        # Extract overall and detailed statuses
        overall = verif_rec.overall_status if verif_rec else (
            DetailedVerificationStatus.VERIFIED if provider.verification_status == VerificationStatus.VERIFIED
            else (DetailedVerificationStatus.REJECTED if provider.verification_status == VerificationStatus.REJECTED
            else DetailedVerificationStatus.SUBMITTED if provider.verification_status == VerificationStatus.SUBMITTED
            else DetailedVerificationStatus.NOT_STARTED)
        )

        credential_st = verif_rec.credential_status if verif_rec else DetailedVerificationStatus.NOT_STARTED
        practice_st = verif_rec.practice_status if verif_rec else DetailedVerificationStatus.NOT_STARTED

        # Filter by verification_status
        if verification_status and overall != verification_status:
            continue

        # Filter by manual_review_only
        if manual_review_only and overall not in (
            DetailedVerificationStatus.MANUAL_REVIEW,
            DetailedVerificationStatus.AUTOMATED_REVIEW,
            DetailedVerificationStatus.SUBMITTED,
        ):
            continue

        # Filter by date range
        submitted_at = verif_rec.created_at if verif_rec else provider.created_at
        if date_from:
            try:
                dt_from = datetime.fromisoformat(date_from.replace("Z", "+00:00"))
                if submitted_at < dt_from:
                    continue
            except ValueError:
                pass

        if date_to:
            try:
                dt_to = datetime.fromisoformat(date_to.replace("Z", "+00:00"))
                if submitted_at > dt_to:
                    continue
            except ValueError:
                pass

        # Extract last activity
        last_activity_ts = verif_rec.updated_at if verif_rec else provider.updated_at
        last_activity_notes = verif_rec.verification_notes if verif_rec else None
        last_admin_id = verif_rec.last_reviewed_by_admin_id if verif_rec else None

        if verif_rec and verif_rec.history_entries:
            latest_h = sorted(verif_rec.history_entries, key=lambda h: h.timestamp, reverse=True)[0]
            last_activity_ts = latest_h.timestamp
            last_activity_notes = f"{latest_h.action}: {latest_h.notes or ''}".strip()
            if latest_h.actor_id:
                last_admin_id = latest_h.actor_id

        queue_items.append(
            AdminVerificationQueueItem(
                provider_id=provider.id,
                user_id=provider.user_id,
                user_email=provider.user.email if provider.user else "",
                full_name=provider.full_name,
                profession=provider.provider_type.value,
                overall_status=overall,
                submitted_at=submitted_at,
                credential_status=credential_st,
                practice_evidence_status=practice_st,
                last_activity_timestamp=last_activity_ts,
                last_activity_notes=last_activity_notes,
                last_reviewed_by_admin_id=last_admin_id,
            )
        )

    return queue_items


@router.get(
    "/admin/{provider_id}/verification-details",
    response_model=AdminVerificationDetailsOut,
    status_code=status.HTTP_200_OK,
    summary="Get full provider verification details for admin review",
    description="Returns identity, professional credentials, practice case evidence, and verification history. RBAC protected (Admin only)."
)
def get_admin_provider_verification_details(
    provider_id: int,
    admin_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
) -> AdminVerificationDetailsOut:
    provider = db.query(Provider).filter(Provider.id == provider_id).first()
    if not provider:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Provider profile not found")

    user = db.query(User).filter(User.id == provider.user_id).first()
    verif_rec = db.query(ProviderVerificationRecord).filter(
        ProviderVerificationRecord.provider_id == provider_id
    ).first()

    if not verif_rec:
        verif_rec = ProviderVerificationRecord(
            provider_id=provider_id,
            overall_status=DetailedVerificationStatus.NOT_STARTED,
            identity_status=DetailedVerificationStatus.NOT_STARTED,
            credential_status=DetailedVerificationStatus.NOT_STARTED,
            practice_status=DetailedVerificationStatus.NOT_STARTED,
        )
        db.add(verif_rec)
        db.commit()
        db.refresh(verif_rec)

    adv_prof = db.query(AdvocateVerificationProfile).filter(
        AdvocateVerificationProfile.verification_record_id == verif_rec.id
    ).first()

    doc_filename = None
    if adv_prof and adv_prof.credential_document_id:
        doc = db.query(Document).filter(Document.id == adv_prof.credential_document_id).first()
        if doc:
            doc_filename = doc.filename

    case_refs: List[AdvocateCaseReferenceOut] = []
    if adv_prof:
        cases = db.query(AdvocateCaseReference).filter(
            AdvocateCaseReference.advocate_profile_id == adv_prof.id
        ).all()
        case_refs = [AdvocateCaseReferenceOut.model_validate(c) for c in cases]

    history = db.query(ProviderVerificationHistory).filter(
        ProviderVerificationHistory.verification_record_id == verif_rec.id
    ).order_by(ProviderVerificationHistory.timestamp.desc()).all()
    history_outs = [ProviderVerificationHistoryOut.model_validate(h) for h in history]

    return AdminVerificationDetailsOut(
        provider_id=provider.id,
        user_id=provider.user_id,
        user_email=user.email if user else "",
        full_name=provider.full_name,
        phone=provider.phone,
        location=provider.location,
        bio=provider.bio,
        experience_years=provider.experience_years,
        created_at=provider.created_at,
        profession=provider.provider_type.value,
        state_bar_council=adv_prof.state_bar_council if adv_prof else None,
        enrollment_number=adv_prof.enrollment_number if adv_prof else None,
        enrollment_year=adv_prof.enrollment_year if adv_prof else None,
        jurisdiction_state=adv_prof.jurisdiction_state if adv_prof else None,
        credential_type=adv_prof.credential_type if adv_prof else None,
        credential_document_id=adv_prof.credential_document_id if adv_prof else None,
        credential_document_filename=doc_filename,
        credential_verification_status=adv_prof.credential_verification_status if adv_prof else DetailedVerificationStatus.NOT_STARTED,
        credential_notes=adv_prof.verification_notes if adv_prof else None,
        overall_status=verif_rec.overall_status,
        identity_status=verif_rec.identity_status,
        credential_status=verif_rec.credential_status,
        practice_status=verif_rec.practice_status,
        last_reviewed_by_admin_id=verif_rec.last_reviewed_by_admin_id,
        last_reviewed_at=verif_rec.last_reviewed_at,
        verification_notes=verif_rec.verification_notes,
        case_references=case_refs,
        history_entries=history_outs,
    )


@router.post(
    "/admin/{provider_id}/verification/decision",
    response_model=AdminVerificationDetailsOut,
    status_code=status.HTTP_200_OK,
    summary="Execute admin verification decision with mandatory reason notes",
    description="Admin approves credential, rejects credential, requests info, or marks manual review. Mandatory reason note required. RBAC protected (Admin only)."
)
def execute_admin_verification_decision(
    provider_id: int,
    decision_in: AdminDecisionInput,
    admin_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
) -> AdminVerificationDetailsOut:
    if not decision_in.notes or not decision_in.notes.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Decision reason note is required for admin audit log"
        )

    provider = db.query(Provider).filter(Provider.id == provider_id).first()
    if not provider:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Provider profile not found")

    verif_rec = db.query(ProviderVerificationRecord).filter(
        ProviderVerificationRecord.provider_id == provider_id
    ).first()
    if not verif_rec:
        verif_rec = ProviderVerificationRecord(
            provider_id=provider_id,
            overall_status=DetailedVerificationStatus.NOT_STARTED,
            identity_status=DetailedVerificationStatus.NOT_STARTED,
            credential_status=DetailedVerificationStatus.NOT_STARTED,
            practice_status=DetailedVerificationStatus.NOT_STARTED,
        )
        db.add(verif_rec)
        db.commit()
        db.refresh(verif_rec)

    old_status = verif_rec.overall_status.value
    target_status = decision_in.target_status

    act = decision_in.action.upper()
    if act == "APPROVE_CREDENTIAL":
        target_status = target_status or DetailedVerificationStatus.VERIFIED
        verif_rec.overall_status = target_status
        verif_rec.credential_status = DetailedVerificationStatus.VERIFIED
        verif_rec.identity_status = DetailedVerificationStatus.VERIFIED
        provider.verification_status = VerificationStatus.VERIFIED
    elif act == "REJECT_CREDENTIAL":
        target_status = target_status or DetailedVerificationStatus.REJECTED
        verif_rec.overall_status = target_status
        verif_rec.credential_status = DetailedVerificationStatus.REJECTED
        provider.verification_status = VerificationStatus.REJECTED
    elif act in ("REQUEST_ADDITIONAL_INFO", "NEEDS_REVIEW"):
        target_status = target_status or DetailedVerificationStatus.MANUAL_REVIEW
        verif_rec.overall_status = target_status
        verif_rec.credential_status = DetailedVerificationStatus.MANUAL_REVIEW
        provider.verification_status = VerificationStatus.PENDING
    elif act in ("MARK_MANUAL_REVIEW", "MANUAL_REVIEW"):
        target_status = target_status or DetailedVerificationStatus.MANUAL_REVIEW
        verif_rec.overall_status = target_status
        provider.verification_status = VerificationStatus.SUBMITTED
    else:
        target_status = target_status or DetailedVerificationStatus.MANUAL_REVIEW
        verif_rec.overall_status = target_status

    verif_rec.last_reviewed_by_admin_id = admin_user.id
    verif_rec.last_reviewed_at = datetime.now(timezone.utc)
    verif_rec.verification_notes = decision_in.notes

    # Update AdvocateVerificationProfile if present
    adv_prof = db.query(AdvocateVerificationProfile).filter(
        AdvocateVerificationProfile.verification_record_id == verif_rec.id
    ).first()
    if adv_prof:
        if act == "APPROVE_CREDENTIAL":
            adv_prof.credential_verification_status = DetailedVerificationStatus.VERIFIED
            adv_prof.credential_verified_at = datetime.now(timezone.utc)
        elif act == "REJECT_CREDENTIAL":
            adv_prof.credential_verification_status = DetailedVerificationStatus.REJECTED
        adv_prof.verification_notes = decision_in.notes

    db.commit()
    db.refresh(verif_rec)
    db.refresh(provider)

    # Record Verification History Entry
    history_entry = ProviderVerificationHistory(
        verification_record_id=verif_rec.id,
        provider_id=provider.id,
        actor_id=admin_user.id,
        action=act,
        from_status=old_status,
        to_status=target_status.value if target_status else "MANUAL_REVIEW",
        notes=decision_in.notes,
    )
    db.add(history_entry)
    db.commit()

    calculate_profile_completion(provider, db)

    log_audit(
        db=db,
        user_id=admin_user.id,
        action=f"ADMIN_VERIFICATION_{act}",
        resource_type="provider",
        resource_id=provider.id,
        metadata_json={
            "action": act,
            "target_status": target_status.value if target_status else "MANUAL_REVIEW",
            "notes": decision_in.notes
        }
    )

    return get_admin_provider_verification_details(provider_id, admin_user, db)


@router.put(
    "/{provider_id}/verify",
    response_model=ProviderProfileDetailOut,
    status_code=status.HTTP_200_OK,
    summary="Admin verification review decision",
    description="Admin approves or rejects provider verification (SUBMITTED -> VERIFIED or REJECTED). Requires reason notes."
)
def admin_verify_provider(
    provider_id: int,
    decision_in: AdminVerificationDecision,
    admin_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
) -> ProviderProfileDetailOut:
    if decision_in.status not in (VerificationStatus.VERIFIED, VerificationStatus.REJECTED):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Verification decision must be VERIFIED or REJECTED"
        )
    if not decision_in.notes or not decision_in.notes.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Decision reason note is required for admin audit log"
        )

    provider = db.query(Provider).filter(Provider.id == provider_id).first()
    if not provider:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Provider profile not found"
        )

    old_st = provider.verification_status.value
    provider.verification_status = decision_in.status

    verif_rec = db.query(ProviderVerificationRecord).filter(
        ProviderVerificationRecord.provider_id == provider_id
    ).first()
    if verif_rec:
        verif_rec.overall_status = (
            DetailedVerificationStatus.VERIFIED if decision_in.status == VerificationStatus.VERIFIED
            else DetailedVerificationStatus.REJECTED
        )
        verif_rec.last_reviewed_by_admin_id = admin_user.id
        verif_rec.last_reviewed_at = datetime.now(timezone.utc)
        verif_rec.verification_notes = decision_in.notes

        history_entry = ProviderVerificationHistory(
            verification_record_id=verif_rec.id,
            provider_id=provider.id,
            actor_id=admin_user.id,
            action=f"VERIFY_{decision_in.status.value}",
            from_status=old_st,
            to_status=decision_in.status.value,
            notes=decision_in.notes,
        )
        db.add(history_entry)

    db.commit()
    db.refresh(provider)

    calculate_profile_completion(provider, db)

    log_audit(
        db=db,
        user_id=admin_user.id,
        action=f"ADMIN_VERIFICATION_{decision_in.status.value}",
        resource_type="provider",
        resource_id=provider.id,
        metadata_json={"notes": decision_in.notes}
    )

    out = ProviderProfileDetailOut.model_validate(provider)
    out.generic_fields = _build_generic_fields_list(provider, db)
    return out


def mask_enrollment_number(raw_num: Optional[str]) -> Optional[str]:
    """Partially mask enrollment/registration numbers for public citizen display."""
    if not raw_num:
        return None
    raw_num = raw_num.strip()
    if "/" in raw_num:
        parts = raw_num.split("/")
        if len(parts) >= 3:
            masked_num = "*" * max(len(parts[1]), 3)
            return f"{parts[0]}/{masked_num}/{parts[-1]}"
        elif len(parts) == 2:
            masked_num = "*" * max(len(parts[0]), 3)
            return f"{masked_num}/{parts[1]}"
    if len(raw_num) <= 4:
        return raw_num[0] + "*" * (len(raw_num) - 1)
    prefix_len = min(2, len(raw_num) // 4)
    suffix_len = min(2, len(raw_num) // 4)
    mask_len = len(raw_num) - prefix_len - suffix_len
    return raw_num[:prefix_len] + ("*" * mask_len) + raw_num[-suffix_len:]


@router.get(
    "/{provider_id}",
    response_model=ProviderPublicOut,
    status_code=status.HTTP_200_OK,
    summary="Get public provider profile for discovery",
    description="Returns public provider discovery details. Excludes passwords, private documents, audit history, and promotional rankings."
)
def get_public_provider_profile(
    provider_id: int,
    db: Session = Depends(get_db)
) -> ProviderPublicOut:
    provider = db.query(Provider).filter(Provider.id == provider_id).first()
    if not provider:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Provider not found"
        )

    verif_rec = db.query(ProviderVerificationRecord).filter(
        ProviderVerificationRecord.provider_id == provider.id
    ).first()

    cred_verified = (
        provider.verification_status == VerificationStatus.VERIFIED or
        (verif_rec is not None and verif_rec.credential_status == DetailedVerificationStatus.VERIFIED)
    )

    total_cases_count = 0
    verified_cases_count = 0
    raw_enrollment = None
    enrollment_year = None
    reg_authority = "State Bar Council" if provider.provider_type == ProviderType.ADVOCATE else "Licensing Authority"
    last_verified_str = None

    if verif_rec:
        if verif_rec.last_reviewed_at:
            last_verified_str = verif_rec.last_reviewed_at.strftime("%Y-%m-%d")
        elif verif_rec.updated_at:
            last_verified_str = verif_rec.updated_at.strftime("%Y-%m-%d")

        if verif_rec.advocate_profile:
            adv_p = verif_rec.advocate_profile
            if adv_p.state_bar_council:
                reg_authority = adv_p.state_bar_council
            if adv_p.enrollment_number:
                raw_enrollment = adv_p.enrollment_number
            if adv_p.enrollment_year:
                enrollment_year = adv_p.enrollment_year

            all_cases = db.query(AdvocateCaseReference).filter(
                AdvocateCaseReference.advocate_profile_id == adv_p.id
            ).all()
            total_cases_count = len(all_cases)
            verified_cases_count = len([c for c in all_cases if c.verification_status == DetailedVerificationStatus.VERIFIED])

    # Fallback to generic fields if advocate profile record is missing
    if not raw_enrollment:
        gen_fields = _build_generic_fields_list(provider, db)
        for f in gen_fields:
            if f.field_name in ("registration_details", "enrollment_number"):
                raw_enrollment = f.value
            elif f.field_name == "bar_council":
                reg_authority = f.value

    if not last_verified_str and provider.verification_status == VerificationStatus.VERIFIED:
        last_verified_str = provider.updated_at.strftime("%Y-%m-%d") if provider.updated_at else datetime.now().strftime("%Y-%m-%d")

    practice_ev_status = "Not available"
    if verified_cases_count > 0:
        practice_ev_status = "Reviewed"
    elif total_cases_count > 0:
        practice_ev_status = "Not yet reviewed"

    transparency_detail = VerificationTransparencyDetail(
        professional_credential_verified=cred_verified,
        profession=provider.provider_type.value.capitalize(),
        registration_authority=reg_authority,
        enrollment_number_masked=mask_enrollment_number(raw_enrollment),
        enrollment_year=enrollment_year,
        verification_status=provider.verification_status,
        last_verified_date=last_verified_str,
        practice_evidence_status=practice_ev_status,
        practice_evidence_count=verified_cases_count,
    )

    out = ProviderPublicOut.model_validate(provider)
    out.generic_fields = _build_generic_fields_list(provider, db)
    out.professional_credential_verified = cred_verified
    out.practice_evidence_reviewed = (verified_cases_count > 0)
    out.practice_evidence_count = verified_cases_count
    out.verification_transparency = transparency_detail
    return out
