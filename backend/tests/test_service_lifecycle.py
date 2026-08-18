import io
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.db.database import SessionLocal, engine
from app.db.base import Base
from app.core.security import get_password_hash, create_access_token
from app.models.user import User, UserRole
from app.models.provider import Provider, ProviderType, VerificationStatus, AvailabilityStatus
from app.models.request import ServiceRequest, RequestStatus, RequestProvider, InteractionStatus
from app.models.document import Document, DocumentShare, DocumentSharePermission, DocumentShareStatus, DocumentVisibility
from app.models.audit import AuditLog
from app.services.provider_service import seed_default_provider_field_definitions

VALID_PDF_BYTES = b"%PDF-1.4 test deed content for post-match service lifecycle..."


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


def test_complete_post_match_service_lifecycle_and_single_active_provider(client, setup_database):
    """E2E Test: Full post-match service lifecycle:
    Citizen creates request -> Provider A & Provider B express interest ->
    Citizen accepts Provider A -> Provider B interest becomes DECLINED ->
    Provider A requests completion -> Citizen confirms completion -> Points awarded & audit logged.
    """
    db = setup_database

    # 1. Setup Citizen
    citizen_res = client.post("/api/auth/register", json={
        "email": "citizen_e2e@lexlogic.org",
        "password": "Password123!",
        "role": "CITIZEN",
        "full_name": "Citizen Ramesh Kumar"
    })
    assert citizen_res.status_code == 201
    citizen_token = client.post("/api/auth/login", json={"email": "citizen_e2e@lexlogic.org", "password": "Password123!"}).json()["access_token"]
    citizen_headers = {"Authorization": f"Bearer {citizen_token}"}

    # 2. Setup Provider A (Advocate)
    p1_res = client.post("/api/auth/register", json={
        "email": "advocate_a@lexlogic.org",
        "password": "Password123!",
        "role": "PROVIDER",
        "full_name": "Advocate Ananya Sharma"
    })
    assert p1_res.status_code == 201
    p1_token = client.post("/api/auth/login", json={"email": "advocate_a@lexlogic.org", "password": "Password123!"}).json()["access_token"]
    p1_headers = {"Authorization": f"Bearer {p1_token}"}

    # Complete Provider A profile (includes required registration_details & practice_area)
    up1 = client.put("/api/providers/me", json={
        "full_name": "Advocate Ananya Sharma",
        "phone": "+919811000001",
        "location": "Mumbai",
        "experience_years": 10,
        "bio": "Expert Advocate specializing in civil and property litigation.",
        "availability_status": "AVAILABLE",
        "field_values": [
            {"field_name": "practice_area", "value": "Civil Disputes"},
            {"field_name": "registration_details", "value": "MAH/1234/2015"}
        ]
    }, headers=p1_headers)
    assert up1.status_code == 200
    assert up1.json()["is_profile_complete"] is True

    # 3. Setup Provider B (Advocate)
    p2_res = client.post("/api/auth/register", json={
        "email": "advocate_b@lexlogic.org",
        "password": "Password123!",
        "role": "PROVIDER",
        "full_name": "Advocate Baldev Raj"
    })
    assert p2_res.status_code == 201
    p2_token = client.post("/api/auth/login", json={"email": "advocate_b@lexlogic.org", "password": "Password123!"}).json()["access_token"]
    p2_headers = {"Authorization": f"Bearer {p2_token}"}

    up2 = client.put("/api/providers/me", json={
        "full_name": "Advocate Baldev Raj",
        "phone": "+919811000002",
        "location": "Mumbai",
        "experience_years": 12,
        "bio": "Experienced Advocate specializing in civil property litigation.",
        "availability_status": "AVAILABLE",
        "field_values": [
            {"field_name": "practice_area", "value": "Civil Disputes"},
            {"field_name": "registration_details", "value": "MAH/5678/2012"}
        ]
    }, headers=p2_headers)
    assert up2.status_code == 200
    assert up2.json()["is_profile_complete"] is True

    # 4. Citizen creates service request
    req_res = client.post("/api/requests", json={
        "service_category": "Property Law",
        "description": "Property title deed verification for flat in Bandra Mumbai.",
        "location": "Mumbai",
        "preferred_provider_type": "ADVOCATE",
        "urgency": "HIGH",
        "legal_aid_interest": True
    }, headers=citizen_headers)
    assert req_res.status_code == 201
    req_data = req_res.json()
    req_id = req_data["id"]
    assert req_data["status"] == "OPEN"

    # 5. Provider A expresses interest
    p1_resp = client.post(f"/api/requests/{req_id}/respond", headers=p1_headers)
    assert p1_resp.status_code == 200
    assert p1_resp.json()["status"] in ("CONTACTED", "PENDING")

    # 6. Provider B expresses interest
    p2_resp = client.post(f"/api/requests/{req_id}/respond", headers=p2_headers)
    assert p2_resp.status_code == 200

    # Verify duplicate interest by Provider A returns 400 Bad Request
    p1_dup = client.post(f"/api/requests/{req_id}/respond", headers=p1_headers)
    assert p1_dup.status_code == 400

    # 7. Citizen checks interested providers list
    interested_res = client.get(f"/api/requests/{req_id}/interested-providers", headers=citizen_headers)
    assert interested_res.status_code == 200
    providers_list = interested_res.json()
    assert len(providers_list) == 2

    provider_a_id = [p["provider_id"] for p in providers_list if p["full_name"] == "Advocate Ananya Sharma"][0]
    provider_b_id = [p["provider_id"] for p in providers_list if p["full_name"] == "Advocate Baldev Raj"][0]

    # 8. Citizen accepts Provider A
    accept_res = client.post(f"/api/requests/{req_id}/accept-provider/{provider_a_id}", headers=citizen_headers)
    assert accept_res.status_code == 200
    updated_req = accept_res.json()
    assert updated_req["status"] == "IN_PROGRESS"
    assert updated_req["accepted_provider_id"] == provider_a_id

    # 9. Verify Single Active Provider Constraint: Provider B interaction is now DECLINED
    interested_after_accept = client.get(f"/api/requests/{req_id}/interested-providers", headers=citizen_headers).json()
    p_b_status = [p["interaction_status"] for p in interested_after_accept if p["provider_id"] == provider_b_id][0]
    assert p_b_status == "DECLINED"

    # 10. Provider B tries to request completion (IDOR Protection -> 403 Forbidden)
    p2_comp_try = client.post(f"/api/requests/{req_id}/request-completion", headers=p2_headers)
    assert p2_comp_try.status_code == 403

    # 11. Provider A requests completion (IN_PROGRESS -> COMPLETION_REQUESTED)
    p1_req_comp = client.post(f"/api/requests/{req_id}/request-completion", headers=p1_headers)
    assert p1_req_comp.status_code == 200
    assert p1_req_comp.json()["status"] == "COMPLETION_REQUESTED"

    # Verify Provider A points before citizen confirmation (+20 profile + 10 availability + 10 response = 40 points)
    pts_before = client.get("/api/providers/me/points", headers=p1_headers).json()["total_points"]
    assert pts_before == 40

    # 12. Unrelated Citizen tries to confirm completion (IDOR Protection -> 403 Forbidden)
    unrelated_citizen = client.post("/api/auth/register", json={
        "email": "unrelated_citizen@lexlogic.org",
        "password": "Password123!",
        "role": "CITIZEN",
        "full_name": "Unrelated Citizen"
    })
    unrelated_token = client.post("/api/auth/login", json={"email": "unrelated_citizen@lexlogic.org", "password": "Password123!"}).json()["access_token"]
    unrelated_headers = {"Authorization": f"Bearer {unrelated_token}"}

    bad_confirm = client.post(f"/api/requests/{req_id}/confirm-completion", headers=unrelated_headers)
    assert bad_confirm.status_code == 403

    # 13. Citizen confirms completion (COMPLETION_REQUESTED -> COMPLETED)
    confirm_res = client.post(f"/api/requests/{req_id}/confirm-completion", headers=citizen_headers)
    assert confirm_res.status_code == 200
    assert confirm_res.json()["status"] == "COMPLETED"

    # 14. Verify Provider A received completion points (+20 standard + 30 pro-bono legal aid = +50 points added, total 90 points)
    pts_after = client.get("/api/providers/me/points", headers=p1_headers).json()["total_points"]
    assert pts_after == 90

    # 15. Verify Audit Trail entries logged
    audits = db.query(AuditLog).filter(AuditLog.resource_id == req_id).all()
    actions = [a.action for a in audits]
    assert "SERVICE_REQUEST_CREATE" in actions
    assert "PROVIDER_REQUEST_RESPOND" in actions
    assert "CITIZEN_ACCEPT_PROVIDER" in actions
    assert "PROVIDER_REQUEST_COMPLETION" in actions
    assert "SERVICE_REQUEST_COMPLETE" in actions


