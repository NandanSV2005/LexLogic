import pytest
from datetime import datetime, timezone, timedelta
from app.main import app
from app.db.database import SessionLocal, engine
from app.db.base import Base
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


def get_citizen_auth(client):
    client.post("/api/auth/register", json={
        "email": "citizen_perf@lexlogic.org",
        "password": "Password123!",
        "role": "CITIZEN",
        "full_name": "Citizen Performance Tester"
    })
    token = client.post("/api/auth/login", json={"email": "citizen_perf@lexlogic.org", "password": "Password123!"}).json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def get_provider_auth(client):
    client.post("/api/auth/register", json={
        "email": "provider_perf@lexlogic.org",
        "password": "Password123!",
        "role": "PROVIDER",
        "full_name": "Advocate Perf Tester"
    })
    token = client.post("/api/auth/login", json={"email": "provider_perf@lexlogic.org", "password": "Password123!"}).json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    client.put("/api/providers/me", json={
        "full_name": "Advocate Perf Tester",
        "phone": "+919811000099",
        "location": "Bangalore",
        "experience_years": 8,
        "bio": "Expert in property and civil disputes.",
        "availability_status": "AVAILABLE",
        "field_values": [
            {"field_name": "practice_area", "value": "Property Disputes"},
            {"field_name": "registration_details", "value": "KAR/9999/2016"}
        ]
    }, headers=headers)

    # Approve provider verification for matching eligibility in tests
    db = SessionLocal()
    from app.models.provider import Provider, VerificationStatus
    p = db.query(Provider).first()
    if p:
        p.verification_status = VerificationStatus.VERIFIED
        db.commit()
    db.close()

    return headers


