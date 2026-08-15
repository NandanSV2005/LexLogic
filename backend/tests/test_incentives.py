import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.db.database import SessionLocal, init_db, engine
from app.db.base import Base
from app.core.security import get_password_hash, create_access_token
from app.models.user import User, UserRole
from app.models.provider import Provider, ProviderType, VerificationStatus, AvailabilityStatus
from app.models.points import PointTransaction, PointAction
from app.services.points_service import award_points, sync_provider_total_points, POINT_VALUES
from app.services.reliability_service import calculate_reliability_score
from app.services.provider_service import seed_default_provider_field_definitions


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


def test_point_award_and_transaction_creation(setup_database):
    """Test awarding points creates a PointTransaction log and updates total points."""
    db = setup_database

    user = User(email="points_user@example.com", password_hash=get_password_hash("Pass123!"), role=UserRole.PROVIDER)
    db.add(user)
    db.commit()

    provider = Provider(user_id=user.id, provider_type=ProviderType.ADVOCATE, full_name="Advocate Verma", points=0)
    db.add(provider)
    db.commit()

    # Award points for AVAILABILITY_ADDED (+10)
    tx = award_points(db, provider, PointAction.AVAILABILITY_ADDED)
    assert tx is not None
    assert tx.points == 10
    assert tx.action == PointAction.AVAILABILITY_ADDED
    assert provider.points == 10

    # Award points for SERVICE_COMPLETED (+20)
    tx2 = award_points(db, provider, PointAction.SERVICE_COMPLETED)
    assert tx2 is not None
    assert tx2.points == 20
    assert provider.points == 30

    # Verify transaction count in DB
    count = db.query(PointTransaction).filter(PointTransaction.provider_id == provider.id).count()
    assert count == 2


def test_duplicate_award_prevention(setup_database):
    """Test duplicate award prevention for one-time actions (PROFILE_COMPLETED)."""
    db = setup_database

    user = User(email="dupe_user@example.com", password_hash=get_password_hash("Pass123!"), role=UserRole.PROVIDER)
    db.add(user)
    db.commit()

    provider = Provider(user_id=user.id, provider_type=ProviderType.MEDIATOR, full_name="Mediator Rita", points=0)
    db.add(provider)
    db.commit()

    # First award for PROFILE_COMPLETED (+20)
    tx1 = award_points(db, provider, PointAction.PROFILE_COMPLETED)
    assert tx1 is not None
    assert provider.points == 20

    # Second award for PROFILE_COMPLETED should be prevented
    tx2 = award_points(db, provider, PointAction.PROFILE_COMPLETED)
    assert tx2 is None
    assert provider.points == 20  # Points remain unchanged


def test_total_points_synchronization(setup_database):
    """Test deriving and synchronizing total points from transaction history."""
    db = setup_database

    user = User(email="sync_user@example.com", password_hash=get_password_hash("Pass123!"), role=UserRole.PROVIDER)
    db.add(user)
    db.commit()

    provider = Provider(user_id=user.id, provider_type=ProviderType.NOTARY, full_name="Notary Dave", points=0)
    db.add(provider)
    db.commit()

    award_points(db, provider, PointAction.AVAILABILITY_ADDED)  # +10
    award_points(db, provider, PointAction.REQUEST_RESPONDED)  # +10
    award_points(db, provider, PointAction.SERVICE_COMPLETED)  # +20

    synced_points = sync_provider_total_points(db, provider)
    assert synced_points == 40
    assert provider.points == 40


