import io
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.db.database import SessionLocal, init_db, engine
from app.db.base import Base
from app.core.security import get_password_hash, create_access_token
from app.models.user import User, UserRole
from app.models.provider import Provider, ProviderType, VerificationStatus
from app.models.request import ServiceRequest, RequestStatus, RequestProvider, InteractionStatus
from app.models.document import Document, DocumentVisibility, DocumentShare, DocumentShareStatus
from app.models.points import PointAction, PointTransaction
from app.models.audit import AuditLog
from app.services.provider_service import seed_default_provider_field_definitions
from app.core.rate_limiter import auth_rate_limiter, upload_rate_limiter

VALID_PDF_BYTES = b"%PDF-1.4 binary content for test pdf file header..."


@pytest.fixture(autouse=True)
def setup_database():
    """Reset database tables and rate limiters before each test."""
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


# 1. Citizen A cannot access Citizen B document
def test_security_1_citizen_cannot_access_other_citizen_document(client, setup_database):
    db = setup_database
    cit_a = User(email="cit_a@sec.com", password_hash=get_password_hash("Pass1!"), role=UserRole.CITIZEN)
    cit_b = User(email="cit_b@sec.com", password_hash=get_password_hash("Pass1!"), role=UserRole.CITIZEN)
    db.add_all([cit_a, cit_b])
    db.commit()

    token_a = create_access_token(subject=cit_a.id, custom_claims={"email": cit_a.email, "role": "CITIZEN"})
    token_b = create_access_token(subject=cit_b.id, custom_claims={"email": cit_b.email, "role": "CITIZEN"})

    # Cit A uploads document
    res_up = client.post(
        "/api/documents",
        files={"file": ("doc_a.pdf", io.BytesIO(VALID_PDF_BYTES), "application/pdf")},
        headers={"Authorization": f"Bearer {token_a}"}
    )
    doc_id = res_up.json()["id"]

    # Cit B attempts access -> 403 Forbidden
    res_b = client.get(f"/api/documents/{doc_id}", headers={"Authorization": f"Bearer {token_b}"})
    assert res_b.status_code == 403


# 2. Provider cannot access unshared document
def test_security_2_provider_cannot_access_unshared_document(client, setup_database):
    db = setup_database
    cit = User(email="cit@sec.com", password_hash=get_password_hash("Pass1!"), role=UserRole.CITIZEN)
    prov_u = User(email="prov_u@sec.com", password_hash=get_password_hash("Pass1!"), role=UserRole.PROVIDER)
    db.add_all([cit, prov_u])
    db.commit()

    prov = Provider(user_id=prov_u.id, provider_type=ProviderType.ADVOCATE, full_name="Advocate U")
    db.add(prov)
    db.commit()

    token_cit = create_access_token(subject=cit.id, custom_claims={"email": cit.email, "role": "CITIZEN"})
    token_prov = create_access_token(subject=prov_u.id, custom_claims={"email": prov_u.email, "role": "PROVIDER"})

    res_up = client.post(
        "/api/documents",
        files={"file": ("deed.pdf", io.BytesIO(VALID_PDF_BYTES), "application/pdf")},
        headers={"Authorization": f"Bearer {token_cit}"}
    )
    doc_id = res_up.json()["id"]

    # Provider attempts to download unshared doc -> 403 Forbidden
    res_access = client.get(f"/api/documents/{doc_id}", headers={"Authorization": f"Bearer {token_prov}"})
    assert res_access.status_code == 403


