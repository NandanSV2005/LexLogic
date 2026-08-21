from datetime import datetime, timezone
import pytest
from sqlalchemy.exc import IntegrityError
from app.db.base import Base
from app.db.database import SessionLocal, engine
from app.core.security import get_password_hash
from app.models.user import User, UserRole
from app.models.provider import Provider, ProviderType, VerificationStatus
from app.models.document import Document, DocumentVisibility
from app.models.verification import (
    DetailedVerificationStatus,
    CredentialType,
    EvidenceStatus,
    ProviderVerificationRecord,
    AdvocateVerificationProfile,
    AdvocateCaseReference,
    ProviderVerificationHistory,
)


@pytest.fixture(autouse=True)
def setup_database():
    """Re-initialize clean tables before each test."""
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
        Base.metadata.drop_all(bind=engine)


def test_provider_verification_record_creation(setup_database):
    """Test ProviderVerificationRecord creation with explicit multi-level verification statuses."""
    db = setup_database

    user = User(email="advocate@example.com", password_hash=get_password_hash("Pass123!"), role=UserRole.PROVIDER)
    db.add(user)
    db.commit()

    provider = Provider(
        user_id=user.id,
        provider_type=ProviderType.ADVOCATE,
        full_name="Adv. Rajesh Kumar",
        phone="+919876543210",
        location="New Delhi",
        experience_years=10,
    )
    db.add(provider)
    db.commit()

    verif_record = ProviderVerificationRecord(
        provider_id=provider.id,
        overall_status=DetailedVerificationStatus.SUBMITTED,
        identity_status=DetailedVerificationStatus.VERIFIED,
        credential_status=DetailedVerificationStatus.SUBMITTED,
        practice_status=DetailedVerificationStatus.NOT_STARTED,
        verification_notes="Initial credential submission received.",
    )
    db.add(verif_record)
    db.commit()
    db.refresh(verif_record)

    assert verif_record.id is not None
    assert verif_record.provider_id == provider.id
    assert verif_record.overall_status == DetailedVerificationStatus.SUBMITTED
    assert verif_record.identity_status == DetailedVerificationStatus.VERIFIED
    assert verif_record.credential_status == DetailedVerificationStatus.SUBMITTED
    assert verif_record.practice_status == DetailedVerificationStatus.NOT_STARTED
    assert provider.verification_record is not None
    assert provider.verification_record.id == verif_record.id


def test_advocate_verification_profile_and_case_references(setup_database):
    """Test AdvocateVerificationProfile with Level 2 Bar enrollment details & Level 3 Case Metadata references."""
    db = setup_database

    user = User(email="advocate2@example.com", password_hash=get_password_hash("Pass123!"), role=UserRole.PROVIDER)
    db.add(user)
    db.commit()

    provider = Provider(
        user_id=user.id,
        provider_type=ProviderType.ADVOCATE,
        full_name="Adv. Sunita Rao",
        experience_years=8,
    )
    db.add(provider)
    db.commit()

    verif_record = ProviderVerificationRecord(
        provider_id=provider.id,
        overall_status=DetailedVerificationStatus.MANUAL_REVIEW,
    )
    db.add(verif_record)
    db.commit()

    # Uploaded Bar Enrollment Certificate Document
    bar_cert = Document(
        owner_id=user.id,
        title="Bar Enrollment Certificate",
        filename="bar_cert.pdf",
        file_path="storage/documents/uuid_bar_cert.pdf",
        file_size_bytes=1024,
        mime_type="application/pdf",
        visibility=DocumentVisibility.PRIVATE,
    )
    db.add(bar_cert)
    db.commit()

    # Level 2 Advocate Profile
    adv_profile = AdvocateVerificationProfile(
        verification_record_id=verif_record.id,
        provider_id=provider.id,
        full_legal_name="Sunita Rao",
        jurisdiction_city="Bengaluru",
        jurisdiction_state="Karnataka",
        state_bar_council="Bar Council of Karnataka",
        enrollment_number="KAR/1842/2016",
        enrollment_year=2016,
        credential_type=CredentialType.BAR_ENROLLMENT_CERTIFICATE,
        credential_document_id=bar_cert.id,
        credential_verification_status=DetailedVerificationStatus.SUBMITTED,
    )
    db.add(adv_profile)
    db.commit()
    db.refresh(adv_profile)

    # Level 3 Case References (Practice Metadata Only - NO client-sensitive content required)
    case_ref1 = AdvocateCaseReference(
        advocate_profile_id=adv_profile.id,
        provider_id=provider.id,
        case_number="W.P.(C) 9912/2020",
        court_name="High Court of Karnataka",
        case_type="Commercial Litigation",
        case_year=2020,
        advocate_role="Lead Counsel for Petitioner",
        evidence_status=EvidenceStatus.VERIFIED,
        verification_status=DetailedVerificationStatus.VERIFIED,
    )
    case_ref2 = AdvocateCaseReference(
        advocate_profile_id=adv_profile.id,
        provider_id=provider.id,
        case_number="RFA 402/2022",
        court_name="City Civil Court Bengaluru",
        case_type="Property Dispute",
        case_year=2022,
        advocate_role="Co-Counsel",
        evidence_status=EvidenceStatus.SUBMITTED,
        verification_status=DetailedVerificationStatus.SUBMITTED,
    )
    db.add_all([case_ref1, case_ref2])
    db.commit()

    db.refresh(adv_profile)
    assert len(adv_profile.case_references) == 2
    assert adv_profile.enrollment_number == "KAR/1842/2016"
    assert adv_profile.credential_document is not None
    assert adv_profile.credential_document.id == bar_cert.id
    assert adv_profile.case_references[0].case_number == "W.P.(C) 9912/2020"