def test_reliability_calculation_and_normalization(setup_database):
    """Test transparent reliability score calculation and 0-100 normalization."""
    db = setup_database

    user = User(email="rel_user@example.com", password_hash=get_password_hash("Pass123!"), role=UserRole.PROVIDER)
    db.add(user)
    db.commit()

    # Perfect score provider (100% completion, VERIFIED, 100% response, AVAILABLE, 100% completion ratio)
    provider_perfect = Provider(
        user_id=user.id,
        provider_type=ProviderType.ADVOCATE,
        full_name="Perfect Advocate",
        profile_completion_percentage=100.0,
        verification_status=VerificationStatus.VERIFIED,
        response_rate=100.0,
        availability_status=AvailabilityStatus.AVAILABLE,
        completed_requests=10,
        total_requests=10,
    )
    db.add(provider_perfect)
    db.commit()

    score_perfect = calculate_reliability_score(provider_perfect)
    assert score_perfect == 100.0

    # Low score provider (0% completion, PENDING, 0% response, UNAVAILABLE)
    user2 = User(email="low_user@example.com", password_hash=get_password_hash("Pass123!"), role=UserRole.PROVIDER)
    db.add(user2)
    db.commit()

    provider_low = Provider(
        user_id=user2.id,
        provider_type=ProviderType.DOCUMENT_WRITER,
        full_name="New Writer",
        profile_completion_percentage=0.0,
        verification_status=VerificationStatus.PENDING,
        response_rate=0.0,
        availability_status=AvailabilityStatus.UNAVAILABLE,
        completed_requests=0,
        total_requests=0,
    )
    db.add(provider_low)
    db.commit()

    score_low = calculate_reliability_score(provider_low)
    assert 0.0 <= score_low <= 100.0
    assert score_low < score_perfect


def test_provider_dashboard_endpoint(client, setup_database):
    """Test GET /api/providers/me/dashboard returning complete metrics overview."""
    db = setup_database

    user = User(email="dash_user@example.com", password_hash=get_password_hash("Pass123!"), role=UserRole.PROVIDER)
    db.add(user)
    db.commit()

    provider = Provider(
        user_id=user.id,
        provider_type=ProviderType.ARBITRATOR,
        full_name="Arbitrator K. Singh",
        phone="+919876543210",
        location="Chandigarh",
        experience_years=10,
        bio="Experienced commercial arbitrator.",
    )
    db.add(provider)
    db.commit()

    token = create_access_token(subject=user.id, custom_claims={"email": user.email, "role": "PROVIDER"})
    headers = {"Authorization": f"Bearer {token}"}

    res = client.get("/api/providers/me/dashboard", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert data["full_name"] == "Arbitrator K. Singh"
    assert data["provider_type"] == "ARBITRATOR"
    assert "reliability_score" in data
    assert "points" in data
    assert "profile_completion_percentage" in data


def test_provider_points_history_isolation(client, setup_database):
    """Test provider points history endpoints enforce provider isolation."""
    db = setup_database

    user_a = User(email="prov_a@example.com", password_hash=get_password_hash("Pass123!"), role=UserRole.PROVIDER)
    user_b = User(email="prov_b@example.com", password_hash=get_password_hash("Pass123!"), role=UserRole.PROVIDER)
    db.add_all([user_a, user_b])
    db.commit()

    prov_a = Provider(user_id=user_a.id, provider_type=ProviderType.ADVOCATE, full_name="Advocate A")
    prov_b = Provider(user_id=user_b.id, provider_type=ProviderType.MEDIATOR, full_name="Mediator B")
    db.add_all([prov_a, prov_b])
    db.commit()

    # Award points to Provider A
    award_points(db, prov_a, PointAction.AVAILABILITY_ADDED)

    token_a = create_access_token(subject=user_a.id, custom_claims={"email": user_a.email, "role": "PROVIDER"})
    token_b = create_access_token(subject=user_b.id, custom_claims={"email": user_b.email, "role": "PROVIDER"})

    # Provider A gets own history
    res_a = client.get("/api/providers/me/points/history", headers={"Authorization": f"Bearer {token_a}"})
    assert res_a.status_code == 200
    assert len(res_a.json()) == 1

    # Provider B gets own history (empty)
    res_b = client.get("/api/providers/me/points/history", headers={"Authorization": f"Bearer {token_b}"})
    assert res_b.status_code == 200
    assert len(res_b.json()) == 0
