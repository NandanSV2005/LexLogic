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
    ProviderVerificationRecordOut,
    AdvocateVerificationProfileOut,
    AdvocateCaseReferenceOut,
)
from app.services.points_service import award_points

from app.schemas.provider import (
    ProviderProfileCreate,
    ProviderProfileUpdate,
    ProviderProfileDetailOut,
    ProviderFieldValueInput,
    ProviderFieldValueDetail,
    ProviderPublicOut,
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
    case_ref = db.query(AdvocateCaseReference).filter(AdvocateCaseReference.id == case_id).first()
    if not case_ref:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Practice evidence reference not found")

    case_ref.verification_status = review_in.status
    if review_in.notes:
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
            metadata_json={"provider_id": case_ref.provider_id}
        )
    elif review_in.status in (DetailedVerificationStatus.REJECTED, DetailedVerificationStatus.UNVERIFIED):
        log_audit(
            db=db,
            user_id=admin_user.id,
            action="CASE_EVIDENCE_REJECTED",
            resource_type="advocate_case_reference",
            resource_id=case_ref.id,
            metadata_json={"provider_id": case_ref.provider_id}
        )

    return AdvocateCaseReferenceOut.model_validate(case_ref)


@router.put(
    "/{provider_id}/verify",
    response_model=ProviderProfileDetailOut,
    status_code=status.HTTP_200_OK,
    summary="Admin verification review decision",
    description="Admin approves or rejects provider verification (SUBMITTED -> VERIFIED or REJECTED)."
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

    provider = db.query(Provider).filter(Provider.id == provider_id).first()
    if not provider:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Provider profile not found"
        )

    provider.verification_status = decision_in.status
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

    out = ProviderPublicOut.model_validate(provider)
    out.generic_fields = _build_generic_fields_list(provider, db)
    return out
