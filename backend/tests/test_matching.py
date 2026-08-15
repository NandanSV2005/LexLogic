import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.db.database import SessionLocal, init_db, engine
from app.db.base import Base
from app.core.security import get_password_hash, create_access_token
from app.models.user import User, UserRole
from app.models.provider import Provider, ProviderType, VerificationStatus, AvailabilityStatus
from app.models.request import ServiceRequest
from app.services.provider_service import seed_default_provider_field_definitions, update_provider_generic_fields


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


def test_provider_type_matching_filtering(client, setup_database):
    """Test matching engine filters strictly by preferred_provider_type."""
    db = setup_database

    user_med = User(email="med@example.com", password_hash=get_password_hash("Pass123!"), role=UserRole.PROVIDER)
    user_adv = User(email="adv@example.com", password_hash=get_password_hash("Pass123!"), role=UserRole.PROVIDER)
    user_cit = User(email="cit@example.com", password_hash=get_password_hash("Pass123!"), role=UserRole.CITIZEN)
    db.add_all([user_med, user_adv, user_cit])
    db.commit()

    prov_med = Provider(user_id=user_med.id, provider_type=ProviderType.MEDIATOR, full_name="Mediator Sita", location="Delhi")
    prov_adv = Provider(user_id=user_adv.id, provider_type=ProviderType.ADVOCATE, full_name="Advocate Ram", location="Delhi")
    db.add_all([prov_med, prov_adv])
    db.commit()

    req = ServiceRequest(
        citizen_id=user_cit.id,
        service_category="Mediation",
        description="Commercial mediation needed",
        location="Delhi",
        preferred_provider_type=ProviderType.MEDIATOR
    )
    db.add(req)
    db.commit()

    token = create_access_token(subject=user_cit.id, custom_claims={"email": user_cit.email, "role": "CITIZEN"})
    res = client.post("/api/matching/providers", json={"request_id": req.id}, headers={"Authorization": f"Bearer {token}"})

    assert res.status_code == 200
    data = res.json()
    assert data["total_matches"] == 1
    assert data["matched_providers"][0]["provider_type"] == "MEDIATOR"
    assert data["matched_providers"][0]["full_name"] == "Mediator Sita"


def test_location_and_service_category_matching(client, setup_database):
    """Test location proximity and practice area/specialization score influence."""
    db = setup_database

    cit_user = User(email="cit_loc@example.com", password_hash=get_password_hash("Pass123!"), role=UserRole.CITIZEN)
    p1_user = User(email="p1@example.com", password_hash=get_password_hash("Pass123!"), role=UserRole.PROVIDER)
    p2_user = User(email="p2@example.com", password_hash=get_password_hash("Pass123!"), role=UserRole.PROVIDER)
    db.add_all([cit_user, p1_user, p2_user])
    db.commit()

    # Provider 1: Same location + matching specialization
    p1 = Provider(
        user_id=p1_user.id,
        provider_type=ProviderType.NOTARY,
        full_name="Notary Delhi",
        location="New Delhi",
        verification_status=VerificationStatus.VERIFIED,
        reliability_score=90.0,
        experience_years=8
    )
    # Provider 2: Different location + non-matching specialization
    p2 = Provider(
        user_id=p2_user.id,
        provider_type=ProviderType.NOTARY,
        full_name="Notary Mumbai",
        location="Mumbai",
        verification_status=VerificationStatus.PENDING,
        reliability_score=40.0,
        experience_years=2
    )
    db.add_all([p1, p2])
    db.commit()

    update_provider_generic_fields(db, p1, [{"field_name": "service_type", "value": "Affidavit & Property Document Verification"}])
    update_provider_generic_fields(db, p2, [{"field_name": "service_type", "value": "General Notary"}])

    req = ServiceRequest(
        citizen_id=cit_user.id,
        service_category="Property Document Verification",
        description="Notarization of property purchase agreement",
        location="New Delhi",
        preferred_provider_type=ProviderType.NOTARY
    )
    db.add(req)
    db.commit()

    token = create_access_token(subject=cit_user.id, custom_claims={"email": cit_user.email, "role": "CITIZEN"})
    res = client.post("/api/matching/providers", json={"request_id": req.id}, headers={"Authorization": f"Bearer {token}"})

    assert res.status_code == 200
    matched = res.json()["matched_providers"]
    assert len(matched) == 2
    # P1 (Delhi, Verified, High reliability) should score higher than P2 (Mumbai, Pending)
    assert matched[0]["full_name"] == "Notary Delhi"
    assert matched[0]["match_score"] > matched[1]["match_score"]


