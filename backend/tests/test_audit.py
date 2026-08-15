import io
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.db.database import SessionLocal, init_db, engine
from app.db.base import Base
from app.core.security import get_password_hash, create_access_token
from app.models.user import User, UserRole
from app.models.provider import Provider, ProviderType
from app.models.audit import AuditLog
from app.services.provider_service import seed_default_provider_field_definitions
from app.services.audit import log_audit, ACTION_USER_LOGIN, ACTION_DOCUMENT_UPLOADED, ACTION_DOCUMENT_SHARED, ACTION_DOCUMENT_ACCESS_DENIED

VALID_PDF_BYTES = b"%PDF-1.4 sample test pdf file bytes..."


@pytest.fixture(autouse=True)
def setup_database():
    """Reset database tables before each test."""
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        seed_default_provider_field_definitions(db)
        yield db
    finally:
        db.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


def test_login_generates_audit_event(client, setup_database):
    """Test user login generates USER_LOGIN audit event."""
    db = setup_database

    user = User(email="login_aud@example.com", password_hash=get_password_hash("Pass123!"), role=UserRole.CITIZEN)
    db.add(user)
    db.commit()

    # Login
    res = client.post("/api/auth/login", json={"email": "login_aud@example.com", "password": "Pass123!"})
    assert res.status_code == 200

    # Verify audit log recorded
    logs = db.query(AuditLog).filter(AuditLog.user_id == user.id, AuditLog.action == "USER_LOGIN").all()
    assert len(logs) == 1
    assert logs[0].action == "USER_LOGIN"


def test_document_actions_generate_audit_events(client, setup_database):
    """Test document upload, share, and denied access generate audit logs."""
    db = setup_database

    user_cit = User(email="cit_doc_aud@example.com", password_hash=get_password_hash("Pass123!"), role=UserRole.CITIZEN)
    user_other = User(email="other_aud@example.com", password_hash=get_password_hash("Pass123!"), role=UserRole.CITIZEN)
    user_prov = User(email="prov_aud@example.com", password_hash=get_password_hash("Pass123!"), role=UserRole.PROVIDER)
    db.add_all([user_cit, user_other, user_prov])
    db.commit()

    provider = Provider(user_id=user_prov.id, provider_type=ProviderType.ADVOCATE, full_name="Advocate Audit")
    db.add(provider)
    db.commit()

    token_cit = create_access_token(subject=user_cit.id, custom_claims={"email": user_cit.email, "role": "CITIZEN"})
    token_other = create_access_token(subject=user_other.id, custom_claims={"email": user_other.email, "role": "CITIZEN"})

    # 1. Upload generates audit log
    upload_file = ("deed.pdf", io.BytesIO(VALID_PDF_BYTES), "application/pdf")
    res_up = client.post("/api/documents", files={"file": upload_file}, headers={"Authorization": f"Bearer {token_cit}"})
    assert res_up.status_code == 201
    doc_id = res_up.json()["id"]

    logs_up = db.query(AuditLog).filter(AuditLog.resource_id == doc_id, AuditLog.action == "DOCUMENT_UPLOAD").all()
    assert len(logs_up) == 1

    # 2. Denied access generates audit log
    res_denied = client.get(f"/api/documents/{doc_id}", headers={"Authorization": f"Bearer {token_other}"})
    assert res_denied.status_code == 403

    logs_denied = db.query(AuditLog).filter(AuditLog.resource_id == doc_id, AuditLog.action == "DOCUMENT_DENIED_ACCESS").all()
    assert len(logs_denied) == 1

    # 3. Share generates audit log
    res_share = client.post(f"/api/documents/{doc_id}/share", json={"provider_id": provider.id}, headers={"Authorization": f"Bearer {token_cit}"})
    assert res_share.status_code == 200

    logs_share = db.query(AuditLog).filter(AuditLog.resource_id == doc_id, AuditLog.action == "DOCUMENT_SHARE").all()
    assert len(logs_share) == 1


def test_admin_can_access_audit_logs_and_filtering(client, setup_database):
    """Test Admin can query audit logs and apply filters."""
    db = setup_database

    admin = User(email="admin_aud@example.com", password_hash=get_password_hash("Pass123!"), role=UserRole.ADMIN)
    citizen = User(email="cit_aud@example.com", password_hash=get_password_hash("Pass123!"), role=UserRole.CITIZEN)
    db.add_all([admin, citizen])
    db.commit()

    log_audit(db, user_id=citizen.id, action="USER_REGISTERED", resource_type="user", resource_id=citizen.id)

    token_admin = create_access_token(subject=admin.id, custom_claims={"email": admin.email, "role": "ADMIN"})
    headers_admin = {"Authorization": f"Bearer {token_admin}"}

    res = client.get("/api/audit", headers=headers_admin)
    assert res.status_code == 200
    data = res.json()
    assert len(data) >= 1
    assert data[0]["action"] == "USER_REGISTERED"

    # Test filtering by action
    res_filt = client.get("/api/audit?action=USER_REGISTERED", headers=headers_admin)
    assert res_filt.status_code == 200
    assert len(res_filt.json()) == 1


def test_citizen_and_provider_cannot_access_audit_endpoint(client, setup_database):
    """Test Citizen and Provider accounts receive 403 Forbidden when attempting to access audit logs."""
    db = setup_database

    citizen = User(email="cit_no_aud@example.com", password_hash=get_password_hash("Pass123!"), role=UserRole.CITIZEN)
    provider_user = User(email="prov_no_aud@example.com", password_hash=get_password_hash("Pass123!"), role=UserRole.PROVIDER)
    db.add_all([citizen, provider_user])
    db.commit()

    token_cit = create_access_token(subject=citizen.id, custom_claims={"email": citizen.email, "role": "CITIZEN"})
    token_prov = create_access_token(subject=provider_user.id, custom_claims={"email": provider_user.email, "role": "PROVIDER"})

    # Citizen denied
    res_cit = client.get("/api/audit", headers={"Authorization": f"Bearer {token_cit}"})
    assert res_cit.status_code == 403

    # Provider denied
    res_prov = client.get("/api/audit", headers={"Authorization": f"Bearer {token_prov}"})
    assert res_prov.status_code == 403


def test_sensitive_values_sanitization_in_audit_logs(setup_database):
    """Test that sensitive values (password, tokens, file_data) are NEVER written to audit records."""
    db = setup_database

    user = User(email="sens@example.com", password_hash=get_password_hash("Pass123!"), role=UserRole.CITIZEN)
    db.add(user)
    db.commit()

    sensitive_input_meta = {
        "password": "SecretPassword123!",
        "password_hash": "$2b$12$fakehash...",
        "token": "eyJhbGciOiJIUzI1Ni...",
        "file_data": "binary data content...",
        "allowed_key": "safe_metadata_value"
    }

    log_entry = log_audit(db, user_id=user.id, action="TEST_ACTION", metadata_json=sensitive_input_meta)

    # Verify sensitive keys were completely stripped
    meta = log_entry.metadata_json
    assert meta is not None
    assert "password" not in meta
    assert "password_hash" not in meta
    assert "token" not in meta
    assert "file_data" not in meta
    assert meta["allowed_key"] == "safe_metadata_value"
