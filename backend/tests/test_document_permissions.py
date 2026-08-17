import io
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.db.database import SessionLocal, init_db, engine
from app.db.base import Base
from app.core.security import get_password_hash, create_access_token
from app.models.user import User, UserRole
from app.models.provider import Provider, ProviderType
from app.models.document import Document, DocumentVisibility, DocumentShare, DocumentShareStatus, DocumentSharePermission
from app.services.provider_service import seed_default_provider_field_definitions
from app.core.rate_limiter import auth_rate_limiter, upload_rate_limiter

VALID_PDF_BYTES = b"%PDF-1.4 binary content for test pdf file header..."


@pytest.fixture(autouse=True)
def setup_database():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    auth_rate_limiter.reset()
    upload_rate_limiter.reset()

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


def test_doc_perm_1_provider_cannot_access_private_document(client, setup_database):
    db = setup_database
    cit = User(email="cit_priv@sec.com", password_hash=get_password_hash("Pass1!"), role=UserRole.CITIZEN)
    prov_u = User(email="prov_priv@sec.com", password_hash=get_password_hash("Pass1!"), role=UserRole.PROVIDER)
    db.add_all([cit, prov_u])
    db.commit()

    prov = Provider(user_id=prov_u.id, provider_type=ProviderType.ADVOCATE, full_name="Advocate Priv")
    db.add(prov)
    db.commit()

    token_cit = create_access_token(subject=cit.id, custom_claims={"email": cit.email, "role": "CITIZEN"})
    token_prov = create_access_token(subject=prov_u.id, custom_claims={"email": prov_u.email, "role": "PROVIDER"})

    res_up = client.post("/api/documents", files={"file": ("priv.pdf", io.BytesIO(VALID_PDF_BYTES), "application/pdf")}, headers={"Authorization": f"Bearer {token_cit}"})
    doc_id = res_up.json()["id"]

    res_view = client.get(f"/api/documents/{doc_id}", headers={"Authorization": f"Bearer {token_prov}"})
    assert res_view.status_code == 403


def test_doc_perm_2_provider_with_view_permission_can_view_but_not_download(client, setup_database):
    db = setup_database
    cit = User(email="cit_vw@sec.com", password_hash=get_password_hash("Pass1!"), role=UserRole.CITIZEN)
    prov_u = User(email="prov_vw@sec.com", password_hash=get_password_hash("Pass1!"), role=UserRole.PROVIDER)
    db.add_all([cit, prov_u])
    db.commit()

    prov = Provider(user_id=prov_u.id, provider_type=ProviderType.ADVOCATE, full_name="Advocate Vw")
    db.add(prov)
    db.commit()

    token_cit = create_access_token(subject=cit.id, custom_claims={"email": cit.email, "role": "CITIZEN"})
    token_prov = create_access_token(subject=prov_u.id, custom_claims={"email": prov_u.email, "role": "PROVIDER"})

    res_up = client.post("/api/documents", files={"file": ("vw.pdf", io.BytesIO(VALID_PDF_BYTES), "application/pdf")}, headers={"Authorization": f"Bearer {token_cit}"})
    doc_id = res_up.json()["id"]

    # Share with VIEW permission (default)
    res_share = client.post(f"/api/documents/{doc_id}/share", json={"provider_id": prov.id, "permission": "VIEW"}, headers={"Authorization": f"Bearer {token_cit}"})
    assert res_share.status_code == 200
    assert res_share.json()["permission"] == "VIEW"

    # View (download=false) -> 200 OK
    res_view = client.get(f"/api/documents/{doc_id}?download=false", headers={"Authorization": f"Bearer {token_prov}"})
    assert res_view.status_code == 200
    assert "inline" in res_view.headers.get("content-disposition", "")

    # Download (download=true) -> 403 Forbidden: Download permission required
    res_down = client.get(f"/api/documents/{doc_id}?download=true", headers={"Authorization": f"Bearer {token_prov}"})
    assert res_down.status_code == 403
    assert "download access permission required" in res_down.json()["detail"].lower()


