import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.db.database import SessionLocal, init_db, engine
from app.db.base import Base
from app.core.security import get_password_hash, create_access_token
from app.models.user import User, UserRole
from app.models.provider import Provider, ProviderType, VerificationStatus, AvailabilityStatus
from app.services.provider_service import seed_default_provider_field_definitions


@pytest.fixture(autouse=True)
def setup_database():
    """Re-initialize clean database tables and seed generic field definitions before each test."""
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


def test_provider_profile_get_and_update(client, setup_database):
    """Test retrieving and updating provider profile."""
    db = setup_database

    # Create Provider User
    provider_user = User(
        email="provider_me@example.com",
        password_hash=get_password_hash("Pass123!"),
        role=UserRole.PROVIDER,
    )
    db.add(provider_user)
    db.commit()

    provider = Provider(
        user_id=provider_user.id,
        provider_type=ProviderType.ADVOCATE,
        full_name="Advocate R. Sharma",
    )
    db.add(provider)
    db.commit()

    token = create_access_token(subject=provider_user.id, custom_claims={"email": provider_user.email, "role": "PROVIDER"})
    headers = {"Authorization": f"Bearer {token}"}

    # 1. GET /api/providers/me
    res_get = client.get("/api/providers/me", headers=headers)
    assert res_get.status_code == 200
    data_get = res_get.json()
    assert data_get["full_name"] == "Advocate R. Sharma"
    assert data_get["provider_type"] == "ADVOCATE"
    assert "generic_fields" in data_get

    # 2. PUT /api/providers/me
    update_payload = {
        "full_name": "Advocate R. K. Sharma",
        "phone": "+919876543210",
        "location": "New Delhi, India",
        "experience_years": 12,
        "bio": "Senior Supreme Court Advocate specializing in Constitutional and Commercial litigation.",
        "field_values": [
            {"field_name": "practice_area", "value": "Constitutional & Civil Law"},
            {"field_name": "registration_details", "value": "D/1234/2012"}
        ]
    }
    res_put = client.put("/api/providers/me", json=update_payload, headers=headers)
    assert res_put.status_code == 200
    data_put = res_put.json()
    assert data_put["full_name"] == "Advocate R. K. Sharma"
    assert data_put["experience_years"] == 12
    assert data_put["profile_completion_percentage"] == 100.0
    assert data_put["is_profile_complete"] is True

    # Verify generic field values in output
    field_names = [gf["field_name"] for gf in data_put["generic_fields"]]
    assert "practice_area" in field_names
    assert "registration_details" in field_names


def test_provider_profile_completion_calculation(client, setup_database):
    """Test deterministic profile completion percentage calculation."""
    db = setup_database

    user = User(
        email="completion@example.com",
        password_hash=get_password_hash("Pass123!"),
        role=UserRole.PROVIDER,
    )
    db.add(user)
    db.commit()

    provider = Provider(
        user_id=user.id,
        provider_type=ProviderType.MEDIATOR,
        full_name="Mediator Anita",
    )
    db.add(provider)
    db.commit()

    token = create_access_token(subject=user.id, custom_claims={"email": user.email, "role": "PROVIDER"})
    headers = {"Authorization": f"Bearer {token}"}

    # Initial profile GET (partially filled)
    res1 = client.get("/api/providers/me", headers=headers)
    assert res1.status_code == 200
    pct1 = res1.json()["profile_completion_percentage"]
    assert pct1 < 100.0

    # Populate remaining fields
    client.put("/api/providers/me", json={
        "phone": "+919999988888",
        "location": "Mumbai",
        "experience_years": 6,
        "bio": "Certified commercial dispute mediator.",
        "field_values": [
            {"field_name": "specialization", "value": "Commercial & Family Disputes"}
        ]
    }, headers=headers)

    res2 = client.get("/api/providers/me", headers=headers)
    assert res2.status_code == 200
    assert res2.json()["profile_completion_percentage"] == 100.0
    assert res2.json()["is_profile_complete"] is True


def test_provider_verification_workflow(client, setup_database):
    """Test verification submission (PENDING -> SUBMITTED) and admin review decision (SUBMITTED -> VERIFIED)."""
    db = setup_database

    provider_user = User(email="verify_prov@example.com", password_hash=get_password_hash("Pass123!"), role=UserRole.PROVIDER)
    admin_user = User(email="admin_review@example.com", password_hash=get_password_hash("AdminPass123!"), role=UserRole.ADMIN)
    db.add_all([provider_user, admin_user])
    db.commit()

    provider = Provider(
        user_id=provider_user.id,
        provider_type=ProviderType.NOTARY,
        full_name="Notary Officer Roy",
        verification_status=VerificationStatus.PENDING,
    )
    db.add(provider)
    db.commit()

    prov_token = create_access_token(subject=provider_user.id, custom_claims={"email": provider_user.email, "role": "PROVIDER"})
    admin_token = create_access_token(subject=admin_user.id, custom_claims={"email": admin_user.email, "role": "ADMIN"})

    # 1. Provider submits for verification
    res_submit = client.post("/api/providers/me/verification", headers={"Authorization": f"Bearer {prov_token}"})
    assert res_submit.status_code == 200
    assert res_submit.json()["verification_status"] == "SUBMITTED"

    # 2. Admin approves verification
    res_admin = client.put(
        f"/api/providers/{provider.id}/verify",
        json={"status": "VERIFIED", "notes": "Notary license verified cleanly."},
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert res_admin.status_code == 200
    assert res_admin.json()["verification_status"] == "VERIFIED"


def test_public_provider_discovery(client, setup_database):
    """Test public discovery endpoint returning clean profile data."""
    db = setup_database

    user = User(email="public_prov@example.com", password_hash=get_password_hash("SecretPass123!"), role=UserRole.PROVIDER)
    db.add(user)
    db.commit()

    provider = Provider(
        user_id=user.id,
        provider_type=ProviderType.DOCUMENT_WRITER,
        full_name="Writer Vijay",
        location="Bangalore",
        experience_years=5,
        bio="Specialist in drafting property deeds and agreements.",
        verification_status=VerificationStatus.VERIFIED,
    )
    db.add(provider)
    db.commit()

    # Public discovery (no auth required)
    res = client.get(f"/api/providers/{provider.id}")
    assert res.status_code == 200
    data = res.json()
    assert data["full_name"] == "Writer Vijay"
    assert data["provider_type"] == "DOCUMENT_WRITER"
    assert "password" not in data
    assert "user_id" not in data


def test_unauthorized_provider_modification(client, setup_database):
    """Test that a Citizen or another Provider cannot update a Provider's profile."""
    db = setup_database

    citizen = User(email="citizen_hacker@example.com", password_hash=get_password_hash("Pass123!"), role=UserRole.CITIZEN)
    db.add(citizen)
    db.commit()

    citizen_token = create_access_token(subject=citizen.id, custom_claims={"email": citizen.email, "role": "CITIZEN"})

    # Citizen trying to call provider update route is forbidden
    res = client.put("/api/providers/me", json={"full_name": "Hacked Name"}, headers={"Authorization": f"Bearer {citizen_token}"})
    assert res.status_code == 403
    assert "does not have permission" in res.json()["detail"]
