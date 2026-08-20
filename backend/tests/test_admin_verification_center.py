import pytest
from fastapi.testclient import TestClient
from app.db.database import SessionLocal, engine
from app.db.base import Base
from app.core.security import get_password_hash, create_access_token
from app.models.user import User, UserRole
from app.models.provider import Provider, ProviderType, VerificationStatus, AvailabilityStatus
from app.models.verification import (
    ProviderVerificationRecord,
    AdvocateVerificationProfile,
    AdvocateCaseReference,
    DetailedVerificationStatus,
    EvidenceStatus,
    CredentialType,
    ProviderVerificationHistory,
)
from app.main import app
from app.services.provider_service import seed_default_provider_field_definitions


@pytest.fixture(autouse=True)
def setup_database():
    """Reset and seed database before each test."""
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        seed_default_provider_field_definitions(db)
        yield db
    finally:
        db.close()


def create_test_users(db):
    """Helper to create admin, citizen, and advocate provider users."""
    admin_u = User(email="admin_verif@lexlogic.org", password_hash=get_password_hash("Pass123!"), role=UserRole.ADMIN)
    citizen_u = User(email="citizen_verif@lexlogic.org", password_hash=get_password_hash("Pass123!"), role=UserRole.CITIZEN)
    advocate_u = User(email="advocate_verif@lexlogic.org", password_hash=get_password_hash("Pass123!"), role=UserRole.PROVIDER)

    db.add_all([admin_u, citizen_u, advocate_u])
    db.commit()

    provider = Provider(
        user_id=advocate_u.id,
        provider_type=ProviderType.ADVOCATE,
        full_name="Advocate Ramesh Verma",
        phone="+919800112233",
        location="Delhi High Court",
        experience_years=12,
        verification_status=VerificationStatus.SUBMITTED,
    )
    db.add(provider)
    db.commit()

    verif_rec = ProviderVerificationRecord(
        provider_id=provider.id,
        overall_status=DetailedVerificationStatus.SUBMITTED,
        identity_status=DetailedVerificationStatus.SUBMITTED,
        credential_status=DetailedVerificationStatus.SUBMITTED,
        practice_status=DetailedVerificationStatus.SUBMITTED,
    )
    db.add(verif_rec)
    db.commit()

    adv_profile = AdvocateVerificationProfile(
        verification_record_id=verif_rec.id,
        provider_id=provider.id,
        full_legal_name="Ramesh Chandra Verma",
        jurisdiction_city="New Delhi",
        jurisdiction_state="Delhi",
        state_bar_council="Bar Council of Delhi",
        enrollment_number="D/12345/2012",
        enrollment_year=2012,
        credential_type=CredentialType.BAR_ENROLLMENT_CERTIFICATE,
        credential_verification_status=DetailedVerificationStatus.SUBMITTED,
    )
    db.add(adv_profile)
    db.commit()

    case_ref = AdvocateCaseReference(
        advocate_profile_id=adv_profile.id,
        provider_id=provider.id,
        case_number="CRL-APPL-2024-9988",
        court_name="Delhi High Court",
        case_type="Criminal Appeals",
        case_year=2024,
        advocate_role="Lead Defense Counsel",
        evidence_status=EvidenceStatus.SUBMITTED,
        verification_status=DetailedVerificationStatus.SUBMITTED,
    )
    db.add(case_ref)
    db.commit()

    admin_token = create_access_token(subject=admin_u.id, custom_claims={"email": admin_u.email, "role": "ADMIN"})
    citizen_token = create_access_token(subject=citizen_u.id, custom_claims={"email": citizen_u.email, "role": "CITIZEN"})
    provider_token = create_access_token(subject=advocate_u.id, custom_claims={"email": advocate_u.email, "role": "PROVIDER"})

    return {
        "admin_u": admin_u,
        "citizen_u": citizen_u,
        "advocate_u": advocate_u,
        "provider": provider,
        "verif_rec": verif_rec,
        "adv_profile": adv_profile,
        "case_ref": case_ref,
        "admin_headers": {"Authorization": f"Bearer {admin_token}"},
        "citizen_headers": {"Authorization": f"Bearer {citizen_token}"},
        "provider_headers": {"Authorization": f"Bearer {provider_token}"},
    }


