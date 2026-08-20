import pytest
from datetime import datetime, timezone
from fastapi.testclient import TestClient
from app.db.database import SessionLocal, engine
from app.db.base import Base
from app.core.security import get_password_hash, create_access_token
from app.models.user import User, UserRole
from app.models.provider import Provider, ProviderType, VerificationStatus
from app.models.document import Document, DocumentVisibility
from app.models.verification import (
    ProviderVerificationRecord,
    AdvocateVerificationProfile,
    AdvocateCaseReference,
    DetailedVerificationStatus,
    EvidenceStatus,
    CredentialType,
)
from app.services.audit import log_audit, sanitize_metadata
from app.main import app
from app.services.provider_service import seed_default_provider_field_definitions


@pytest.fixture(autouse=True)
def setup_database():
    """Reset and seed database before each security audit test."""
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


def create_user_helper(db, email, role=UserRole.PROVIDER):
    u = User(email=email, password_hash=get_password_hash("Pass123!"), role=role)
    db.add(u)
    db.commit()
    db.refresh(u)
    token = create_access_token(subject=u.id, custom_claims={"email": u.email, "role": role.value if hasattr(role, 'value') else role})
    headers = {"Authorization": f"Bearer {token}"}
    return u, headers


def create_provider_helper(db, user, provider_type=ProviderType.ADVOCATE, status_val=VerificationStatus.SUBMITTED):
    p = Provider(
        user_id=user.id,
        provider_type=provider_type,
        full_name=f"Provider {user.id}",
        location="Delhi",
        experience_years=5,
        verification_status=status_val,
    )
    db.add(p)
    db.commit()
    db.refresh(p)
    return p


# ==============================================================================
# PHASE 7 SECURITY AUDIT TESTS (REQUIREMENTS 1 - 15)
# ==============================================================================

def test_1_provider_a_cannot_access_provider_b_verification_records(client, setup_database):
    """Req 1: Provider A cannot access Provider B's verification records."""
    db = setup_database
    u_a, h_a = create_user_helper(db, "pa@lexlogic.org")
    p_a = create_provider_helper(db, u_a)

    u_b, h_b = create_user_helper(db, "pb@lexlogic.org")
    p_b = create_provider_helper(db, u_b)

    # Provider A calls get verification record
    res_a = client.get("/api/providers/verification/me", headers=h_a)
    assert res_a.status_code == 200
    assert res_a.json()["provider_id"] == p_a.id
    assert res_a.json()["provider_id"] != p_b.id


def test_2_provider_a_cannot_access_provider_b_credential_documents(client, setup_database):
    """Req 2: Provider A cannot access Provider B's private credential document."""
    db = setup_database
    u_a, h_a = create_user_helper(db, "pa2@lexlogic.org")
    p_a = create_provider_helper(db, u_a)

    u_b, h_b = create_user_helper(db, "pb2@lexlogic.org")
    p_b = create_provider_helper(db, u_b)

    doc_b = Document(
        owner_id=u_b.id,
        title="B Certificate",
        filename="b_cert.pdf",
        file_path="/tmp/b_cert.pdf",
        file_size_bytes=100,
        mime_type="application/pdf",
        visibility=DocumentVisibility.PRIVATE,
    )
    db.add(doc_b)
    db.commit()

    # Provider A tries to download Provider B's document
    res = client.get(f"/api/documents/{doc_b.id}", headers=h_a)
    assert res.status_code in (403, 404)


def test_3_provider_a_cannot_access_or_modify_provider_b_practice_evidence(client, setup_database):
    """Req 3: Provider A cannot access, modify, or delete Provider B's practice evidence."""
    db = setup_database
    u_a, h_a = create_user_helper(db, "pa3@lexlogic.org")
    p_a = create_provider_helper(db, u_a)

    u_b, h_b = create_user_helper(db, "pb3@lexlogic.org")
    p_b = create_provider_helper(db, u_b)

    verif_rec_b = ProviderVerificationRecord(provider_id=p_b.id)
    db.add(verif_rec_b)
    db.commit()

    adv_profile_b = AdvocateVerificationProfile(verification_record_id=verif_rec_b.id, provider_id=p_b.id)
    db.add(adv_profile_b)
    db.commit()

    case_b = AdvocateCaseReference(
        advocate_profile_id=adv_profile_b.id,
        provider_id=p_b.id,
        case_number="CIV-2024-11",
        court_name="District Court Delhi",
        evidence_status=EvidenceStatus.SUBMITTED,
        verification_status=DetailedVerificationStatus.SUBMITTED,
    )
    db.add(case_b)
    db.commit()

    # Provider A attempts to GET practice evidence -> only gets own
    res_list = client.get("/api/providers/verification/practice-evidence", headers=h_a)
    assert res_list.status_code == 200
    assert len(res_list.json()) == 0

    # Provider A attempts to PUT modify Provider B's case evidence -> 403
    res_put = client.put(
        f"/api/providers/verification/practice-evidence/{case_b.id}",
        json={"court_name": "Hacked Court Name"},
        headers=h_a,
    )
    assert res_put.status_code == 403

    # Provider A attempts to DELETE Provider B's case evidence -> 403
    res_del = client.delete(
        f"/api/providers/verification/practice-evidence/{case_b.id}",
        headers=h_a,
    )
    assert res_del.status_code == 403