def test_ai_legal_need_navigator(client, setup_database):
    """Test 1: AI Legal Need Navigator returns category, provider type, and disclaimer."""
    citizen_headers = get_citizen_auth(client)
    payload = {
        "description": "My landlord is threatening to evict me and hasn't returned my security deposit for flat #12"
    }
    response = client.post("/api/navigator/classify", json=payload, headers=citizen_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["service_category"] == "Property / Tenancy Dispute"
    assert data["preferred_provider_type"] == "ADVOCATE"
    assert "not legal advice" in data["disclaimer"].lower()


def test_case_workspace_and_timeline(client, setup_database):
    """Test 2: Case Workspace summary returns request info, timeline, and recommended next action."""
    citizen_headers = get_citizen_auth(client)
    provider_headers = get_provider_auth(client)

    # 1. Citizen creates request
    req_payload = {
        "service_category": "Property Dispute",
        "description": "Eviction issue under landlord dispute",
        "location": "Bangalore",
        "preferred_provider_type": "ADVOCATE"
    }
    create_res = client.post("/api/requests", json=req_payload, headers=citizen_headers)
    assert create_res.status_code == 201
    req_id = create_res.json()["id"]

    # 2. Provider expresses interest
    client.post(f"/api/requests/{req_id}/respond", json={"action": "CONTACT"}, headers=provider_headers)

    # 3. Fetch Case Workspace
    ws_res = client.get(f"/api/requests/{req_id}/workspace", headers=citizen_headers)
    assert ws_res.status_code == 200
    ws_data = ws_res.json()
    assert ws_data["request"]["id"] == req_id
    assert len(ws_data["timeline"]) >= 2
    assert ws_data["next_action"]["action_key"] == "ACCEPT_PROVIDER"


def test_privacy_center_summary(client, setup_database):
    """Test 3: Privacy Center returns explicit document share grants and revocation statuses."""
    citizen_headers = get_citizen_auth(client)
    provider_headers = get_provider_auth(client)

    # Fetch provider ID
    p_me = client.get("/api/providers/me", headers=provider_headers).json()
    prov_id = p_me["id"]

    # 1. Citizen creates request & uploads doc
    create_res = client.post("/api/requests", json={
        "service_category": "Document Drafting",
        "description": "Draft tenancy agreement",
        "location": "Delhi",
        "preferred_provider_type": "ADVOCATE"
    }, headers=citizen_headers)
    req_id = create_res.json()["id"]

    upload_res = client.post(
        "/api/documents",
        data={"title": "Draft Agreement"},
        files={"file": ("draft.pdf", b"%PDF-1.4 test content", "application/pdf")},
        headers=citizen_headers
    )
    doc_id = upload_res.json()["id"]

    # 2. Share with provider
    client.post(f"/api/documents/{doc_id}/share", json={
        "provider_id": prov_id,
        "permission": "VIEW"
    }, headers=citizen_headers)

    # 3. Fetch Privacy Summary
    priv_res = client.get(f"/api/documents/privacy-summary/{req_id}", headers=citizen_headers)
    assert priv_res.status_code == 200
    priv_data = priv_res.json()
    assert len(priv_data["items"]) >= 1
    item = [i for i in priv_data["items"] if i["document_id"] == doc_id][0]
    assert item["permission"] == "VIEW"


def test_smart_document_intelligence(client, setup_database):
    """Test 4: Explicit document intelligence extraction and caching."""
    citizen_headers = get_citizen_auth(client)

    # Upload document
    upload_res = client.post(
        "/api/documents",
        data={"title": "Rent Agreement 2025"},
        files={"file": ("rent_agreement.pdf", b"%PDF-1.4 rent agreement dummy content", "application/pdf")},
        headers=citizen_headers
    )
    doc_id = upload_res.json()["id"]

    # Trigger explicit analysis
    analyze_res = client.post(f"/api/documents/{doc_id}/analyze", headers=citizen_headers)
    assert analyze_res.status_code == 200
    data = analyze_res.json()
    assert data["document_type"] == "Rent & Tenancy Agreement"
    assert "Landlord (Lessor)" in data["parties"]
    assert "not legal advice" in data["disclaimer"].lower()

    # Second call returns cached result
    cached_res = client.post(f"/api/documents/{doc_id}/analyze", headers=citizen_headers)
    assert cached_res.status_code == 200
    assert cached_res.json() == data


def test_lightweight_service_scheduling(client, setup_database):
    """Test 5: Lightweight appointment slot scheduling between connected parties."""
    citizen_headers = get_citizen_auth(client)
    provider_headers = get_provider_auth(client)

    p_me = client.get("/api/providers/me", headers=provider_headers).json()
    prov_id = p_me["id"]

    # 1. Create request & accept provider
    create_res = client.post("/api/requests", json={
        "service_category": "Property Dispute",
        "description": "Boundary dispute consultation",
        "location": "Mumbai",
        "preferred_provider_type": "ADVOCATE"
    }, headers=citizen_headers)
    req_id = create_res.json()["id"]

    client.post(f"/api/requests/{req_id}/respond", json={"action": "CONTACT"}, headers=provider_headers)
    client.post(f"/api/requests/{req_id}/accept-provider/{prov_id}", headers=citizen_headers)

    # 2. Schedule appointment
    slot_time = (datetime.now(timezone.utc) + timedelta(days=2)).isoformat()
    appt_res = client.post(f"/api/requests/{req_id}/appointments", json={
        "slot_datetime": slot_time,
        "purpose": "Initial Representation Strategy Discussion"
    }, headers=citizen_headers)
    assert appt_res.status_code == 201
    assert appt_res.json()["status"] == "SCHEDULED"

    # 3. List appointments
    list_res = client.get(f"/api/requests/{req_id}/appointments", headers=citizen_headers)
    assert list_res.status_code == 200
    assert len(list_res.json()) == 1


def test_matching_score_explainability(client, setup_database):
    """Test 6: Provider matching includes score factors and non-commercial matching criteria."""
    citizen_headers = get_citizen_auth(client)
    provider_headers = get_provider_auth(client)

    create_res = client.post("/api/requests", json={
        "service_category": "Property Disputes",
        "description": "Need advocate for land dispute",
        "location": "Bangalore",
        "preferred_provider_type": "ADVOCATE"
    }, headers=citizen_headers)
    req_id = create_res.json()["id"]

    match_res = client.post("/api/matching/providers", json={"request_id": req_id}, headers=citizen_headers)
    assert match_res.status_code == 200
    data = match_res.json()
    assert "matched_providers" in data
    assert len(data["matched_providers"]) >= 1
    first_prov = data["matched_providers"][0]
    assert "is_advocate_factual_match" in first_prov
