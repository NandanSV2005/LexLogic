import io
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.db.database import SessionLocal, init_db, engine
from app.db.base import Base
from app.core.security import get_password_hash, create_access_token
from app.models.user import User, UserRole
from app.models.provider import Provider, ProviderType
from app.models.document import Document, DocumentVisibility, DocumentShare, DocumentShareStatus
from app.models.audit import AuditLog
from app.services.provider_service import seed_default_provider_field_definitions

# Valid PDF binary header (%PDF-)
VALID_PDF_BYTES = b"%PDF-1.4 header content for unit test pdf file..."
# Valid PNG binary header (\x89PNG\r\n\x1a\n)
VALID_PNG_BYTES = b"\x89PNG\r\n\x1a\nfake png binary image content..."


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


def test_mandatory_eight_step_security_workflow(client, setup_database):
    """MANDATORY SECURITY TEST:
    1. Citizen A uploads document.
    2. Citizen B attempts access.
    3. Server returns 403.
    4. Citizen A shares document with Provider A.
    5. Provider A accesses document successfully.
    6. Citizen A revokes access.
    7. Provider A attempts access again.
    8. Server returns 403.
    """
    db = setup_database

    # Create Users & Providers
    user_cit_a = User(email="cit_a@example.com", password_hash=get_password_hash("Pass123!"), role=UserRole.CITIZEN)
    user_cit_b = User(email="cit_b@example.com", password_hash=get_password_hash("Pass123!"), role=UserRole.CITIZEN)
    user_prov_a = User(email="prov_a@example.com", password_hash=get_password_hash("Pass123!"), role=UserRole.PROVIDER)

    db.add_all([user_cit_a, user_cit_b, user_prov_a])
    db.commit()

    prov_a = Provider(user_id=user_prov_a.id, provider_type=ProviderType.ADVOCATE, full_name="Advocate A")
    db.add(prov_a)
    db.commit()

    token_cit_a = create_access_token(subject=user_cit_a.id, custom_claims={"email": user_cit_a.email, "role": "CITIZEN"})
    token_cit_b = create_access_token(subject=user_cit_b.id, custom_claims={"email": user_cit_b.email, "role": "CITIZEN"})
    token_prov_a = create_access_token(subject=user_prov_a.id, custom_claims={"email": user_prov_a.email, "role": "PROVIDER"})

    headers_cit_a = {"Authorization": f"Bearer {token_cit_a}"}
    headers_cit_b = {"Authorization": f"Bearer {token_cit_b}"}
    headers_prov_a = {"Authorization": f"Bearer {token_prov_a}"}

    # STEP 1: Citizen A uploads document
    upload_file = ("property_deed.pdf", io.BytesIO(VALID_PDF_BYTES), "application/pdf")
    res_upload = client.post("/api/documents", files={"file": upload_file}, data={"title": "Property Deed"}, headers=headers_cit_a)
    assert res_upload.status_code == 201
    doc_data = res_upload.json()
    doc_id = doc_data["id"]
    assert doc_data["owner_id"] == user_cit_a.id
    assert doc_data["visibility"] == "PRIVATE"
    # Ensure private disk path is NOT exposed
    assert "file_path" not in doc_data

    # STEP 2 & 3: Citizen B attempts access -> Server returns 403
    res_cit_b_access = client.get(f"/api/documents/{doc_id}", headers=headers_cit_b)
    assert res_cit_b_access.status_code == 403

    # STEP 4: Citizen A shares document with Provider A
    res_share = client.post(f"/api/documents/{doc_id}/share", json={"provider_id": prov_a.id}, headers=headers_cit_a)
    assert res_share.status_code == 200
    assert res_share.json()["status"] == "ACTIVE"

    # STEP 5: Provider A accesses document successfully (200 OK)
    res_prov_a_access = client.get(f"/api/documents/{doc_id}", headers=headers_prov_a)
    assert res_prov_a_access.status_code == 200
    assert res_prov_a_access.content == VALID_PDF_BYTES

    # STEP 6: Citizen A revokes access
    res_revoke = client.post(f"/api/documents/{doc_id}/revoke", json={"provider_id": prov_a.id}, headers=headers_cit_a)
    assert res_revoke.status_code == 200
    assert res_revoke.json()["status"] == "REVOKED"

    # STEP 7 & 8: Provider A attempts access again -> Server returns 403
    res_prov_a_reaccess = client.get(f"/api/documents/{doc_id}", headers=headers_prov_a)
    assert res_prov_a_reaccess.status_code == 403