def test_4_citizen_cannot_access_private_verification_evidence(client, setup_database):
    """Req 4: Citizen cannot access private document vault or private notes."""
    db = setup_database
    u_cit, h_cit = create_user_helper(db, "cit4@lexlogic.org", role=UserRole.CITIZEN)

    u_p, h_p = create_user_helper(db, "p4@lexlogic.org")
    p = create_provider_helper(db, u_p, status_val=VerificationStatus.VERIFIED)

    doc_p = Document(
        owner_id=u_p.id,
        title="Private Bar Card",
        filename="bar_card.pdf",
        file_path="/tmp/bar_card.pdf",
        file_size_bytes=200,
        mime_type="application/pdf",
        visibility=DocumentVisibility.PRIVATE,
    )
    db.add(doc_p)
    db.commit()

    # Citizen tries to fetch private document
    res_doc = client.get(f"/api/documents/{doc_p.id}", headers=h_cit)
    assert res_doc.status_code in (403, 404)

    # Citizen fetches public provider profile
    res_pub = client.get(f"/api/providers/{p.id}", headers=h_cit)
    assert res_pub.status_code == 200
    res_text = res_pub.text
    assert "credential_document_id" not in res_text
    assert "verification_notes" not in res_text


def test_5_non_admin_cannot_approve_or_reject_verification(client, setup_database):
    """Req 5: Non-admin (Provider/Citizen) cannot approve or reject verification."""
    db = setup_database
    u_p, h_p = create_user_helper(db, "p5@lexlogic.org")
    p = create_provider_helper(db, u_p, status_val=VerificationStatus.SUBMITTED)

    u_attacker, h_att = create_user_helper(db, "attacker5@lexlogic.org", role=UserRole.PROVIDER)

    # Attacker tries execute decision endpoint -> 403
    res_dec = client.post(
        f"/api/providers/admin/{p.id}/verification/decision",
        json={"action": "APPROVE_CREDENTIAL", "notes": "Hacked approval"},
        headers=h_att,
    )
    assert res_dec.status_code == 403

    # Attacker tries verify endpoint -> 403
    res_ver = client.put(
        f"/api/providers/{p.id}/verify",
        json={"status": "VERIFIED", "notes": "Hacked verify"},
        headers=h_att,
    )
    assert res_ver.status_code == 403


def test_6_provider_cannot_mark_themselves_as_verified(client, setup_database):
    """Req 6: Provider calling self-submission moves status to SUBMITTED, never VERIFIED."""
    db = setup_database
    u_p, h_p = create_user_helper(db, "p6@lexlogic.org")
    p = create_provider_helper(db, u_p, status_val=VerificationStatus.PENDING)

    res = client.post("/api/providers/me/verification", json={}, headers=h_p)
    assert res.status_code == 200
    assert res.json()["verification_status"] == "SUBMITTED"
    assert res.json()["verification_status"] != "VERIFIED"


def test_7_provider_cannot_modify_an_approved_verification_record(client, setup_database):
    """Req 7: Provider cannot modify/resubmit an already approved (VERIFIED) record."""
    db = setup_database
    u_p, h_p = create_user_helper(db, "p7@lexlogic.org")
    p = create_provider_helper(db, u_p, status_val=VerificationStatus.VERIFIED)

    res = client.post(
        "/api/providers/verification/advocate/submit",
        json={
            "state_bar_council": "Bar Council of Delhi",
            "enrollment_number": "D/99999/2020",
            "enrollment_year": 2020,
        },
        headers=h_p,
    )
    assert res.status_code == 400
    assert "already verified" in res.json()["detail"].lower()


def test_8_provider_cannot_manipulate_verification_status_through_api(client, setup_database):
    """Req 8: Provider sending verification_status in profile update payload is ignored or rejected."""
    db = setup_database
    u_p, h_p = create_user_helper(db, "p8@lexlogic.org")
    p = create_provider_helper(db, u_p, status_val=VerificationStatus.PENDING)

    # Provider tries mass assignment update
    res = client.put(
        "/api/providers/me",
        json={
            "full_name": "Updated Name",
            "verification_status": "VERIFIED"
        },
        headers=h_p,
    )
    assert res.status_code == 200
    assert res.json()["verification_status"] == "PENDING"
    assert res.json()["verification_status"] != "VERIFIED"