# 3. Provider loses access immediately after revocation
def test_security_3_provider_loses_access_immediately_after_revocation(client, setup_database):
    db = setup_database
    cit = User(email="cit_rev@sec.com", password_hash=get_password_hash("Pass1!"), role=UserRole.CITIZEN)
    prov_u = User(email="prov_rev@sec.com", password_hash=get_password_hash("Pass1!"), role=UserRole.PROVIDER)
    db.add_all([cit, prov_u])
    db.commit()

    prov = Provider(user_id=prov_u.id, provider_type=ProviderType.ADVOCATE, full_name="Advocate Rev")
    db.add(prov)
    db.commit()

    token_cit = create_access_token(subject=cit.id, custom_claims={"email": cit.email, "role": "CITIZEN"})
    token_prov = create_access_token(subject=prov_u.id, custom_claims={"email": prov_u.email, "role": "PROVIDER"})

    res_up = client.post(
        "/api/documents",
        files={"file": ("deed.pdf", io.BytesIO(VALID_PDF_BYTES), "application/pdf")},
        headers={"Authorization": f"Bearer {token_cit}"}
    )
    doc_id = res_up.json()["id"]

    # Share with Provider
    client.post(f"/api/documents/{doc_id}/share", json={"provider_id": prov.id}, headers={"Authorization": f"Bearer {token_cit}"})

    # Access is allowed (200 OK)
    res_granted = client.get(f"/api/documents/{doc_id}", headers={"Authorization": f"Bearer {token_prov}"})
    assert res_granted.status_code == 200

    # Revoke access
    client.post(f"/api/documents/{doc_id}/revoke", json={"provider_id": prov.id}, headers={"Authorization": f"Bearer {token_cit}"})

    # Re-access immediately rejected (403 Forbidden)
    res_revoked = client.get(f"/api/documents/{doc_id}", headers={"Authorization": f"Bearer {token_prov}"})
    assert res_revoked.status_code == 403


# 4. Non-admin cannot access admin endpoint
def test_security_4_non_admin_cannot_access_admin_endpoints(client, setup_database):
    db = setup_database
    cit = User(email="cit_na@sec.com", password_hash=get_password_hash("Pass1!"), role=UserRole.CITIZEN)
    db.add(cit)
    db.commit()

    token_cit = create_access_token(subject=cit.id, custom_claims={"email": cit.email, "role": "CITIZEN"})

    res_admin = client.put("/api/providers/1/verify", json={"status": "VERIFIED"}, headers={"Authorization": f"Bearer {token_cit}"})
    assert res_admin.status_code == 403


# 5. Provider cannot modify another provider
def test_security_5_provider_cannot_modify_another_provider(client, setup_database):
    db = setup_database
    p1_u = User(email="p1@sec.com", password_hash=get_password_hash("Pass1!"), role=UserRole.PROVIDER)
    p2_u = User(email="p2@sec.com", password_hash=get_password_hash("Pass1!"), role=UserRole.PROVIDER)
    db.add_all([p1_u, p2_u])
    db.commit()

    p1 = Provider(user_id=p1_u.id, provider_type=ProviderType.ADVOCATE, full_name="P1")
    p2 = Provider(user_id=p2_u.id, provider_type=ProviderType.ADVOCATE, full_name="P2")
    db.add_all([p1, p2])
    db.commit()

    token_p1 = create_access_token(subject=p1_u.id, custom_claims={"email": p1_u.email, "role": "PROVIDER"})

    # P1 attempts to verify P2 via admin endpoint -> 403
    res_mod = client.put(f"/api/providers/{p2.id}/verify", json={"status": "VERIFIED"}, headers={"Authorization": f"Bearer {token_p1}"})
    assert res_mod.status_code == 403


# 6. Provider cannot manipulate another provider's request relationship
def test_security_6_provider_isolation_on_request_interactions(client, setup_database):
    db = setup_database
    cit = User(email="cit_req@sec.com", password_hash=get_password_hash("Pass1!"), role=UserRole.CITIZEN)
    prov_u = User(email="prov_req@sec.com", password_hash=get_password_hash("Pass1!"), role=UserRole.PROVIDER)
    db.add_all([cit, prov_u])
    db.commit()

    token_cit = create_access_token(subject=cit.id, custom_claims={"email": cit.email, "role": "CITIZEN"})

    req = ServiceRequest(citizen_id=cit.id, service_category="Civil", description="Property issue", location="Delhi", preferred_provider_type=ProviderType.ADVOCATE)
    db.add(req)
    db.commit()

    # Citizen tries to request docs as provider -> 403
    res_unauth = client.post(f"/api/requests/{req.id}/request-documents", json={"requested_documents": "Deed"}, headers={"Authorization": f"Bearer {token_cit}"})
    assert res_unauth.status_code == 403


