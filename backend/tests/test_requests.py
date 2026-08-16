import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.db.database import SessionLocal, init_db, engine
from app.db.base import Base
from app.core.security import get_password_hash, create_access_token
from app.models.user import User, UserRole
from app.models.provider import Provider, ProviderType
from app.models.request import ServiceRequest, RequestStatus
from app.models.points import PointTransaction, PointAction
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


def test_citizen_request_creation(client, setup_database):
    """Test citizen service request creation and citizen_id binding."""
    db = setup_database

    citizen = User(email="citizen_req@example.com", password_hash=get_password_hash("Pass123!"), role=UserRole.CITIZEN)
    db.add(citizen)
    db.commit()

    token = create_access_token(subject=citizen.id, custom_claims={"email": citizen.email, "role": "CITIZEN"})
    headers = {"Authorization": f"Bearer {token}"}

    payload = {
        "service_category": "Property Dispute",
        "description": "Neighbor encroaching on property boundary.",
        "location": "New Delhi",
        "preferred_provider_type": "ADVOCATE",
        "urgency": "HIGH",
        "legal_aid_interest": False
    }

    res = client.post("/api/requests", json=payload, headers=headers)
    assert res.status_code == 201
    data = res.json()
    assert data["citizen_id"] == citizen.id
    assert data["service_category"] == "Property Dispute"
    assert data["status"] == "OPEN"
    assert data["urgency"] == "HIGH"


def test_citizen_request_ownership_and_retrieval(client, setup_database):
    """Test GET /api/requests/me returns only current citizen's requests."""
    db = setup_database

    citizen_a = User(email="citizen_a@example.com", password_hash=get_password_hash("Pass123!"), role=UserRole.CITIZEN)
    citizen_b = User(email="citizen_b@example.com", password_hash=get_password_hash("Pass123!"), role=UserRole.CITIZEN)
    db.add_all([citizen_a, citizen_b])
    db.commit()

    # Citizen A request
    req_a = ServiceRequest(
        citizen_id=citizen_a.id,
        service_category="Notary Service",
        description="Affidavit notarization",
        location="Delhi",
        preferred_provider_type=ProviderType.NOTARY
    )
    # Citizen B request
    req_b = ServiceRequest(
        citizen_id=citizen_b.id,
        service_category="Document Preparation",
        description="Will drafting",
        location="Mumbai",
        preferred_provider_type=ProviderType.DOCUMENT_WRITER
    )
    db.add_all([req_a, req_b])
    db.commit()

    token_a = create_access_token(subject=citizen_a.id, custom_claims={"email": citizen_a.email, "role": "CITIZEN"})
    token_b = create_access_token(subject=citizen_b.id, custom_claims={"email": citizen_b.email, "role": "CITIZEN"})

    # Citizen A retrieves own requests
    res_a = client.get("/api/requests/me", headers={"Authorization": f"Bearer {token_a}"})
    assert res_a.status_code == 200
    assert len(res_a.json()) == 1
    assert res_a.json()[0]["service_category"] == "Notary Service"

    # Citizen B attempts to get Citizen A's request by ID (horizontal privilege escalation check)
    res_esc = client.get(f"/api/requests/{req_a.id}", headers={"Authorization": f"Bearer {token_b}"})
    assert res_esc.status_code == 403
    assert "do not have permission" in res_esc.json()["detail"]


def test_provider_eligible_requests_and_response(client, setup_database):
    """Test provider listing eligible requests and responding (+10 points award)."""
    db = setup_database

    citizen = User(email="citizen_pub@example.com", password_hash=get_password_hash("Pass123!"), role=UserRole.CITIZEN)
    prov_user = User(email="prov_mediator@example.com", password_hash=get_password_hash("Pass123!"), role=UserRole.PROVIDER)
    db.add_all([citizen, prov_user])
    db.commit()

    provider = Provider(
        user_id=prov_user.id,
        provider_type=ProviderType.MEDIATOR,
        full_name="Mediator Rita",
        phone="+919876543210",
        location="Bangalore",
        experience_years=8,
        bio="Experienced mediator specializing in commercial disputes."
    )
    db.add(provider)
    db.commit()
    from app.services.provider_service import update_provider_generic_fields
    update_provider_generic_fields(db, provider, [{"field_name": "specialization", "value": "Commercial Dispute Mediation"}])

    # Create request matching MEDIATOR
    req = ServiceRequest(
        citizen_id=citizen.id,
        service_category="Mediation",
        description="Commercial dispute mediation needed.",
        location="Bangalore",
        preferred_provider_type=ProviderType.MEDIATOR
    )
    db.add(req)
    db.commit()

    prov_token = create_access_token(subject=prov_user.id, custom_claims={"email": prov_user.email, "role": "PROVIDER"})
    headers = {"Authorization": f"Bearer {prov_token}"}

    # 1. Provider views eligible requests
    res_elig = client.get("/api/requests/eligible", headers=headers)
    assert res_elig.status_code == 200
    assert len(res_elig.json()) == 1
    assert res_elig.json()[0]["id"] == req.id

    # 2. Provider responds to request
    res_resp = client.post(f"/api/requests/{req.id}/respond", headers=headers)
    assert res_resp.status_code == 200
    assert res_resp.json()["status"] == "CONTACTED"

    # Verify provider points (+20 profile completed + 10 REQUEST_RESPONDED = 30 points)
    db.refresh(provider)
    assert provider.points == 30
    assert provider.total_requests == 1