def test_9_provider_cannot_access_verification_records_by_changing_ids(client, setup_database):
    """Req 9: Endpoint /verification/me derives record strictly from JWT current_user."""
    db = setup_database
    u_a, h_a = create_user_helper(db, "pa9@lexlogic.org")
    p_a = create_provider_helper(db, u_a)

    u_b, h_b = create_user_helper(db, "pb9@lexlogic.org")
    p_b = create_provider_helper(db, u_b)

    # Calling /verification/me with query params or modified headers still returns User A's record
    res = client.get("/api/providers/verification/me?provider_id=999", headers=h_a)
    assert res.status_code == 200
    assert res.json()["provider_id"] == p_a.id


def test_10_executable_files_disguised_as_documents_are_rejected(client, setup_database):
    """Req 10: Executable files disguised with .pdf extension fail magic byte check."""
    db = setup_database
    u_p, h_p = create_user_helper(db, "p10@lexlogic.org")

    fake_pdf_exe = b"MZ\x90\x00\x03\x00\x00\x00"  # Windows PE executable magic bytes
    files = {"file": ("malicious.pdf", fake_pdf_exe, "application/pdf")}

    res = client.post("/api/documents/upload", files=files, headers=h_p)
    assert res.status_code == 400
    assert "magic bytes" in res.json()["detail"].lower() or "rejected" in res.json()["detail"].lower()


def test_11_file_type_and_size_validation_enforced(client, setup_database):
    """Req 11: Extension and size limits are strictly enforced."""
    db = setup_database
    u_p, h_p = create_user_helper(db, "p11@lexlogic.org")

    # Disallowed extension
    files = {"file": ("script.sh", b"#!/bin/bash\necho 1", "text/x-sh")}
    res_ext = client.post("/api/documents/upload", files=files, headers=h_p)
    assert res_ext.status_code == 400

    # Oversized file
    big_content = b"%PDF-" + b"0" * (11 * 1024 * 1024)
    files_big = {"file": ("big.pdf", big_content, "application/pdf")}
    res_size = client.post("/api/documents/upload", files=files_big, headers=h_p)
    assert res_size.status_code == 400


def test_12_private_documents_never_publicly_accessible(client, setup_database):
    """Req 12: Unauthenticated requests to private documents are blocked."""
    db = setup_database
    u_p, h_p = create_user_helper(db, "p12@lexlogic.org")

    doc = Document(
        owner_id=u_p.id,
        title="Priv Document",
        filename="priv.pdf",
        file_path="/tmp/priv.pdf",
        file_size_bytes=100,
        mime_type="application/pdf",
        visibility=DocumentVisibility.PRIVATE,
    )
    db.add(doc)
    db.commit()

    # Unauthenticated GET
    res = client.get(f"/api/documents/{doc.id}")
    assert res.status_code == 401


def test_13_audit_logs_cannot_be_modified_by_normal_users(client, setup_database):
    """Req 13: Normal users cannot query or modify audit logs."""
    db = setup_database
    u_p, h_p = create_user_helper(db, "p13@lexlogic.org")

    # GET audit logs as normal user -> 403
    res_get = client.get("/api/audit", headers=h_p)
    assert res_get.status_code == 403

    # POST audit logs -> 405 (Method Not Allowed)
    res_post = client.post("/api/audit", json={}, headers=h_p)
    assert res_post.status_code == 405


def test_14_sensitive_fields_excluded_from_audit_logs(client, setup_database):
    """Req 14: Sensitive fields (password, token, secret) are stripped from audit log metadata."""
    db = setup_database

    meta = {
        "user_id": 10,
        "password": "SuperSecretPassword123!",
        "access_token": "bearer_xyz_123",
        "action_details": "Valid detail"
    }
    clean = sanitize_metadata(meta)
    assert "password" not in clean
    assert "access_token" not in clean
    assert clean["user_id"] == 10
    assert clean["action_details"] == "Valid detail"


def test_15_unowned_credential_document_binding_prevented(client, setup_database):
    """Req 15: Provider A cannot bind Provider B's private document ID during verification submission."""
    db = setup_database
    u_a, h_a = create_user_helper(db, "pa15@lexlogic.org")
    p_a = create_provider_helper(db, u_a)

    u_b, h_b = create_user_helper(db, "pb15@lexlogic.org")
    p_b = create_provider_helper(db, u_b)

    doc_b = Document(
        owner_id=u_b.id,
        title="Provider B Cert",
        filename="b_cert.pdf",
        file_path="/tmp/b_cert.pdf",
        file_size_bytes=100,
        mime_type="application/pdf",
        visibility=DocumentVisibility.PRIVATE,
    )
    db.add(doc_b)
    db.commit()

    # Provider A tries to submit verification using Provider B's document ID -> 403
    res = client.post(
        "/api/providers/verification/advocate/submit",
        json={
            "state_bar_council": "Bar Council of Delhi",
            "enrollment_number": "D/12345/2021",
            "enrollment_year": 2021,
            "credential_document_id": doc_b.id,
        },
        headers=h_a,
    )
    assert res.status_code == 403
    assert "unowned" in res.json()["detail"].lower() or "access denied" in res.json()["detail"].lower()