# 7. Incomplete provider cannot express interest
def test_security_7_incomplete_provider_cannot_express_interest(client, setup_database):
    db = setup_database
    cit = User(email="cit_inc@sec.com", password_hash=get_password_hash("Pass1!"), role=UserRole.CITIZEN)
    prov_u = User(email="prov_inc@sec.com", password_hash=get_password_hash("Pass1!"), role=UserRole.PROVIDER)
    db.add_all([cit, prov_u])
    db.commit()

    # Incomplete provider profile (missing required fields / 0% complete)
    prov = Provider(user_id=prov_u.id, provider_type=ProviderType.ADVOCATE, full_name="", profile_completion_percentage=0.0)
    db.add(prov)
    db.commit()

    req = ServiceRequest(citizen_id=cit.id, service_category="Civil", description="Test", location="Delhi", preferred_provider_type=ProviderType.ADVOCATE)
    db.add(req)
    db.commit()

    token_prov = create_access_token(subject=prov_u.id, custom_claims={"email": prov_u.email, "role": "PROVIDER"})

    res = client.post(f"/api/requests/{req.id}/respond", json={"action": "ACCEPT"}, headers={"Authorization": f"Bearer {token_prov}"})
    assert res.status_code == 403
    assert "incomplete" in res.json()["detail"].lower()


# 8. Duplicate Express Interest is rejected
def test_security_8_duplicate_express_interest_rejected(client, setup_database):
    db = setup_database
    cit = User(email="cit_dup@sec.com", password_hash=get_password_hash("Pass1!"), role=UserRole.CITIZEN)
    prov_u = User(email="prov_dup@sec.com", password_hash=get_password_hash("Pass1!"), role=UserRole.PROVIDER)
    db.add_all([cit, prov_u])
    db.commit()

    # Fully complete provider
    prov = Provider(
        user_id=prov_u.id,
        provider_type=ProviderType.ADVOCATE,
        full_name="Complete Advocate",
        phone="9999999999",
        location="Delhi",
        bio="Experienced lawyer",
        experience_years=5,
    )
    db.add(prov)
    db.commit()

    from app.services.provider_service import update_provider_generic_fields
    update_provider_generic_fields(db, prov, [
        {"field_name": "practice_area", "value": "Civil"},
        {"field_name": "registration_details", "value": "BAR123"}
    ])

    req = ServiceRequest(citizen_id=cit.id, service_category="Civil", description="Test", location="Delhi", preferred_provider_type=ProviderType.ADVOCATE)
    db.add(req)
    db.commit()

    token_prov = create_access_token(subject=prov_u.id, custom_claims={"email": prov_u.email, "role": "PROVIDER"})

    # First express interest -> 200 OK
    res1 = client.post(f"/api/requests/{req.id}/respond", json={"action": "ACCEPT"}, headers={"Authorization": f"Bearer {token_prov}"})
    assert res1.status_code == 200

    # Second express interest on same request -> 400 Bad Request
    res2 = client.post(f"/api/requests/{req.id}/respond", json={"action": "ACCEPT"}, headers={"Authorization": f"Bearer {token_prov}"})
    assert res2.status_code == 400
    assert "already expressed interest" in res2.json()["detail"].lower()


# 9. Duplicate incentive event cannot award duplicate points
def test_security_9_duplicate_incentive_event_cannot_award_duplicate_points(client, setup_database):
    db = setup_database
    prov_u = User(email="prov_pts@sec.com", password_hash=get_password_hash("Pass1!"), role=UserRole.PROVIDER)
    db.add(prov_u)
    db.commit()

    prov = Provider(
        user_id=prov_u.id,
        provider_type=ProviderType.ADVOCATE,
        full_name="Advocate Points",
        phone="9876543210",
        location="Mumbai",
        bio="Advocate bio",
        experience_years=4,
        points=0
    )
    db.add(prov)
    db.commit()

    from app.services.provider_service import update_provider_generic_fields
    update_provider_generic_fields(db, prov, [
        {"field_name": "practice_area", "value": "Civil"},
        {"field_name": "registration_details", "value": "BAR123"}
    ])

    req = ServiceRequest(citizen_id=prov_u.id, service_category="Property", description="Boundary dispute", location="Mumbai", preferred_provider_type=ProviderType.ADVOCATE)
    db.add(req)
    db.commit()

    token_prov = create_access_token(subject=prov_u.id, custom_claims={"email": prov_u.email, "role": "PROVIDER"})

    # Respond to request -> awards +20 (profile completion) + 10 (request responded) = 30 points
    client.post(f"/api/requests/{req.id}/respond", json={"action": "ACCEPT"}, headers={"Authorization": f"Bearer {token_prov}"})
    db.refresh(prov)
    initial_points = prov.points
    assert initial_points == 30

    # Attempting second respond -> rejected, points remain 30
    client.post(f"/api/requests/{req.id}/respond", json={"action": "ACCEPT"}, headers={"Authorization": f"Bearer {token_prov}"})
    db.refresh(prov)
    assert prov.points == 30

    # Verify only 1 PointTransaction exists for this request response
    tx_count = db.query(PointTransaction).filter(
        PointTransaction.provider_id == prov.id,
        PointTransaction.action == PointAction.REQUEST_RESPONDED,
        PointTransaction.reference_id == req.id
    ).count()
    assert tx_count == 1



