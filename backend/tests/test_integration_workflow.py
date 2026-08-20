import io
import pytest
from fastapi.testclient import TestClient
from app.db.database import SessionLocal, init_db, engine
from app.db.base import Base
from app.core.security import get_password_hash, create_access_token
from app.models.user import User, UserRole
from app.models.provider import Provider, ProviderType, VerificationStatus, AvailabilityStatus
from app.models.request import ServiceRequest, RequestStatus
from app.models.audit import AuditLog
from app.models.verification import ProviderVerificationRecord, AdvocateVerificationProfile, AdvocateCaseReference, ProviderVerificationHistory
from app.main import app
from app.services.provider_service import seed_default_provider_field_definitions

VALID_PDF_BYTES = b"%PDF-1.4 sample title deed content for e2e test..."


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


def test_e2e_provider_onboarding_and_dashboard_workflow(client, setup_database):
    """E2E Test: Full 12-Step Provider Onboarding, Completion Points, Verification & Dashboard Workflow."""
    db = setup_database

    # 1. Provider Registers
    reg_res = client.post("/api/auth/register", json={
        "email": "e2e_advocate@lexlogic.org",
        "password": "Password123!",
        "role": "PROVIDER",
        "full_name": "Advocate Vikramaditya Singh"
    })
    assert reg_res.status_code == 201

    # 2. Provider Logs In
    login_res = client.post("/api/auth/login", json={
        "email": "e2e_advocate@lexlogic.org",
        "password": "Password123!"
    })
    assert login_res.status_code == 200
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 3 & 4. Get profile (profile was instantiated on registration)
    me_res = client.get("/api/providers/me", headers=headers)
    assert me_res.status_code == 200
    profile_data = me_res.json()
    assert profile_data["provider_type"] == "ADVOCATE"

    # 5 & 6. Fill provider-specific fields & base attributes (Hits 100% completion)
    update_res = client.put("/api/providers/me", json={
        "phone": "+919811223344",
        "location": "High Court, New Delhi",
        "experience_years": 18,
        "bio": "Senior Advocate specializing in constitutional law and complex property litigation.",
        "availability_status": "AVAILABLE",
        "field_values": [
            {"field_name": "practice_area", "value": "Constitutional & Property Disputes"},
            {"field_name": "registration_details", "value": "D/4321/2006"}
        ]
    }, headers=headers)

    assert update_res.status_code == 200
    updated_data = update_res.json()
    
    # Submit Advocate Bar Verification (Completes Advocate Professional Registration check)
    verif_res = client.post("/api/providers/verification/advocate/submit", json={
        "state_bar_council": "Bar Council of Delhi",
        "enrollment_number": "D/4321/2006",
        "enrollment_year": 2006
    }, headers=headers)
    assert verif_res.status_code == 200

    # Check me profile after verification submission
    me_after = client.get("/api/providers/me", headers=headers)
    assert me_after.json()["profile_completion_percentage"] == 100.0
    assert me_after.json()["is_profile_complete"] is True

    # 7. Verify profile-completion & availability update points (+20 profile + 10 availability = 30 points)
    pts_res = client.get("/api/providers/me/points", headers=headers)
    assert pts_res.status_code == 200
    assert pts_res.json()["total_points"] == 30


    # 8. Provider submits verification
    ver_res = client.post("/api/providers/me/verification", headers=headers)
    assert ver_res.status_code == 200
    assert ver_res.json()["verification_status"] == "SUBMITTED"

    # 9, 10 & 11. Admin verifies provider & reliability is calculated
    admin = User(email="admin_e2e@lexlogic.org", password_hash=get_password_hash("AdminPass123!"), role=UserRole.ADMIN)
    db.add(admin)
    db.commit()

    admin_token = create_access_token(subject=admin.id, custom_claims={"email": admin.email, "role": "ADMIN"})
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    prov_id = updated_data["id"]
    admin_ver_res = client.put(f"/api/providers/{prov_id}/verify", json={"status": "VERIFIED", "notes": "Bar Council verified"}, headers=admin_headers)
    assert admin_ver_res.status_code == 200
    assert admin_ver_res.json()["verification_status"] == "VERIFIED"

    # 12. Provider Dashboard Returns Correct Metrics
    dash_res = client.get("/api/providers/me/dashboard", headers=headers)
    assert dash_res.status_code == 200
    dash_data = dash_res.json()
    assert dash_data["full_name"] == "Advocate Vikramaditya Singh"
    assert dash_data["is_profile_complete"] is True
    assert dash_data["points"] == 30
    assert dash_data["verification_status"] == "VERIFIED"

    assert dash_data["availability_status"] == "AVAILABLE"
    assert dash_data["reliability_score"] > 80.0