def test_doc_perm_3_provider_with_view_and_download_permission_can_download(client, setup_database):
    db = setup_database
    cit = User(email="cit_dl@sec.com", password_hash=get_password_hash("Pass1!"), role=UserRole.CITIZEN)
    prov_u = User(email="prov_dl@sec.com", password_hash=get_password_hash("Pass1!"), role=UserRole.PROVIDER)
    db.add_all([cit, prov_u])
    db.commit()

    prov = Provider(user_id=prov_u.id, provider_type=ProviderType.ADVOCATE, full_name="Advocate Dl")
    db.add(prov)
    db.commit()

    token_cit = create_access_token(subject=cit.id, custom_claims={"email": cit.email, "role": "CITIZEN"})
    token_prov = create_access_token(subject=prov_u.id, custom_claims={"email": prov_u.email, "role": "PROVIDER"})

    res_up = client.post("/api/documents", files={"file": ("dl.pdf", io.BytesIO(VALID_PDF_BYTES), "application/pdf")}, headers={"Authorization": f"Bearer {token_cit}"})
    doc_id = res_up.json()["id"]

    # Share with VIEW_AND_DOWNLOAD permission
    res_share = client.post(f"/api/documents/{doc_id}/share", json={"provider_id": prov.id, "permission": "VIEW_AND_DOWNLOAD"}, headers={"Authorization": f"Bearer {token_cit}"})
    assert res_share.status_code == 200
    assert res_share.json()["permission"] == "VIEW_AND_DOWNLOAD"

    # Download (download=true) -> 200 OK
    res_down = client.get(f"/api/documents/{doc_id}?download=true", headers={"Authorization": f"Bearer {token_prov}"})
    assert res_down.status_code == 200
    assert "attachment" in res_down.headers.get("content-disposition", "")


def test_doc_perm_4_citizen_revocation_immediately_blocks_access(client, setup_database):
    db = setup_database
    cit = User(email="cit_rvk@sec.com", password_hash=get_password_hash("Pass1!"), role=UserRole.CITIZEN)
    prov_u = User(email="prov_rvk@sec.com", password_hash=get_password_hash("Pass1!"), role=UserRole.PROVIDER)
    db.add_all([cit, prov_u])
    db.commit()

    prov = Provider(user_id=prov_u.id, provider_type=ProviderType.ADVOCATE, full_name="Advocate Rvk")
    db.add(prov)
    db.commit()

    token_cit = create_access_token(subject=cit.id, custom_claims={"email": cit.email, "role": "CITIZEN"})
    token_prov = create_access_token(subject=prov_u.id, custom_claims={"email": prov_u.email, "role": "PROVIDER"})

    res_up = client.post("/api/documents", files={"file": ("rvk.pdf", io.BytesIO(VALID_PDF_BYTES), "application/pdf")}, headers={"Authorization": f"Bearer {token_cit}"})
    doc_id = res_up.json()["id"]

    # Share VIEW_AND_DOWNLOAD
    client.post(f"/api/documents/{doc_id}/share", json={"provider_id": prov.id, "permission": "VIEW_AND_DOWNLOAD"}, headers={"Authorization": f"Bearer {token_cit}"})

    # Access initially allowed
    assert client.get(f"/api/documents/{doc_id}?download=true", headers={"Authorization": f"Bearer {token_prov}"}).status_code == 200

    # Citizen revokes
    res_rev = client.post(f"/api/documents/{doc_id}/revoke", json={"provider_id": prov.id}, headers={"Authorization": f"Bearer {token_cit}"})
    assert res_rev.status_code == 200

    # Provider access immediately blocked
    assert client.get(f"/api/documents/{doc_id}", headers={"Authorization": f"Bearer {token_prov}"}).status_code == 403


def test_doc_perm_5_provider_cannot_create_self_share_grant(client, setup_database):
    db = setup_database
    cit = User(email="cit_self@sec.com", password_hash=get_password_hash("Pass1!"), role=UserRole.CITIZEN)
    prov_u = User(email="prov_self@sec.com", password_hash=get_password_hash("Pass1!"), role=UserRole.PROVIDER)
    db.add_all([cit, prov_u])
    db.commit()

    prov = Provider(user_id=prov_u.id, provider_type=ProviderType.ADVOCATE, full_name="Advocate Self")
    db.add(prov)
    db.commit()

    token_cit = create_access_token(subject=cit.id, custom_claims={"email": cit.email, "role": "CITIZEN"})
    token_prov = create_access_token(subject=prov_u.id, custom_claims={"email": prov_u.email, "role": "PROVIDER"})

    res_up = client.post("/api/documents", files={"file": ("self.pdf", io.BytesIO(VALID_PDF_BYTES), "application/pdf")}, headers={"Authorization": f"Bearer {token_cit}"})
    doc_id = res_up.json()["id"]

    # Provider attempts to share document owned by Citizen -> 403 Forbidden
    res_self = client.post(f"/api/documents/{doc_id}/share", json={"provider_id": prov.id, "permission": "VIEW_AND_DOWNLOAD"}, headers={"Authorization": f"Bearer {token_prov}"})
    assert res_self.status_code == 403
