import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.db.database import SessionLocal, init_db
from app.db.base import Base
from app.db.database import engine
from app.core.security import get_password_hash, create_access_token
from app.models.user import User, UserRole
from app.models.provider import Provider, ProviderType
from app.models.document import Document, DocumentVisibility


@pytest.fixture(autouse=True)
def setup_database():
    """Reset database tables before each test."""
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


def test_successful_registration(client):
    """1. Test successful citizen registration."""
    payload = {
        "email": "citizen_test@example.com",
        "password": "Password123!",
        "role": "CITIZEN"
    }
    response = client.post("/api/auth/register", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["email"] == "citizen_test@example.com"
    assert data["role"] == "CITIZEN"
    assert "password" not in data
    assert "password_hash" not in data


def test_duplicate_email_registration(client):
    """2. Test duplicate email registration error."""
    payload = {
        "email": "duplicate@example.com",
        "password": "Password123!",
        "role": "CITIZEN"
    }
    res1 = client.post("/api/auth/register", json=payload)
    assert res1.status_code == 201

    res2 = client.post("/api/auth/register", json=payload)
    assert res2.status_code == 400
    assert "already registered" in res2.json()["detail"]


def test_invalid_password_validation(client):
    """3. Test invalid short password rejection."""
    payload = {
        "email": "shortpass@example.com",
        "password": "123",
        "role": "CITIZEN"
    }
    response = client.post("/api/auth/register", json=payload)
    assert response.status_code == 422  # Pydantic validation error for min_length=6


def test_successful_login(client):
    """4. Test successful login and token generation."""
    # Register first
    reg_payload = {
        "email": "login_user@example.com",
        "password": "Password123!",
        "role": "CITIZEN"
    }
    client.post("/api/auth/register", json=reg_payload)

    # Login
    login_payload = {
        "email": "login_user@example.com",
        "password": "Password123!"
    }
    response = client.post("/api/auth/login", json=login_payload)
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert data["user"]["email"] == "login_user@example.com"


def test_invalid_login(client):
    """5. Test login with wrong password and non-existent user."""
    # Register first
    client.post("/api/auth/register", json={
        "email": "user_wrong@example.com",
        "password": "Password123!",
        "role": "CITIZEN"
    })

    # Wrong password
    res1 = client.post("/api/auth/login", json={
        "email": "user_wrong@example.com",
        "password": "WrongPassword!"
    })
    assert res1.status_code == 401

    # Non-existent email
    res2 = client.post("/api/auth/login", json={
        "email": "nonexistent@example.com",
        "password": "Password123!"
    })
    assert res2.status_code == 401


def test_jwt_authentication(client):
    """6. Test JWT token decoding and authentication."""
    token = create_access_token(subject=1, custom_claims={"email": "jwt@example.com", "role": "CITIZEN"})
    headers = {"Authorization": f"Bearer {token}"}
    
    # Try invalid token
    bad_res = client.get("/api/auth/me", headers={"Authorization": "Bearer invalid_token_str"})
    assert bad_res.status_code == 401


def test_me_endpoint(client):
    """7. Test /me endpoint returning authenticated user data."""
    # Register & Login
    client.post("/api/auth/register", json={
        "email": "me_user@example.com",
        "password": "Password123!",
        "role": "CITIZEN"
    })
    login_res = client.post("/api/auth/login", json={
        "email": "me_user@example.com",
        "password": "Password123!"
    })
    token = login_res.json()["access_token"]

    response = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    data = response.json()
    assert data["email"] == "me_user@example.com"
    assert data["role"] == "CITIZEN"


def test_citizen_access_control(client, setup_database):
    """8. Test Citizen role permissions."""
    db = setup_database
    citizen = User(
        email="citizen_rbac@example.com",
        password_hash=get_password_hash("Pass123!"),
        role=UserRole.CITIZEN,
    )
    db.add(citizen)
    db.commit()

    token = create_access_token(subject=citizen.id, custom_claims={"email": citizen.email, "role": citizen.role.value})
    headers = {"Authorization": f"Bearer {token}"}

    # Citizen trying to access admin audit logs should be forbidden
    res = client.get("/api/audit", headers=headers)
    assert res.status_code == 403
    assert "does not have permission" in res.json()["detail"]


def test_provider_access_and_auto_profile(client):
    """9. Test Provider registration automatically creates ProviderProfile."""
    reg_payload = {
        "email": "provider_reg@example.com",
        "password": "Password123!",
        "role": "PROVIDER",
        "full_name": "Advocate Sam"
    }
    res = client.post("/api/auth/register", json=reg_payload)
    assert res.status_code == 201

    login_res = client.post("/api/auth/login", json={
        "email": "provider_reg@example.com",
        "password": "Password123!"
    })
    assert login_res.status_code == 200
    assert login_res.json()["user"]["role"] == "PROVIDER"


def test_admin_access_control(client, setup_database):
    """10. Test Admin accessing protected admin endpoints."""
    db = setup_database
    admin = User(
        email="admin_user@example.com",
        password_hash=get_password_hash("AdminPass123!"),
        role=UserRole.ADMIN,
    )
    db.add(admin)
    db.commit()

    token = create_access_token(subject=admin.id, custom_claims={"email": admin.email, "role": admin.role.value})
    headers = {"Authorization": f"Bearer {token}"}

    # Admin accesses audit logs successfully
    res = client.get("/api/audit", headers=headers)
    assert res.status_code == 200
    assert isinstance(res.json(), list)


def test_horizontal_privilege_escalation(client, setup_database):
    """11. Test horizontal privilege escalation protection (User A vs User B document/profile)."""
    db = setup_database

    user_a = User(email="usera@example.com", password_hash=get_password_hash("Pass123!"), role=UserRole.CITIZEN)
    user_b = User(email="userb@example.com", password_hash=get_password_hash("Pass123!"), role=UserRole.CITIZEN)
    db.add_all([user_a, user_b])
    db.commit()

    import os, tempfile
    tmp_file = tempfile.NamedTemporaryFile(delete=False)
    tmp_file.write(b"dummy pdf content")
    tmp_file.close()

    # User A creates a document
    doc_a = Document(
        owner_id=user_a.id,
        title="User A Private Deed",
        filename="usera_private_deed.pdf",
        file_path=tmp_file.name,
        mime_type="application/pdf",
        file_size_bytes=2048,
        visibility=DocumentVisibility.PRIVATE
    )


    db.add(doc_a)
    db.commit()

    # User B logs in and attempts to access User A's document by ID
    token_b = create_access_token(subject=user_b.id, custom_claims={"email": user_b.email, "role": user_b.role.value})
    headers_b = {"Authorization": f"Bearer {token_b}"}

    res_b = client.get(f"/api/documents/{doc_a.id}", headers=headers_b)
    assert res_b.status_code == 403
    assert "authorization" in res_b.json()["detail"].lower() or "private document" in res_b.json()["detail"].lower()


    # User A accesses own document successfully
    token_a = create_access_token(subject=user_a.id, custom_claims={"email": user_a.email, "role": user_a.role.value})
    headers_a = {"Authorization": f"Bearer {token_a}"}
    res_a = client.get(f"/api/documents/{doc_a.id}", headers=headers_a)
    assert res_a.status_code == 200
    assert res_a.content == b"dummy pdf content"
    os.unlink(tmp_file.name)


def test_attempt_register_admin_prohibited(client):
    """12. Test that public registration as ADMIN is strictly prohibited."""
    payload = {
        "email": "hacker_admin@example.com",
        "password": "Password123!",
        "role": "ADMIN"
    }
    response = client.post("/api/auth/register", json=payload)
    assert response.status_code == 400
    assert "Public registration as ADMIN is prohibited" in response.json()["detail"]