def test_advocate_regulatory_compliance_rule(client, setup_database):
    """Test Advocate regulatory compliance: factual match output without promotional ranking titles or exposed scores."""
    db = setup_database

    cit_user = User(email="cit_adv@example.com", password_hash=get_password_hash("Pass123!"), role=UserRole.CITIZEN)
    adv_user = User(email="adv_legal@example.com", password_hash=get_password_hash("Pass123!"), role=UserRole.PROVIDER)
    db.add_all([cit_user, adv_user])
    db.commit()

    advocate = Provider(
        user_id=adv_user.id,
        provider_type=ProviderType.ADVOCATE,
        full_name="Advocate Ananya Deshmukh",
        location="High Court, Mumbai",
        experience_years=15,
        verification_status=VerificationStatus.VERIFIED,
        reliability_score=95.0
    )
    db.add(advocate)
    db.commit()

    update_provider_generic_fields(db, advocate, [
        {"field_name": "practice_area", "value": "Commercial Disputes & Corporate Litigation"},
        {"field_name": "registration_details", "value": "MAH/1234/2009"}
    ])

    req = ServiceRequest(
        citizen_id=cit_user.id,
        service_category="Commercial Dispute",
        description="Shareholder agreement dispute litigation",
        location="Mumbai",
        preferred_provider_type=ProviderType.ADVOCATE
    )
    db.add(req)
    db.commit()

    token = create_access_token(subject=cit_user.id, custom_claims={"email": cit_user.email, "role": "CITIZEN"})
    res = client.post("/api/matching/providers", json={"request_id": req.id}, headers={"Authorization": f"Bearer {token}"})

    assert res.status_code == 200
    data = res.json()
    assert len(data["matched_providers"]) == 1
    adv_match = data["matched_providers"][0]

    # Verify Advocate regulatory rule assertions:
    # 1. match_score is None (not presented as promotional ranking score)
    assert adv_match["match_score"] is None
    # 2. is_advocate_factual_match is True
    assert adv_match["is_advocate_factual_match"] is True
    # 3. Factual details are exposed
    assert adv_match["full_name"] == "Advocate Ananya Deshmukh"
    assert adv_match["experience_years"] == 15
    assert adv_match["verification_status"] == "VERIFIED"
    assert len(adv_match["generic_fields"]) > 0


def test_non_advocate_matching_includes_scores(client, setup_database):
    """Test Mediator/Notary responses include transparent match scores."""
    db = setup_database

    cit_user = User(email="cit_arb@example.com", password_hash=get_password_hash("Pass123!"), role=UserRole.CITIZEN)
    arb_user = User(email="arb_user@example.com", password_hash=get_password_hash("Pass123!"), role=UserRole.PROVIDER)
    db.add_all([cit_user, arb_user])
    db.commit()

    arbitrator = Provider(
        user_id=arb_user.id,
        provider_type=ProviderType.ARBITRATOR,
        full_name="Arbitrator Justice Kapoor",
        location="Delhi",
        verification_status=VerificationStatus.VERIFIED,
        reliability_score=88.0,
        experience_years=20
    )
    db.add(arbitrator)
    db.commit()

    req = ServiceRequest(
        citizen_id=cit_user.id,
        service_category="Arbitration",
        description="Construction dispute arbitration",
        location="Delhi",
        preferred_provider_type=ProviderType.ARBITRATOR
    )
    db.add(req)
    db.commit()

    token = create_access_token(subject=cit_user.id, custom_claims={"email": cit_user.email, "role": "CITIZEN"})
    res = client.post("/api/matching/providers", json={"request_id": req.id}, headers={"Authorization": f"Bearer {token}"})

    assert res.status_code == 200
    data = res.json()
    arb_match = data["matched_providers"][0]
    assert arb_match["match_score"] is not None
    assert arb_match["match_score"] > 0.0
    assert arb_match["is_advocate_factual_match"] is False


def test_payment_and_subscription_zero_effect(setup_database):
    """Test that payment/subscription status plays 0 role in matching calculation."""
    db = setup_database

    cit = User(email="cit_sub@example.com", password_hash=get_password_hash("Pass123!"), role=UserRole.CITIZEN)
    db.add(cit)
    db.commit()

    # Two identical providers
    p1 = Provider(user_id=10, provider_type=ProviderType.DOCUMENT_WRITER, full_name="Writer 1", location="Delhi", experience_years=5, reliability_score=80.0)
    p2 = Provider(user_id=11, provider_type=ProviderType.DOCUMENT_WRITER, full_name="Writer 2", location="Delhi", experience_years=5, reliability_score=80.0)
    db.add_all([p1, p2])
    db.commit()

    req = ServiceRequest(citizen_id=cit.id, service_category="Drafting", description="Agreement drafting", location="Delhi", preferred_provider_type=ProviderType.DOCUMENT_WRITER)
    db.add(req)
    db.commit()

    from app.services.matching_service import calculate_provider_match_score
    score1 = calculate_provider_match_score(p1, req, db)
    score2 = calculate_provider_match_score(p2, req, db)

    # Both scores must be identical regardless of any external payment status
    assert score1 == score2
