import pytest
from fastapi.testclient import TestClient
from app.db.database import SessionLocal, engine
from app.db.base import Base
from app.core.security import get_password_hash, create_access_token
from app.models.user import User, UserRole
from app.models.provider import Provider, ProviderType, VerificationStatus, AvailabilityStatus
from app.models.request import ServiceRequest
from app.models.verification import (
    ProviderVerificationRecord,
    AdvocateVerificationProfile,
    AdvocateCaseReference,
    DetailedVerificationStatus,
    EvidenceStatus,
    CredentialType,
)
from app.main import app
from app.services.provider_service import seed_default_provider_field_definitions, update_provider_generic_fields
from app.services.matching_service import calculate_provider_match_score


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


def test_unverified_provider_hard_safety_matching_exclusion(client, setup_database):
    """Test 1: Unverified or incomplete providers are strictly excluded from matching API results."""
    db = setup_database

    cit_user = User(email="cit_p5@example.com", password_hash=get_password_hash("Pass123!"), role=UserRole.CITIZEN)
    unverif_adv = User(email="unverif_adv@example.com", password_hash=get_password_hash("Pass123!"), role=UserRole.PROVIDER)
    verif_adv = User(email="verif_adv@example.com", password_hash=get_password_hash("Pass123!"), role=UserRole.PROVIDER)

    db.add_all([cit_user, unverif_adv, verif_adv])
    db.commit()

    # Provider A: SUBMITTED (Unverified)
    p_unverif = Provider(
        user_id=unverif_adv.id,
        provider_type=ProviderType.ADVOCATE,
        full_name="Advocate Unverified Gupta",
        location="Delhi",
        experience_years=10,
        verification_status=VerificationStatus.SUBMITTED,
    )
    # Provider B: VERIFIED
    p_verif = Provider(
        user_id=verif_adv.id,
        provider_type=ProviderType.ADVOCATE,
        full_name="Advocate Verified Sharma",
        location="Delhi",
        experience_years=10,
        verification_status=VerificationStatus.VERIFIED,
    )
    db.add_all([p_unverif, p_verif])
    db.commit()

    req = ServiceRequest(
        citizen_id=cit_user.id,
        service_category="Civil Litigation",
        description="Property dispute lawsuit",
        location="Delhi",
        preferred_provider_type=ProviderType.ADVOCATE
    )
    db.add(req)
    db.commit()

    token = create_access_token(subject=cit_user.id, custom_claims={"email": cit_user.email, "role": "CITIZEN"})

    # Execute matching query
    res = client.post("/api/matching/providers", json={"request_id": req.id}, headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200
    data = res.json()

    # HARD SAFETY ASSERTION: Only the VERIFIED advocate appears in matching results
    assert data["total_matches"] == 1
    matched = data["matched_providers"]
    assert len(matched) == 1
    assert matched[0]["provider_id"] == p_verif.id
    assert matched[0]["full_name"] == "Advocate Verified Sharma"

    # Direct API safety assertion: Unverified provider ID does NOT exist in matching output
    provider_ids = [m["provider_id"] for m in matched]
    assert p_unverif.id not in provider_ids


def test_practice_evidence_does_not_increase_rank_or_score(client, setup_database):
    """Test 2: Submitting practice case evidence does NOT increase provider match score or ranking."""
    db = setup_database

    cit_user = User(email="cit_rank@example.com", password_hash=get_password_hash("Pass123!"), role=UserRole.CITIZEN)
    adv_user1 = User(email="adv1_rank@example.com", password_hash=get_password_hash("Pass123!"), role=UserRole.PROVIDER)
    adv_user2 = User(email="adv2_rank@example.com", password_hash=get_password_hash("Pass123!"), role=UserRole.PROVIDER)
    db.add_all([cit_user, adv_user1, adv_user2])
    db.commit()

    p1 = Provider(
        user_id=adv_user1.id,
        provider_type=ProviderType.ADVOCATE,
        full_name="Advocate A",
        location="Mumbai",
        experience_years=8,
        verification_status=VerificationStatus.VERIFIED,
        reliability_score=80.0
    )
    p2 = Provider(
        user_id=adv_user2.id,
        provider_type=ProviderType.ADVOCATE,
        full_name="Advocate B",
        location="Mumbai",
        experience_years=8,
        verification_status=VerificationStatus.VERIFIED,
        reliability_score=80.0
    )
    db.add_all([p1, p2])
    db.commit()

    # Add 5 case references to Provider 2
    rec2 = ProviderVerificationRecord(provider_id=p2.id, overall_status=DetailedVerificationStatus.VERIFIED)
    db.add(rec2)
    db.commit()

    prof2 = AdvocateVerificationProfile(verification_record_id=rec2.id, provider_id=p2.id, state_bar_council="BCC", enrollment_number="123", enrollment_year=2015)
    db.add(prof2)
    db.commit()

    for i in range(5):
        case_ref = AdvocateCaseReference(
            advocate_profile_id=prof2.id,
            provider_id=p2.id,
            case_number=f"CASE-2024-{i}",
            court_name="High Court",
            evidence_status=EvidenceStatus.VERIFIED,
            verification_status=DetailedVerificationStatus.VERIFIED
        )
        db.add(case_ref)
    db.commit()

    req = ServiceRequest(
        citizen_id=cit_user.id,
        service_category="Corporate Law",
        description="Corporate contract litigation",
        location="Mumbai",
        preferred_provider_type=ProviderType.ADVOCATE
    )
    db.add(req)
    db.commit()

    score1 = calculate_provider_match_score(p1, req, db)
    score2 = calculate_provider_match_score(p2, req, db)

    # Score MUST be identical; extra case references do NOT increase match score
    assert score1 == score2


def test_public_verification_metadata_and_privacy_boundaries(client, setup_database):
    """Test 3: MatchedProviderOut exposes public factual badges but omits private documents & admin notes."""
    db = setup_database

    cit_user = User(email="cit_priv@example.com", password_hash=get_password_hash("Pass123!"), role=UserRole.CITIZEN)
    adv_user = User(email="adv_priv@example.com", password_hash=get_password_hash("Pass123!"), role=UserRole.PROVIDER)
    db.add_all([cit_user, adv_user])
    db.commit()

    provider = Provider(
        user_id=adv_user.id,
        provider_type=ProviderType.ADVOCATE,
        full_name="Advocate Privacy Check",
        location="Delhi",
        experience_years=14,
        verification_status=VerificationStatus.VERIFIED,
    )
    db.add(provider)
    db.commit()

    rec = ProviderVerificationRecord(
        provider_id=provider.id,
        overall_status=DetailedVerificationStatus.VERIFIED,
        credential_status=DetailedVerificationStatus.VERIFIED,
        verification_notes="CONFIDENTIAL INTERNAL ADMIN NOTE: License verified against Bar database."
    )
    db.add(rec)
    db.commit()

    prof = AdvocateVerificationProfile(
        verification_record_id=rec.id,
        provider_id=provider.id,
        state_bar_council="Bar Council of Delhi",
        enrollment_number="D/999/2010",
        enrollment_year=2010,
        credential_document_id=9876,
    )
    db.add(prof)
    db.commit()

    case_ref = AdvocateCaseReference(
        advocate_profile_id=prof.id,
        provider_id=provider.id,
        case_number="CIV-2024-001",
        court_name="Delhi High Court",
        evidence_status=EvidenceStatus.VERIFIED,
        verification_status=DetailedVerificationStatus.VERIFIED,
        verification_notes="CONFIDENTIAL INTERNAL CASE NOTE"
    )
    db.add(case_ref)
    db.commit()

    req = ServiceRequest(
        citizen_id=cit_user.id,
        service_category="Civil Litigation",
        description="Property dispute",
        location="Delhi",
        preferred_provider_type=ProviderType.ADVOCATE
    )
    db.add(req)
    db.commit()

    token = create_access_token(subject=cit_user.id, custom_claims={"email": cit_user.email, "role": "CITIZEN"})

    # 1. Check matching endpoint
    res = client.post("/api/matching/providers", json={"request_id": req.id}, headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200
    matched = res.json()["matched_providers"][0]

    assert matched["professional_credential_verified"] is True
    assert matched["practice_evidence_reviewed"] is True
    assert matched["practice_evidence_count"] == 1

    # Privacy Assertions: Internal admin notes & document IDs are NOT in MatchedProviderOut
    matched_str = str(matched)
    assert "CONFIDENTIAL INTERNAL ADMIN NOTE" not in matched_str
    assert "9876" not in matched_str

    # 2. Check public provider discovery endpoint
    pub_res = client.get(f"/api/providers/{provider.id}")
    assert pub_res.status_code == 200
    pub_data = pub_res.json()

    assert pub_data["professional_credential_verified"] is True
    assert pub_data["practice_evidence_reviewed"] is True
    assert pub_data["practice_evidence_count"] == 1

    pub_str = str(pub_data)
    assert "CONFIDENTIAL INTERNAL ADMIN NOTE" not in pub_str
    assert "9876" not in pub_str