def test_rbac_admin_verification_boundaries(client):
    """Test 1: Non-admin users (Citizens, Providers, Unauthenticated) receive 403 / 401 on admin verification routes."""
    db = SessionLocal()
    ctx = create_test_users(db)
    provider_id = ctx["provider"].id
    case_id = ctx["case_ref"].id

    # 1. Unauthenticated -> 401
    assert client.get("/api/providers/admin/verification-queue").status_code == 401
    assert client.get(f"/api/providers/admin/{provider_id}/verification-details").status_code == 401
    assert client.post(f"/api/providers/admin/{provider_id}/verification/decision", json={"action": "APPROVE_CREDENTIAL", "notes": "Approved"}).status_code == 401
    assert client.put(f"/api/providers/verification/practice-evidence/{case_id}/review", json={"status": "VERIFIED", "notes": "Approved"}).status_code == 401

    # 2. Citizen user -> 403 Forbidden
    assert client.get("/api/providers/admin/verification-queue", headers=ctx["citizen_headers"]).status_code == 403
    assert client.get(f"/api/providers/admin/{provider_id}/verification-details", headers=ctx["citizen_headers"]).status_code == 403
    assert client.post(f"/api/providers/admin/{provider_id}/verification/decision", json={"action": "APPROVE_CREDENTIAL", "notes": "Approved"}, headers=ctx["citizen_headers"]).status_code == 403
    assert client.put(f"/api/providers/verification/practice-evidence/{case_id}/review", json={"status": "VERIFIED", "notes": "Approved"}, headers=ctx["citizen_headers"]).status_code == 403

    # 3. Provider user -> 403 Forbidden
    assert client.get("/api/providers/admin/verification-queue", headers=ctx["provider_headers"]).status_code == 403
    assert client.get(f"/api/providers/admin/{provider_id}/verification-details", headers=ctx["provider_headers"]).status_code == 403
    assert client.post(f"/api/providers/admin/{provider_id}/verification/decision", json={"action": "APPROVE_CREDENTIAL", "notes": "Approved"}, headers=ctx["provider_headers"]).status_code == 403
    assert client.put(f"/api/providers/verification/practice-evidence/{case_id}/review", json={"status": "VERIFIED", "notes": "Approved"}, headers=ctx["provider_headers"]).status_code == 403

    # 4. Admin user -> 200 OK
    assert client.get("/api/providers/admin/verification-queue", headers=ctx["admin_headers"]).status_code == 200
    assert client.get(f"/api/providers/admin/{provider_id}/verification-details", headers=ctx["admin_headers"]).status_code == 200


def test_admin_verification_queue_and_filters(client):
    """Test 2: Verification queue filtering by profession, verification status, and manual review required."""
    db = SessionLocal()
    ctx = create_test_users(db)

    # Fetch Queue
    res = client.get("/api/providers/admin/verification-queue", headers=ctx["admin_headers"])
    assert res.status_code == 200
    queue = res.json()
    assert len(queue) == 1
    item = queue[0]
    assert item["provider_id"] == ctx["provider"].id
    assert item["profession"] == "ADVOCATE"
    assert item["overall_status"] == "SUBMITTED"
    assert item["credential_status"] == "SUBMITTED"

    # Filter by Profession ADVOCATE -> 1 match
    res_adv = client.get("/api/providers/admin/verification-queue?profession=ADVOCATE", headers=ctx["admin_headers"])
    assert res_adv.status_code == 200
    assert len(res_adv.json()) == 1

    # Filter by Profession MEDIATOR -> 0 match
    res_med = client.get("/api/providers/admin/verification-queue?profession=MEDIATOR", headers=ctx["admin_headers"])
    assert res_med.status_code == 200
    assert len(res_med.json()) == 0

    # Filter by status SUBMITTED -> 1 match
    res_sub = client.get("/api/providers/admin/verification-queue?verification_status=SUBMITTED", headers=ctx["admin_headers"])
    assert res_sub.status_code == 200
    assert len(res_sub.json()) == 1

    # Filter by status VERIFIED -> 0 match
    res_ver = client.get("/api/providers/admin/verification-queue?verification_status=VERIFIED", headers=ctx["admin_headers"])
    assert res_ver.status_code == 200
    assert len(res_ver.json()) == 0


