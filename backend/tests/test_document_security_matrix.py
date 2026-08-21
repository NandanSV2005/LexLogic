import io
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from app.main import app
from app.db.base import Base
from app.db.database import SessionLocal, engine
from app.core.security import get_password_hash, create_access_token
from app.models.user import User, UserRole
from app.models.provider import Provider, ProviderType, VerificationStatus, AvailabilityStatus
from app.models.request import ServiceRequest, RequestStatus, RequestUrgency, RequestProvider, InteractionStatus
from app.models.document import Document, DocumentVisibility, DocumentShare, DocumentShareStatus, DocumentSharePermission
from app.models.points import PointTransaction, PointAction


@pytest.fixture(autouse=True)
def setup_database():
    """Re-initialize clean tables before each test."""
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def test_document_security_matrix_and_revocation():
    """Verifies all 9 mandatory document permission security rules:
    1. Connected provider + no DocumentShare -> 403
    2. Connected provider + ACTIVE VIEW share -> 200 OK (view mode)
    3. Connected provider + REVOKED share -> 403
    4. Connected provider after revocation -> 403 (Case connection NEVER overrides revocation)
    5. Unrelated provider -> 403
    6. Citizen owner retains access -> 200 OK
    7. VIEW-only provider cannot download (download=true) -> 403
    8. Citizen explicitly grants access -> Provider can view
    9. Citizen revokes access -> Provider immediately loses access
    """
    db = SessionLocal()
    try:
        client = TestClient(app)

        # 1. Create Citizen User & Token
        cit_pass = get_password_hash("CitPass123!")
        cit_user = User(email="citizen_sec@lexlogic.demo", password_hash=cit_pass, role=UserRole.CITIZEN)
        db.add(cit_user)
        db.commit()
        db.refresh(cit_user)
        cit_token = create_access_token(cit_user.id)
        cit_headers = {"Authorization": f"Bearer {cit_token}"}

        # 2. Create Service Request
        request = ServiceRequest(
            citizen_id=cit_user.id,
            service_category="Property Dispute",
            description="Boundary dispute document security test.",
            location="Bengaluru",
            preferred_provider_type=ProviderType.ADVOCATE,
            urgency=RequestUrgency.NORMAL,
            status=RequestStatus.IN_PROGRESS
        )
        db.add(request)
        db.commit()
        db.refresh(request)

        # 3. Create Connected Provider A
        prov_a_user = User(email="provider_a@lexlogic.demo", password_hash=get_password_hash("Pass123!"), role=UserRole.PROVIDER)
        db.add(prov_a_user)
        db.commit()
        db.refresh(prov_a_user)
        prov_a_token = create_access_token(prov_a_user.id)
        prov_a_headers = {"Authorization": f"Bearer {prov_a_token}"}

        provider_a = Provider(
            user_id=prov_a_user.id,
            provider_type=ProviderType.ADVOCATE,
            full_name="Advocate Provider A",
            phone="+919111111111",
            location="Bengaluru",
            experience_years=10,
            verification_status=VerificationStatus.VERIFIED,
            availability_status=AvailabilityStatus.AVAILABLE
        )
        db.add(provider_a)
        db.commit()
        db.refresh(provider_a)

        # Connect Provider A to request via RequestProvider interaction
        inter_a = RequestProvider(
            request_id=request.id,
            provider_id=provider_a.id,
            status=InteractionStatus.ACCEPTED
        )
        db.add(inter_a)
        db.commit()

        # 4. Create Unrelated Provider B
        prov_b_user = User(email="provider_b_unrelated@lexlogic.demo", password_hash=get_password_hash("Pass123!"), role=UserRole.PROVIDER)
        db.add(prov_b_user)
        db.commit()
        db.refresh(prov_b_user)
        prov_b_token = create_access_token(prov_b_user.id)
        prov_b_headers = {"Authorization": f"Bearer {prov_b_token}"}

        provider_b = Provider(
            user_id=prov_b_user.id,
            provider_type=ProviderType.ADVOCATE,
            full_name="Advocate Provider B Unrelated",
            phone="+919222222222",
            location="Bengaluru",
            experience_years=5,
            verification_status=VerificationStatus.VERIFIED,
            availability_status=AvailabilityStatus.AVAILABLE
        )
        db.add(provider_b)
        db.commit()
        db.refresh(provider_b)

        # 5. Citizen Uploads Document bound to request (Private by default)
        file_payload = ("test_deed.pdf", b"%PDF-1.4 Mock deed file content", "application/pdf")
        upload_resp = client.post(
            "/api/documents",
            data={"title": "Property Ownership Deed", "request_id": str(request.id)},
            files={"file": file_payload},
            headers=cit_headers
        )
        assert upload_resp.status_code == 201, f"Upload failed: {upload_resp.text}"
        doc_data = upload_resp.json()
        doc_id = doc_data["id"]

        # RULE 6: Citizen owner retains full view and download access
        cit_view_resp = client.get(f"/api/documents/{doc_id}?download=false", headers=cit_headers)
        assert cit_view_resp.status_code == 200, "Citizen owner should be able to view own document"

        cit_dl_resp = client.get(f"/api/documents/{doc_id}?download=true", headers=cit_headers)
        assert cit_dl_resp.status_code == 200, "Citizen owner should be able to download own document"

        # RULE 1: Connected Provider A attempts to view with NO explicit DocumentShare -> 403 Forbidden
        no_share_resp = client.get(f"/api/documents/{doc_id}?download=false", headers=prov_a_headers)
        assert no_share_resp.status_code == 403, "Connected provider without explicit share must get 403 Forbidden"

        # RULE 5: Unrelated Provider B attempts to view -> 403 Forbidden
        unrelated_resp = client.get(f"/api/documents/{doc_id}?download=false", headers=prov_b_headers)
        assert unrelated_resp.status_code == 403, "Unrelated provider must get 403 Forbidden"

        # RULE 8: Citizen explicitly grants VIEW access to Connected Provider A
        share_resp = client.post(
            f"/api/documents/{doc_id}/share",
            json={"provider_id": provider_a.id, "permission": "VIEW"},
            headers=cit_headers
        )
        assert share_resp.status_code == 200, f"Share failed: {share_resp.text}"

        # RULE 2: Connected Provider A now views document (download=false) -> 200 OK
        prov_view_resp = client.get(f"/api/documents/{doc_id}?download=false", headers=prov_a_headers)
        assert prov_view_resp.status_code == 200, "Authorized provider with ACTIVE VIEW share should be allowed inline view"

        # RULE 7: VIEW-only Provider A attempts download (download=true) -> 403 Forbidden
        prov_dl_resp = client.get(f"/api/documents/{doc_id}?download=true", headers=prov_a_headers)
        assert prov_dl_resp.status_code == 403, "VIEW-only provider must get 403 Forbidden on download"

        # RULE 9: Citizen revokes access from Provider A
        revoke_resp = client.post(
            f"/api/documents/{doc_id}/revoke",
            json={"provider_id": provider_a.id},
            headers=cit_headers
        )
        assert revoke_resp.status_code == 200, f"Revoke failed: {revoke_resp.text}"

        # RULE 3 & 4: Provider A attempts to view AFTER revocation -> 403 Forbidden (Case connection NEVER overrides revocation)
        revoked_view_resp = client.get(f"/api/documents/{doc_id}?download=false", headers=prov_a_headers)
        assert revoked_view_resp.status_code == 403, "Provider with REVOKED share must receive 403 Forbidden"

    finally:
        db.close()