def test_provider_verification_history_audit(setup_database):
    """Test auditable verification history entries tracking state transitions and admin actions."""
    db = setup_database

    admin = User(email="admin@example.com", password_hash=get_password_hash("Pass123!"), role=UserRole.ADMIN)
    user = User(email="advocate3@example.com", password_hash=get_password_hash("Pass123!"), role=UserRole.PROVIDER)
    db.add_all([admin, user])
    db.commit()

    provider = Provider(user_id=user.id, provider_type=ProviderType.ADVOCATE, full_name="Adv. Meera Patel")
    db.add(provider)
    db.commit()

    verif_record = ProviderVerificationRecord(provider_id=provider.id)
    db.add(verif_record)
    db.commit()

    # Log history entry 1: Provider submits verification
    history1 = ProviderVerificationHistory(
        verification_record_id=verif_record.id,
        provider_id=provider.id,
        actor_id=user.id,
        action="SUBMITTED_LEVEL_2",
        from_status=DetailedVerificationStatus.NOT_STARTED.value,
        to_status=DetailedVerificationStatus.SUBMITTED.value,
        notes="Provider submitted Bar Enrollment Certificate KAR/9012/2018.",
    )
    db.add(history1)
    db.commit()

    # Log history entry 2: Admin approves verification
    verif_record.overall_status = DetailedVerificationStatus.VERIFIED
    verif_record.credential_status = DetailedVerificationStatus.VERIFIED
    verif_record.last_reviewed_by_admin_id = admin.id
    verif_record.last_reviewed_at = datetime.now(timezone.utc)
    verif_record.verification_notes = "Bar Council enrollment verified against state portal."

    history2 = ProviderVerificationHistory(
        verification_record_id=verif_record.id,
        provider_id=provider.id,
        actor_id=admin.id,
        action="ADMIN_APPROVE_VERIFICATION",
        from_status=DetailedVerificationStatus.SUBMITTED.value,
        to_status=DetailedVerificationStatus.VERIFIED.value,
        notes="Verified Bar Enrollment Certificate.",
    )
    db.add(history2)
    db.commit()

    db.refresh(verif_record)
    assert len(verif_record.history_entries) == 2
    assert verif_record.history_entries[0].action == "SUBMITTED_LEVEL_2"
    assert verif_record.history_entries[1].actor_id == admin.id
    assert verif_record.history_entries[1].to_status == DetailedVerificationStatus.VERIFIED.value