def test_e2e_citizen_request_matching_completion_incentives(client, setup_database):
    """E2E Test: Citizen Request Creation, Provider Matching Engine, Response, Completion & Points Workflow."""
    db = setup_database

    # 1 & 2. Citizen Registers & Logs In
    client.post("/api/auth/register", json={"email": "e2e_cit@lexlogic.org", "password": "Password123!", "role": "CITIZEN", "full_name": "Citizen Sunita"})
    login_cit = client.post("/api/auth/login", json={"email": "e2e_cit@lexlogic.org", "password": "Password123!"})
    cit_token = login_cit.json()["access_token"]
    cit_headers = {"Authorization": f"Bearer {cit_token}"}

    # Register Advocate Provider
    client.post("/api/auth/register", json={"email": "e2e_adv2@lexlogic.org", "password": "Password123!", "role": "PROVIDER", "full_name": "Advocate Rajesh Sharma"})
    login_adv = client.post("/api/auth/login", json={"email": "e2e_adv2@lexlogic.org", "password": "Password123!"})
    adv_token = login_adv.json()["access_token"]
    adv_headers = {"Authorization": f"Bearer {adv_token}"}

    # Setup Advocate profile
    client.put("/api/providers/me", json={
        "phone": "+919876543210",
        "location": "New Delhi",
        "experience_years": 12,
        "bio": "Property litigation advocate.",
        "field_values": [
            {"field_name": "practice_area", "value": "Property & Boundary Litigation"},
            {"field_name": "registration_details", "value": "D/9988/2010"}
        ]
    }, headers=adv_headers)

    client.post("/api/providers/verification/advocate/submit", json={
        "state_bar_council": "Bar Council of Delhi",
        "enrollment_number": "D/9988/2010",
        "enrollment_year": 2010
    }, headers=adv_headers)

    # Admin approves advocate verification (Phase 5 requirement for matching eligibility)
    admin_u = User(email="admin_e2e@lexlogic.org", password_hash=get_password_hash("Pass123!"), role=UserRole.ADMIN)
    db.add(admin_u)
    db.commit()
    admin_token = create_access_token(subject=admin_u.id, custom_claims={"email": admin_u.email, "role": "ADMIN"})
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    prov_id = client.get("/api/providers/me", headers=adv_headers).json()["id"]
    client.put(f"/api/providers/{prov_id}/verify", json={"status": "VERIFIED", "notes": "Verified Bar license"}, headers=admin_headers)

    # 3 & 4. Citizen describes legal need & creates request
    req_res = client.post("/api/requests", json={
        "service_category": "Property dispute",
        "description": "Boundary wall encroachment dispute with adjacent land owner.",
        "location": "New Delhi",
        "preferred_provider_type": "ADVOCATE",
        "urgency": "HIGH",
        "legal_aid_interest": True
    }, headers=cit_headers)

    assert req_res.status_code == 201
    req_id = req_res.json()["id"]

    # 5 & 6 & 7. Matching Engine finds suitable providers (Advocate factual match)
    match_res = client.post("/api/matching/providers", json={"request_id": req_id}, headers=cit_headers)
    assert match_res.status_code == 200
    match_data = match_res.json()
    assert match_data["total_matches"] == 1
    adv_match = match_data["matched_providers"][0]
    # Verify Advocate regulatory rule assertions: match_score is None, is_advocate_factual_match is True
    assert adv_match["match_score"] is None
    assert adv_match["is_advocate_factual_match"] is True

    # 8, 9 & 10. Provider views eligible requests & responds
    elig_res = client.get("/api/requests/eligible", headers=adv_headers)
    assert elig_res.status_code == 200
    assert len(elig_res.json()) == 1

    resp_res = client.post(f"/api/requests/{req_id}/respond", headers=adv_headers)
    assert resp_res.status_code == 200
    assert resp_res.json()["status"] == "CONTACTED"

    # 11, 12 & 13. Service is completed -> Points & Reliability updated
    comp_res = client.post(f"/api/requests/{req_id}/complete", headers=adv_headers)
    assert comp_res.status_code == 200
    assert comp_res.json()["status"] == "COMPLETED"

    # Check points: 20 (profile completion) + 10 (respond) + 20 (complete) + 30 (pro bono) = 80 points!
    pts_res = client.get("/api/providers/me/points", headers=adv_headers)
    assert pts_res.status_code == 200
    assert pts_res.json()["total_points"] == 80