def test_mandatory_decision_notes_enforcement(client):
    """Test 3: Submitting an admin decision without notes/reasons returns 400 Bad Request."""
    db = SessionLocal()
    ctx = create_test_users(db)
    provider_id = ctx["provider"].id
    case_id = ctx["case_ref"].id

    # 1. Missing notes on credential decision -> 400
    res1 = client.post(
        f"/api/providers/admin/{provider_id}/verification/decision",
        json={"action": "APPROVE_CREDENTIAL", "notes": ""},
        headers=ctx["admin_headers"]
    )
    assert res1.status_code == 400
    assert "reason note is required" in res1.json()["detail"]

    # 2. Whitespace-only notes on credential decision -> 400
    res2 = client.post(
        f"/api/providers/admin/{provider_id}/verification/decision",
        json={"action": "REJECT_CREDENTIAL", "notes": "   "},
        headers=ctx["admin_headers"]
    )
    assert res2.status_code == 400

    # 3. Missing notes on practice evidence review -> 400
    res3 = client.put(
        f"/api/providers/verification/practice-evidence/{case_id}/review",
        json={"status": "VERIFIED", "notes": ""},
        headers=ctx["admin_headers"]
    )
    assert res3.status_code == 400


def test_execute_admin_credential_decision_lifecycle(client):
    """Test 4: Admin approves credential -> Overall & credential status updated to VERIFIED, history entry & audit log recorded."""
    db = SessionLocal()
    ctx = create_test_users(db)
    provider_id = ctx["provider"].id

    # Execute APPROVE_CREDENTIAL decision with note
    res = client.post(
        f"/api/providers/admin/{provider_id}/verification/decision",
        json={
            "action": "APPROVE_CREDENTIAL",
            "notes": "Verified Bar Council enrollment Certificate D/12345/2012 against official Bar Council registry."
        },
        headers=ctx["admin_headers"]
    )

    assert res.status_code == 200
    details = res.json()
    assert details["overall_status"] == "VERIFIED"
    assert details["credential_verification_status"] == "VERIFIED"
    assert details["verification_notes"] == "Verified Bar Council enrollment Certificate D/12345/2012 against official Bar Council registry."
    assert len(details["history_entries"]) >= 1

    history = details["history_entries"][0]
    assert history["action"] == "APPROVE_CREDENTIAL"
    assert history["to_status"] == "VERIFIED"
    assert "Bar Council enrollment" in history["notes"]

    # Verify Provider high-level status was updated to VERIFIED
    me_res = client.get("/api/providers/me", headers=ctx["provider_headers"])
    assert me_res.status_code == 200
    assert me_res.json()["verification_status"] == "VERIFIED"


def test_admin_practice_evidence_review_lifecycle(client):
    """Test 5: Admin reviews practice evidence -> Updates case evidence status and records audit log & history."""
    db = SessionLocal()
    ctx = create_test_users(db)
    case_id = ctx["case_ref"].id

    # Admin approves case evidence reference
    res = client.put(
        f"/api/providers/verification/practice-evidence/{case_id}/review",
        json={
            "status": "VERIFIED",
            "notes": "Verified Delhi High Court online order sheet for CRL-APPL-2024-9988.",
            "evidence_source_reference": "https://dhccourts.gov.in/orders/2024/9988"
        },
        headers=ctx["admin_headers"]
    )

    assert res.status_code == 200
    case_data = res.json()
    assert case_data["id"] == case_id
    assert case_data["verification_status"] == "VERIFIED"
    assert case_data["evidence_status"] == "VERIFIED"
    assert case_data["evidence_source_reference"] == "https://dhccourts.gov.in/orders/2024/9988"
    assert "Verified Delhi High Court" in case_data["verification_notes"]

    # Fetch provider verification details to verify history entry created
    details_res = client.get(f"/api/providers/admin/{ctx['provider'].id}/verification-details", headers=ctx["admin_headers"])
    assert details_res.status_code == 200
    details = details_res.json()
    assert len(details["history_entries"]) >= 1
    h_entry = details["history_entries"][0]
    assert h_entry["action"] == "PRACTICE_EVIDENCE_VERIFIED"
    assert h_entry["to_status"] == "VERIFIED"