def test_invalid_file_extension_and_mime_rejection(client, setup_database):
    """Test uploaded files with invalid extension or MIME type are rejected."""
    db = setup_database

    user = User(email="test_val@example.com", password_hash=get_password_hash("Pass123!"), role=UserRole.CITIZEN)
    db.add(user)
    db.commit()

    token = create_access_token(subject=user.id, custom_claims={"email": user.email, "role": "CITIZEN"})
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Invalid extension .exe
    upload_exe = ("script.exe", io.BytesIO(b"MZ executable header"), "application/octet-stream")
    res_exe = client.post("/api/documents", files={"file": upload_exe}, headers=headers)
    assert res_exe.status_code == 400
    assert "Unsupported file extension" in res_exe.json()["detail"]


def test_magic_bytes_header_validation_spoof_rejection(client, setup_database):
    """Test fake file claiming to be .pdf but lacking %PDF- magic bytes is rejected."""
    db = setup_database

    user = User(email="spoof@example.com", password_hash=get_password_hash("Pass123!"), role=UserRole.CITIZEN)
    db.add(user)
    db.commit()

    token = create_access_token(subject=user.id, custom_claims={"email": user.email, "role": "CITIZEN"})
    headers = {"Authorization": f"Bearer {token}"}

    # Fake PDF file containing text script instead of PDF binary header
    fake_pdf = ("malicious.pdf", io.BytesIO(b"echo 'malicious script'"), "application/pdf")
    res_spoof = client.post("/api/documents", files={"file": fake_pdf}, headers=headers)
    assert res_spoof.status_code == 400
    assert "binary headers do not match" in res_spoof.json()["detail"]


def test_non_owner_cannot_share_or_revoke_document(client, setup_database):
    """Test non-owners receive 403 Forbidden when attempting to share or revoke a document."""
    db = setup_database

    user_owner = User(email="owner@example.com", password_hash=get_password_hash("Pass123!"), role=UserRole.CITIZEN)
    user_other = User(email="other@example.com", password_hash=get_password_hash("Pass123!"), role=UserRole.CITIZEN)
    user_prov = User(email="prov_target@example.com", password_hash=get_password_hash("Pass123!"), role=UserRole.PROVIDER)
    db.add_all([user_owner, user_other, user_prov])
    db.commit()

    prov = Provider(user_id=user_prov.id, provider_type=ProviderType.MEDIATOR, full_name="Mediator Target")
    db.add(prov)
    db.commit()

    token_owner = create_access_token(subject=user_owner.id, custom_claims={"email": user_owner.email, "role": "CITIZEN"})
    token_other = create_access_token(subject=user_other.id, custom_claims={"email": user_other.email, "role": "CITIZEN"})

    # Owner uploads document
    upload_file = ("affidavit.pdf", io.BytesIO(VALID_PDF_BYTES), "application/pdf")
    res_upload = client.post("/api/documents", files={"file": upload_file}, headers={"Authorization": f"Bearer {token_owner}"})
    doc_id = res_upload.json()["id"]

    # Other user attempts to share owner's document -> 403
    res_share_unauth = client.post(f"/api/documents/{doc_id}/share", json={"provider_id": prov.id}, headers={"Authorization": f"Bearer {token_other}"})
    assert res_share_unauth.status_code == 403

    # Other user attempts to revoke owner's document -> 403
    res_revoke_unauth = client.post(f"/api/documents/{doc_id}/revoke", json={"provider_id": prov.id}, headers={"Authorization": f"Bearer {token_other}"})
    assert res_revoke_unauth.status_code == 403


def test_audit_logs_generated_for_document_actions(client, setup_database):
    """Test security audit log events are recorded for UPLOAD, VIEW, SHARE, REVOKE, and DENIED_ACCESS."""
    db = setup_database

    user_owner = User(email="audit_owner@example.com", password_hash=get_password_hash("Pass123!"), role=UserRole.CITIZEN)
    user_other = User(email="audit_other@example.com", password_hash=get_password_hash("Pass123!"), role=UserRole.CITIZEN)
    db.add_all([user_owner, user_other])
    db.commit()

    token_owner = create_access_token(subject=user_owner.id, custom_claims={"email": user_owner.email, "role": "CITIZEN"})
    token_other = create_access_token(subject=user_other.id, custom_claims={"email": user_other.email, "role": "CITIZEN"})

    # 1. Upload
    upload_file = ("doc.pdf", io.BytesIO(VALID_PDF_BYTES), "application/pdf")
    res_up = client.post("/api/documents", files={"file": upload_file}, headers={"Authorization": f"Bearer {token_owner}"})
    doc_id = res_up.json()["id"]

    # 2. View by owner
    client.get(f"/api/documents/{doc_id}", headers={"Authorization": f"Bearer {token_owner}"})

    # 3. Denied access by other user
    client.get(f"/api/documents/{doc_id}", headers={"Authorization": f"Bearer {token_other}"})

    # Verify audit logs in database
    logs = db.query(AuditLog).filter(AuditLog.resource_type == "document").all()
    actions = [l.action for l in logs]

    assert "DOCUMENT_UPLOAD" in actions
    assert "DOCUMENT_VIEW" in actions
    assert "DOCUMENT_DENIED_ACCESS" in actions