def test_request_completion_workflow_and_points(client, setup_database):
    """Test full request completion, completed_requests increment, SERVICE_COMPLETED (+20 pts) award, and reliability update."""
    db = setup_database

    citizen = User(email="cit_comp@example.com", password_hash=get_password_hash("Pass123!"), role=UserRole.CITIZEN)
    prov_user = User(email="prov_writer@example.com", password_hash=get_password_hash("Pass123!"), role=UserRole.PROVIDER)
    db.add_all([citizen, prov_user])
    db.commit()

    provider = Provider(
        user_id=prov_user.id,
        provider_type=ProviderType.DOCUMENT_WRITER,
        full_name="Writer Vijay",
        phone="+919876543211",
        location="Hyderabad",
        experience_years=10,
        bio="Legal document writer.",
        completed_requests=0,
        points=0
    )
    db.add(provider)
    db.commit()
    from app.services.provider_service import update_provider_generic_fields
    update_provider_generic_fields(db, provider, [{"field_name": "document_types", "value": "Property Sale Deeds, Contracts"}])

    req = ServiceRequest(
        citizen_id=citizen.id,
        service_category="Document Preparation",
        description="Property sale deed drafting",
        location="Hyderabad",
        preferred_provider_type=ProviderType.DOCUMENT_WRITER,
        legal_aid_interest=False
    )
    db.add(req)
    db.commit()

    prov_token = create_access_token(subject=prov_user.id, custom_claims={"email": prov_user.email, "role": "PROVIDER"})
    headers = {"Authorization": f"Bearer {prov_token}"}

    # Respond first
    client.post(f"/api/requests/{req.id}/respond", headers=headers)

    # Complete request
    res_comp = client.post(f"/api/requests/{req.id}/complete", headers=headers)
    assert res_comp.status_code == 200
    assert res_comp.json()["status"] == "COMPLETED"

    # Verify provider stats
    db.refresh(provider)
    assert provider.completed_requests == 1
    # Points: 20 (profile completion) + 10 (respond) + 20 (complete) = 50 points
    assert provider.points == 50
    assert provider.reliability_score > 0.0


def test_legal_aid_interest_flag_and_pro_bono_points(client, setup_database):
    """Test request with legal_aid_interest=True triggers ELIGIBLE_PRO_BONO (+30 pts) bonus reward on completion."""
    db = setup_database

    citizen = User(email="cit_aid@example.com", password_hash=get_password_hash("Pass123!"), role=UserRole.CITIZEN)
    prov_user = User(email="prov_probono@example.com", password_hash=get_password_hash("Pass123!"), role=UserRole.PROVIDER)
    db.add_all([citizen, prov_user])
    db.commit()

    provider = Provider(
        user_id=prov_user.id,
        provider_type=ProviderType.ADVOCATE,
        full_name="Advocate Roy",
        phone="+919876543212",
        location="Kolkata",
        experience_years=12,
        bio="High court advocate.",
        points=0
    )
    db.add(provider)
    db.commit()
    from app.services.provider_service import update_provider_generic_fields
    update_provider_generic_fields(db, provider, [
        {"field_name": "practice_area", "value": "Tenant Eviction Defense"},
        {"field_name": "registration_details", "value": "WB/1234/2012"}
    ])

    # Request flagged for legal aid interest
    req = ServiceRequest(
        citizen_id=citizen.id,
        service_category="Legal Aid Inquiry",
        description="Need pro-bono assistance for tenant eviction defense.",
        location="Kolkata",
        preferred_provider_type=ProviderType.ADVOCATE,
        legal_aid_interest=True
    )
    db.add(req)
    db.commit()

    prov_token = create_access_token(subject=prov_user.id, custom_claims={"email": prov_user.email, "role": "PROVIDER"})
    headers = {"Authorization": f"Bearer {prov_token}"}

    # Respond & Complete
    client.post(f"/api/requests/{req.id}/respond", headers=headers)
    client.post(f"/api/requests/{req.id}/complete", headers=headers)

    # Verify points: 20 (profile completion) + 10 (respond) + 20 (complete) + 30 (pro bono) = 80 points!
    db.refresh(provider)
    assert provider.points == 80

    # Verify legal aid listing endpoint
    res_aid = client.get("/api/requests/legal-aid", headers=headers)
    assert res_aid.status_code == 200
    assert len(res_aid.json()) == 1
    assert res_aid.json()[0]["legal_aid_interest"] is True


def test_request_status_cancellation_by_citizen(client, setup_database):
    """Test citizen owner cancelling a service request."""
    db = setup_database

    citizen = User(email="cancel_cit@example.com", password_hash=get_password_hash("Pass123!"), role=UserRole.CITIZEN)
    db.add(citizen)
    db.commit()

    req = ServiceRequest(
        citizen_id=citizen.id,
        service_category="Commercial Dispute",
        description="Drafting contract clause",
        location="Chennai",
        preferred_provider_type=ProviderType.ARBITRATOR
    )
    db.add(req)
    db.commit()

    token = create_access_token(subject=citizen.id, custom_claims={"email": citizen.email, "role": "CITIZEN"})

    res_cancel = client.put(
        f"/api/requests/{req.id}/status",
        json={"status": "CANCELLED"},
        headers={"Authorization": f"Bearer {token}"}
    )
    assert res_cancel.status_code == 200
    assert res_cancel.json()["status"] == "CANCELLED"
