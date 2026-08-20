import pytest
from datetime import datetime, timezone
from fastapi.testclient import TestClient
from app.db.database import SessionLocal, engine
from app.db.base import Base
from app.core.security import get_password_hash, create_access_token
from app.models.user import User, UserRole
from app.models.provider import Provider, ProviderType, VerificationStatus
from app.models.verification import (
    ProviderVerificationRecord,
    AdvocateVerificationProfile,
    AdvocateCaseReference,
    DetailedVerificationStatus,
    EvidenceStatus,
    CredentialType,
)
from app.main import app
from app.services.provider_service import seed_default_provider_field_definitions


@pytest.fixture(autouse=True)
def setup_database():
    """Reset and seed database before each test."""
    import app.models  # noqa: F401
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        seed_default_provider_field_definitions(db)
        db.commit()
        yield db
    finally:
        db.close()


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


def test_public_profile_verification_transparency_structure_and_masking(client, setup_database):
    """Test 1: Public profile endpoint returns clean transparency breakdown with masked enrollment numbers."""
    db = setup_database

    user = User(email="adv_p6@lexlogic.org", password_hash=get_password_hash("Pass123!"), role=UserRole.PROVIDER)
    db.add(user)
    db.commit()

    provider = Provider(
        user_id=user.id,
        provider_type=ProviderType.ADVOCATE,
        full_name="Advocate Masking Tester",
        location="Delhi",
        experience_years=12,
        verification_status=VerificationStatus.VERIFIED,
    )
    db.add(provider)
    db.commit()

    verif_rec = ProviderVerificationRecord(
        provider_id=provider.id,
        overall_status=DetailedVerificationStatus.VERIFIED,
        credential_status=DetailedVerificationStatus.VERIFIED,
        last_reviewed_at=datetime.now(timezone.utc),
    )
    db.add(verif_rec)
    db.commit()

    adv_profile = AdvocateVerificationProfile(
        verification_record_id=verif_rec.id,
        provider_id=provider.id,
        state_bar_council="Bar Council of Delhi",
        enrollment_number="D/12345/2012",
        enrollment_year=2012,
    )
    db.add(adv_profile)
    db.commit()

    case_ref = AdvocateCaseReference(
        advocate_profile_id=adv_profile.id,
        provider_id=provider.id,
        case_number="CRL-APPL-2024-99",
        court_name="High Court of Delhi",
        evidence_status=EvidenceStatus.VERIFIED,
        verification_status=DetailedVerificationStatus.VERIFIED,
    )
    db.add(case_ref)
    db.commit()

    # Call Public Profile Endpoint
    res = client.get(f"/api/providers/{provider.id}")
    assert res.status_code == 200
    data = res.json()

    # Assert top-level flags
    assert data["professional_credential_verified"] is True
    assert data["practice_evidence_reviewed"] is True
    assert data["practice_evidence_count"] == 1

    # Assert transparency details
    assert "verification_transparency" in data
    vt = data["verification_transparency"]
    assert vt["professional_credential_verified"] is True
    assert vt["profession"] == "Advocate"
    assert vt["registration_authority"] == "Bar Council of Delhi"
    assert vt["enrollment_number_masked"] == "D/*****/2012"
    assert vt["enrollment_year"] == 2012
    assert vt["verification_status"] == "VERIFIED"
    assert vt["last_verified_date"] is not None
    assert vt["practice_evidence_status"] == "Reviewed"
    assert vt["practice_evidence_count"] == 1


def test_public_profile_strict_privacy_boundaries(client, setup_database):
    """Test 2: Public profile endpoint omits private certificates, identity docs, and admin decision notes."""
    db = setup_database

    user = User(email="priv_p6@lexlogic.org", password_hash=get_password_hash("Pass123!"), role=UserRole.PROVIDER)
    db.add(user)
    db.commit()

    provider = Provider(
        user_id=user.id,
        provider_type=ProviderType.ADVOCATE,
        full_name="Advocate Confidential Check",
        location="Mumbai",
        experience_years=8,
        verification_status=VerificationStatus.VERIFIED,
    )
    db.add(provider)
    db.commit()

    verif_rec = ProviderVerificationRecord(
        provider_id=provider.id,
        overall_status=DetailedVerificationStatus.VERIFIED,
        credential_status=DetailedVerificationStatus.VERIFIED,
        verification_notes="CONFIDENTIAL ADMIN INTERNAL DECISION NOTE: Verified physically via Bar Registry.",
    )
    db.add(verif_rec)
    db.commit()

    res = client.get(f"/api/providers/{provider.id}")
    assert res.status_code == 200
    text_content = res.text

    # PRIVACY BOUNDARY ASSERTIONS: Ensure internal notes and private doc references are absent
    assert "CONFIDENTIAL ADMIN INTERNAL DECISION NOTE" not in text_content
    assert "credential_document_id" not in text_content
    assert "verification_notes" not in text_content


def test_unverified_provider_transparency_defaults(client, setup_database):
    """Test 3: Unverified provider transparency details default gracefully without errors."""
    db = setup_database

    user = User(email="unverif_p6@lexlogic.org", password_hash=get_password_hash("Pass123!"), role=UserRole.PROVIDER)
    db.add(user)
    db.commit()

    provider = Provider(
        user_id=user.id,
        provider_type=ProviderType.ADVOCATE,
        full_name="Advocate Unverified Default",
        location="Bangalore",
        experience_years=3,
        verification_status=VerificationStatus.SUBMITTED,
    )
    db.add(provider)
    db.commit()

    res = client.get(f"/api/providers/{provider.id}")
    assert res.status_code == 200
    data = res.json()

    assert data["professional_credential_verified"] is False
    assert data["practice_evidence_reviewed"] is False

    vt = data["verification_transparency"]
    assert vt["professional_credential_verified"] is False
    assert vt["verification_status"] == "SUBMITTED"
    assert vt["practice_evidence_status"] == "Not available"