def test_document_permission_isolation_and_revocation(client, setup_database):
    """Test explicit document permission security:
    Connecting Citizen and Provider does NOT automatically share documents.
    Citizen explicitly shares document with VIEW permission.
    Provider view is allowed, but download is blocked for VIEW permission.
    When Citizen revokes access, Provider view/download returns 403 Forbidden.
    """
    db = setup_database

    # Citizen & Provider setup
    c_res = client.post("/api/auth/register", json={
        "email": "doc_citizen@lexlogic.org", "password": "Password123!", "role": "CITIZEN", "full_name": "Doc Citizen"
    })
    c_token = client.post("/api/auth/login", json={"email": "doc_citizen@lexlogic.org", "password": "Password123!"}).json()["access_token"]
    c_headers = {"Authorization": f"Bearer {c_token}"}

    p_res = client.post("/api/auth/register", json={
        "email": "doc_advocate@lexlogic.org", "password": "Password123!", "role": "PROVIDER", "full_name": "Doc Advocate"
    })
    p_token = client.post("/api/auth/login", json={"email": "doc_advocate@lexlogic.org", "password": "Password123!"}).json()["access_token"]
    p_headers = {"Authorization": f"Bearer {p_token}"}

    # Upload document
    pdf_file = ("property_deed.pdf", io.BytesIO(VALID_PDF_BYTES), "application/pdf")
    upload_res = client.post("/api/documents/upload", files={"file": pdf_file}, data={"title": "Property Deed Title"}, headers=c_headers)
    assert upload_res.status_code == 201
    doc_id = upload_res.json()["id"]

    p_me = client.get("/api/providers/me", headers=p_headers).json()
    provider_id = p_me["id"]

    # Before explicit share: Provider cannot access document
    unshared_view = client.get(f"/api/documents/{doc_id}", headers=p_headers)
    assert unshared_view.status_code == 403

    # Citizen shares with VIEW permission (using provider_id schema field)
    share_res = client.post(f"/api/documents/{doc_id}/share", json={
        "provider_id": provider_id,
        "permission": "VIEW"
    }, headers=c_headers)
    assert share_res.status_code == 200

    # Provider views metadata/stream (Allowed for VIEW permission)
    prov_view = client.get(f"/api/documents/{doc_id}?download=false", headers=p_headers)
    assert prov_view.status_code == 200

    # Provider tries to download file content (Blocked for VIEW permission -> 403 Forbidden)
    prov_dl = client.get(f"/api/documents/{doc_id}?download=true", headers=p_headers)
    assert prov_dl.status_code == 403

    # Citizen upgrades share permission to VIEW_AND_DOWNLOAD
    upgrade_share = client.post(f"/api/documents/{doc_id}/share", json={
        "provider_id": provider_id,
        "permission": "VIEW_AND_DOWNLOAD"
    }, headers=c_headers)
    assert upgrade_share.status_code == 200

    # Now Provider download succeeds
    prov_dl_success = client.get(f"/api/documents/{doc_id}?download=true", headers=p_headers)
    assert prov_dl_success.status_code == 200
    assert prov_dl_success.content == VALID_PDF_BYTES

    # Citizen revokes access
    revoke_res = client.post(f"/api/documents/{doc_id}/revoke", json={"provider_id": provider_id}, headers=c_headers)
    assert revoke_res.status_code == 200

    # Now Provider access is revoked (403 Forbidden)
    revoked_view = client.get(f"/api/documents/{doc_id}", headers=p_headers)
    assert revoked_view.status_code == 403
