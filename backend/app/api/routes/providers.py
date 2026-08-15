from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
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
from app.models.points import PointTransaction
from app.schemas.provider import (
    ProviderProfileCreate,
    ProviderProfileUpdate,
    ProviderProfileDetailOut,
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

    return transactions


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