def test_e2e_document_security_share_revoke_audit_workflow(client, setup_database):
    """E2E Test: Secure Document Upload, Access Control, Explicit Share, Revocation, and Audit Trail."""
    db = setup_database

    # Setup Citizen A, Citizen B, and Provider A
    client.post("/api/auth/register", json={"email": "cit_a_e2e@lexlogic.org", "password": "Password123!", "role": "CITIZEN"})
    login_a = client.post("/api/auth/login", json={"email": "cit_a_e2e@lexlogic.org", "password": "Password123!"})
    token_a = login_a.json()["access_token"]
    headers_a = {"Authorization": f"Bearer {token_a}"}

    client.post("/api/auth/register", json={"email": "cit_b_e2e@lexlogic.org", "password": "Password123!", "role": "CITIZEN"})
    login_b = client.post("/api/auth/login", json={"email": "cit_b_e2e@lexlogic.org", "password": "Password123!"})
    token_b = login_b.json()["access_token"]
    headers_b = {"Authorization": f"Bearer {token_b}"}

    client.post("/api/auth/register", json={"email": "prov_a_e2e@lexlogic.org", "password": "Password123!", "role": "PROVIDER"})
    login_p = client.post("/api/auth/login", json={"email": "prov_a_e2e@lexlogic.org", "password": "Password123!"})
    token_p = login_p.json()["access_token"]
    headers_p = {"Authorization": f"Bearer {token_p}"}

    p_me = client.get("/api/providers/me", headers=headers_p)
    prov_a_id = p_me.json()["id"]

    # 1 & 2. Citizen A uploads private document & accesses it
    upload_file = ("title_deed.pdf", io.BytesIO(VALID_PDF_BYTES), "application/pdf")
    res_up = client.post("/api/documents", files={"file": upload_file}, data={"title": "Land Deed"}, headers=headers_a)
    assert res_up.status_code == 201
    doc_id = res_up.json()["id"]

    res_owner_view = client.get(f"/api/documents/{doc_id}", headers=headers_a)
    assert res_owner_view.status_code == 200

    # 3 & 4. Citizen B & Provider A initial access attempts -> 403 Forbidden
    res_b_view = client.get(f"/api/documents/{doc_id}", headers=headers_b)
    assert res_b_view.status_code == 403

    res_p_init_view = client.get(f"/api/documents/{doc_id}", headers=headers_p)
    assert res_p_init_view.status_code == 403

    # 5 & 6. Citizen A explicitly shares document with Provider A -> Provider A accesses successfully (200 OK)
    res_share = client.post(f"/api/documents/{doc_id}/share", json={"provider_id": prov_a_id}, headers=headers_a)
    assert res_share.status_code == 200

    res_p_view = client.get(f"/api/documents/{doc_id}", headers=headers_p)
    assert res_p_view.status_code == 200
    assert res_p_view.content == VALID_PDF_BYTES

    # 7 & 8. Citizen A revokes access -> Provider A receives 403 Forbidden
    res_revoke = client.post(f"/api/documents/{doc_id}/revoke", json={"provider_id": prov_a_id}, headers=headers_a)
    assert res_revoke.status_code == 200

    res_p_rev_view = client.get(f"/api/documents/{doc_id}", headers=headers_p)
    assert res_p_rev_view.status_code == 403

    # 9. Audit events exist in database
    audit_logs = db.query(AuditLog).filter(AuditLog.resource_id == doc_id).all()
    actions = [l.action for l in audit_logs]
    assert "DOCUMENT_UPLOAD" in actions
    assert "DOCUMENT_VIEW" in actions
    assert "DOCUMENT_SHARE" in actions
    assert "DOCUMENT_REVOKE" in actions
    assert "DOCUMENT_DENIED_ACCESS" in actions


def test_e2e_security_boundaries_and_rbac_enforcement(client, setup_database):
    """E2E Test: Security boundaries preventing Citizens/Providers from modifying others or accessing Admin APIs."""
    db = setup_database

    client.post("/api/auth/register", json={"email": "cit_sec@lexlogic.org", "password": "Password123!", "role": "CITIZEN"})
    login_cit = client.post("/api/auth/login", json={"email": "cit_sec@lexlogic.org", "password": "Password123!"})
    cit_token = login_cit.json()["access_token"]
    cit_headers = {"Authorization": f"Bearer {cit_token}"}

    client.post("/api/auth/register", json={"email": "prov_sec@lexlogic.org", "password": "Password123!", "role": "PROVIDER"})
    login_prov = client.post("/api/auth/login", json={"email": "prov_sec@lexlogic.org", "password": "Password123!"})
    prov_token = login_prov.json()["access_token"]
    prov_headers = {"Authorization": f"Bearer {prov_token}"}

    # 1. Citizen cannot access Admin audit logs endpoint -> 403
    res_cit_aud = client.get("/api/audit", headers=cit_headers)
    assert res_cit_aud.status_code == 403

    # 2. Provider cannot access Admin audit logs endpoint -> 403
    res_prov_aud = client.get("/api/audit", headers=prov_headers)
    assert res_prov_aud.status_code == 403

    # 3. Provider cannot modify admin verification decision -> 403
    res_prov_ver = client.put("/api/providers/1/verify", json={"status": "VERIFIED"}, headers=prov_headers)
    assert res_prov_ver.status_code == 403

    # 4. Citizen cannot create provider profile -> 403
    res_cit_prof = client.post("/api/providers/profile", json={"provider_type": "ADVOCATE", "full_name": "Fake Advocate", "phone": "123", "location": "Loc", "experience_years": 5}, headers=cit_headers)
    assert res_cit_prof.status_code == 403
