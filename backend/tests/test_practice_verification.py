import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
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
)
from app.models.audit import AuditLog
from app.main import app


@pytest.fixture
def db():
    """Reset database tables before each test."""
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


def create_test_user(db: Session, email: str, role: UserRole) -> User:
    user = User(
        email=email,
        password_hash=get_password_hash("Password123!"),
        role=role,
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def create_test_provider(db: Session, user: User, provider_type: ProviderType = ProviderType.ADVOCATE) -> Provider:
    provider = Provider(
        user_id=user.id,
        full_name=f"Provider {user.id}",
        provider_type=provider_type,
        location="Bengaluru",
        verification_status=VerificationStatus.SUBMITTED,
        profile_completion_percentage=100.0,
    )
    db.add(provider)
    db.commit()
    db.refresh(provider)
    return provider


def get_auth_headers(user: User) -> dict:
    token = create_access_token(subject=str(user.id))
    return {"Authorization": f"Bearer {token}"}


def test_practice_evidence_crud_and_manual_verifier(client: TestClient, db: Session):
    """Test advocate submitting, fetching, modifying, and deleting practice evidence."""
    provider_user = create_test_user(db, "advocate1@lexlogic.org", UserRole.PROVIDER)
    provider = create_test_provider(db, provider_user)
    headers = get_auth_headers(provider_user)

    # 1. Submit Case Evidence
    payload = {
        "case_number": "WP 10293/2024",
        "court_name": "High Court of Karnataka",
        "case_type": "Constitutional Law",
        "case_year": 2024,
        "advocate_role": "Lead Counsel",
    }
    response = client.post("/api/providers/verification/practice-evidence", json=payload, headers=headers)
    assert response.status_code == 201
    data = response.json()
    assert data["case_number"] == "WP 10293/2024"
    assert data["court_name"] == "High Court of Karnataka"
    assert data["verification_status"] == DetailedVerificationStatus.SUBMITTED.value
    assert data["evidence_source_reference"] == "LEXLOGIC_MANUAL_REVIEW_QUEUE"
    case_id = data["id"]

    # Verify audit log for submission
    audit_entry = db.query(AuditLog).filter(AuditLog.action == "CASE_EVIDENCE_SUBMITTED").first()
    assert audit_entry is not None
    assert audit_entry.user_id == provider_user.id

    # 2. Get My Practice Evidence
    res_list = client.get("/api/providers/verification/practice-evidence", headers=headers)
    assert res_list.status_code == 200
    evidence_list = res_list.json()
    assert len(evidence_list) == 1
    assert evidence_list[0]["id"] == case_id

    # 3. Modify Practice Evidence
    update_payload = {
        "advocate_role": "Senior Co-Counsel",
        "case_year": 2025
    }
    res_update = client.put(f"/api/providers/verification/practice-evidence/{case_id}", json=update_payload, headers=headers)
    assert res_update.status_code == 200
    updated_data = res_update.json()
    assert updated_data["advocate_role"] == "Senior Co-Counsel"
    assert updated_data["case_year"] == 2025

    # Verify audit log for modification
    audit_mod = db.query(AuditLog).filter(AuditLog.action == "CASE_EVIDENCE_MODIFIED").first()
    assert audit_mod is not None

    # 4. Delete Practice Evidence
    res_delete = client.delete(f"/api/providers/verification/practice-evidence/{case_id}", headers=headers)
    assert res_delete.status_code == 200

    # Confirm list is now empty
    res_list_after = client.get("/api/providers/verification/practice-evidence", headers=headers)
    assert len(res_list_after.json()) == 0


def test_duplicate_case_reference_prevention(client: TestClient, db: Session):
    """Test that submitting duplicate case references for the same court and case number is rejected."""
    provider_user = create_test_user(db, "advocate_dup@lexlogic.org", UserRole.PROVIDER)
    create_test_provider(db, provider_user)
    headers = get_auth_headers(provider_user)

    payload = {
        "case_number": "OS 4492/2023",
        "court_name": "City Civil Court Bengaluru",
        "case_type": "Civil Property Dispute",
        "case_year": 2023,
    }
    res1 = client.post("/api/providers/verification/practice-evidence", json=payload, headers=headers)
    assert res1.status_code == 201

    # Attempt submitting exact duplicate
    res2 = client.post("/api/providers/verification/practice-evidence", json=payload, headers=headers)
    assert res2.status_code == 400
    assert "already been submitted" in res2.json()["detail"]


def test_idor_protection_and_provider_isolation(client: TestClient, db: Session):
    """Test IDOR protection: Provider B cannot view, modify, or delete Provider A's practice evidence."""
    user_a = create_test_user(db, "advocateA@lexlogic.org", UserRole.PROVIDER)
    provider_a = create_test_provider(db, user_a)

    user_b = create_test_user(db, "advocateB@lexlogic.org", UserRole.PROVIDER)
    provider_b = create_test_provider(db, user_b)

    headers_a = get_auth_headers(user_a)
    headers_b = get_auth_headers(user_b)

    # Provider A submits evidence
    payload_a = {
        "case_number": "CRL A 771/2022",
        "court_name": "Sessions Court",
        "case_type": "Criminal Appeal",
    }
    res_a = client.post("/api/providers/verification/practice-evidence", json=payload_a, headers=headers_a)
    assert res_a.status_code == 201
    case_id_a = res_a.json()["id"]

    # Provider B attempts to update Provider A's evidence -> 403 Forbidden
    res_b_update = client.put(f"/api/providers/verification/practice-evidence/{case_id_a}", json={"advocate_role": "Hacker"}, headers=headers_b)
    assert res_b_update.status_code == 403
    assert "Access denied" in res_b_update.json()["detail"]

    # Provider B attempts to delete Provider A's evidence -> 403 Forbidden
    res_b_delete = client.delete(f"/api/providers/verification/practice-evidence/{case_id_a}", headers=headers_b)
    assert res_b_delete.status_code == 403

    # Provider B's own evidence list should NOT contain Provider A's case
    res_b_list = client.get("/api/providers/verification/practice-evidence", headers=headers_b)
    assert len(res_b_list.json()) == 0


def test_unauthorized_and_citizen_isolation(client: TestClient, db: Session):
    """Test that unauthorized users & Citizens cannot access practice evidence write/review endpoints."""
    citizen_user = create_test_user(db, "citizen_test@lexlogic.org", UserRole.CITIZEN)
    headers_citizen = get_auth_headers(citizen_user)

    payload = {
        "case_number": "CA 100/2024",
        "court_name": "Commercial Court",
    }

    # Citizen trying to POST evidence -> 403 Forbidden (require_provider)
    res = client.post("/api/providers/verification/practice-evidence", json=payload, headers=headers_citizen)
    assert res.status_code == 403

    # Unauthenticated user -> 401 Unauthorized
    res_unauth = client.post("/api/providers/verification/practice-evidence", json=payload)
    assert res_unauth.status_code == 401


def test_admin_review_workflow_and_audit_trail(client: TestClient, db: Session):
    """Test Admin reviewing case evidence (VERIFIED / REJECTED) and audit trail logging."""
    advocate_user = create_test_user(db, "advocate_rev@lexlogic.org", UserRole.PROVIDER)
    create_test_provider(db, advocate_user)
    headers_adv = get_auth_headers(advocate_user)

    admin_user = create_test_user(db, "admin_rev@lexlogic.org", UserRole.ADMIN)
    headers_admin = get_auth_headers(admin_user)

    # 1. Advocate submits case evidence
    payload = {
        "case_number": "SLP (C) 1204/2023",
        "court_name": "Supreme Court of India",
        "case_type": "Civil Appeal",
    }
    res_submit = client.post("/api/providers/verification/practice-evidence", json=payload, headers=headers_adv)
    case_id = res_submit.json()["id"]

    # 2. Non-admin provider attempts admin review endpoint -> 403 Forbidden
    res_fake_admin = client.put(
        f"/api/providers/verification/practice-evidence/{case_id}/review",
        json={"status": "VERIFIED", "notes": "Fake approval"},
        headers=headers_adv
    )
    assert res_fake_admin.status_code == 403

    # 3. Legitimate Admin approves case evidence
    review_payload = {
        "status": DetailedVerificationStatus.VERIFIED.value,
        "notes": "Verified against Supreme Court e-filing portal citation",
        "evidence_source_reference": "SCI_EFILING_REF_99182"
    }
    res_admin_review = client.put(
        f"/api/providers/verification/practice-evidence/{case_id}/review",
        json=review_payload,
        headers=headers_admin
    )
    assert res_admin_review.status_code == 200
    data_rev = res_admin_review.json()
    assert data_rev["verification_status"] == DetailedVerificationStatus.VERIFIED.value
    assert data_rev["evidence_status"] == EvidenceStatus.VERIFIED.value
    assert data_rev["evidence_source_reference"] == "SCI_EFILING_REF_99182"
    assert data_rev["verified_at"] is not None

    # Verify Audit Logs
    audit_reviewed = db.query(AuditLog).filter(AuditLog.action == "CASE_EVIDENCE_REVIEWED").first()
    assert audit_reviewed is not None
    assert audit_reviewed.user_id == admin_user.id

    audit_approved = db.query(AuditLog).filter(AuditLog.action == "CASE_EVIDENCE_APPROVED").first()
    assert audit_approved is not None
    assert audit_approved.user_id == admin_user.id