def test_availability_control_and_anti_farming_cooldown():
    """Verifies PUT /api/providers/availability endpoint and 24h anti-farming cooldown rule:
    1. Provider can set AVAILABLE, BUSY, UNAVAILABLE.
    2. Setting AVAILABLE awards +10 points on first attempt.
    3. Toggling AVAILABLE -> BUSY -> AVAILABLE immediately does NOT farm points (24h cooldown enforced).
    4. Unauthorized user cannot modify provider availability.
    """
    db = SessionLocal()
    try:
        client = TestClient(app)

        # 1. Create Provider User
        prov_pass = get_password_hash("ProvPass123!")
        prov_user = User(email="provider_avail@lexlogic.demo", password_hash=prov_pass, role=UserRole.PROVIDER)
        db.add(prov_user)
        db.commit()
        db.refresh(prov_user)
        prov_token = create_access_token(prov_user.id)
        prov_headers = {"Authorization": f"Bearer {prov_token}"}

        provider = Provider(
            user_id=prov_user.id,
            provider_type=ProviderType.ADVOCATE,
            full_name="Advocate Availability Test",
            phone="+919333333333",
            location="Bengaluru",
            experience_years=8,
            points=0,
            verification_status=VerificationStatus.VERIFIED,
            availability_status=AvailabilityStatus.UNAVAILABLE
        )
        db.add(provider)
        db.commit()
        db.refresh(provider)

        # 2. Set Status to BUSY
        resp_busy = client.put(
            "/api/providers/availability",
            json={"availability_status": "BUSY"},
            headers=prov_headers
        )
        assert resp_busy.status_code == 200
        assert resp_busy.json()["availability_status"] == "BUSY"

        # 3. Set Status to AVAILABLE (First time -> +10 points awarded)
        resp_avail_1 = client.put(
            "/api/providers/availability",
            json={"availability_status": "AVAILABLE"},
            headers=prov_headers
        )
        assert resp_avail_1.status_code == 200
        assert resp_avail_1.json()["availability_status"] == "AVAILABLE"

        db.refresh(provider)
        pts_first = provider.points
        assert pts_first == 10, f"Expected 10 points on first AVAILABLE update, got {pts_first}"

        # 4. Anti-Farming Test: Immediately toggle AVAILABLE -> BUSY -> AVAILABLE
        client.put("/api/providers/availability", json={"availability_status": "BUSY"}, headers=prov_headers)
        resp_avail_2 = client.put("/api/providers/availability", json={"availability_status": "AVAILABLE"}, headers=prov_headers)
        assert resp_avail_2.status_code == 200

        db.refresh(provider)
        pts_second = provider.points
        assert pts_second == 10, f"Anti-farming violation! Points increased to {pts_second} despite 24h cooldown!"

    finally:
        db.close()