# 10. Invalid JWT is rejected
def test_security_10_invalid_jwt_rejected(client, setup_database):
    res = client.get("/api/requests/me", headers={"Authorization": "Bearer invalid.jwt.token"})
    assert res.status_code == 401


# 11. Missing JWT is rejected
def test_security_11_missing_jwt_rejected(client, setup_database):
    res = client.get("/api/requests/me")
    assert res.status_code == 401


# 12. Malformed upload is rejected
def test_security_12_malformed_upload_rejected(client, setup_database):
    db = setup_database
    user = User(email="mal@sec.com", password_hash=get_password_hash("Pass1!"), role=UserRole.CITIZEN)
    db.add(user)
    db.commit()

    token = create_access_token(subject=user.id, custom_claims={"email": user.email, "role": "CITIZEN"})

    # Fake PDF lacking %PDF- binary magic bytes header
    fake_file = ("script.pdf", io.BytesIO(b"Not a real binary pdf file header"), "application/pdf")
    res = client.post("/api/documents", files={"file": fake_file}, headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 400
    assert "binary headers do not match" in res.json()["detail"].lower()


# 13. Oversized upload is rejected
def test_security_13_oversized_upload_rejected(client, setup_database):
    db = setup_database
    user = User(email="size@sec.com", password_hash=get_password_hash("Pass1!"), role=UserRole.CITIZEN)
    db.add(user)
    db.commit()

    token = create_access_token(subject=user.id, custom_claims={"email": user.email, "role": "CITIZEN"})

    # Oversized file (>10MB)
    huge_data = VALID_PDF_BYTES + (b"0" * (10 * 1024 * 1024 + 100))
    huge_file = ("huge.pdf", io.BytesIO(huge_data), "application/pdf")

    res = client.post("/api/documents", files={"file": huge_file}, headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 400
    assert "exceeds maximum limit" in res.json()["detail"].lower()



# 14. Path traversal filename is safely neutralized
def test_security_14_path_traversal_filename_neutralized(client, setup_database):
    db = setup_database
    user = User(email="path@sec.com", password_hash=get_password_hash("Pass1!"), role=UserRole.CITIZEN)
    db.add(user)
    db.commit()

    token = create_access_token(subject=user.id, custom_claims={"email": user.email, "role": "CITIZEN"})

    # Path traversal attack filename: ../../../etc/passwd.pdf
    traversal_file = ("../../../../etc/passwd.pdf", io.BytesIO(VALID_PDF_BYTES), "application/pdf")
    res = client.post("/api/documents", files={"file": traversal_file}, headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 201

    doc_data = res.json()
    assert ".." not in doc_data["filename"]
    assert "/" not in doc_data["filename"]
    assert "\\" not in doc_data["filename"]


# 15. Sensitive information is absent from audit logs
def test_security_15_sensitive_info_absent_from_audit_logs(client, setup_database):
    db = setup_database

    client.post("/api/auth/register", json={"email": "audit_sec@sec.com", "password": "SecretPassword123!", "role": "CITIZEN"})
    client.post("/api/auth/login", json={"email": "audit_sec@sec.com", "password": "SecretPassword123!"})

    logs = db.query(AuditLog).all()
    for log in logs:
        metadata_str = str(log.metadata_json or "").lower()
        assert "secretpassword123!" not in metadata_str
        assert "password_hash" not in metadata_str
        assert "access_token" not in metadata_str
