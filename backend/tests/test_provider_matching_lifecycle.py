import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from app.main import app
from app.db.base import Base
from app.db.database import SessionLocal, engine, init_db
from app.core.security import get_password_hash, create_access_token
from app.models.user import User, UserRole
from app.models.provider import Provider, ProviderType, VerificationStatus, AvailabilityStatus
from app.models.request import ServiceRequest, RequestStatus, RequestUrgency
from app.models.verification import ProviderVerificationRecord, DetailedVerificationStatus
from app.services.provider_service import update_provider_generic_fields
from app.services.matching_service import find_matching_providers, calculate_provider_match_score
from app.core.normalization import normalize_location, calculate_service_match_score


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


def test_centralized_normalization():
    """Verify centralized canonical location and category normalization functions."""
    assert normalize_location("Bengaluru") == "bengaluru"
    assert normalize_location("Bangalore") == "bengaluru"
    assert normalize_location("Bangalore City") == "bengaluru"
    assert normalize_location("New Delhi") == "delhi"
    assert normalize_location("Delhi") == "delhi"
    assert normalize_location("Mumbai") == "mumbai"

    # Category matching tiered evaluation:
    # 1. Exact match (100.0)
    score_exact = calculate_service_match_score(
        request_category="Property Dispute",
        request_description="Plot boundary wall dispute",
        combined_provider_text="Practice Area: Property Dispute, Real Estate Litigation"
    )
    assert score_exact == 100.0

    # 2. Related match (60.0) — e.g. "Property Law" for "Property Dispute"
    score_related = calculate_service_match_score(
        request_category="Property Dispute",
        request_description="Land ownership issue",
        combined_provider_text="Specializing in Property Law and Civil Conveyancing"
    )
    assert score_related == 60.0

    # 3. Baseline match (40.0) — no category keyword overlap
    score_baseline = calculate_service_match_score(
        request_category="Property Dispute",
        request_description="Land dispute",
        combined_provider_text="Criminal defense specialist"
    )
    assert score_baseline == 40.0


def test_complete_real_matching_lifecycle():
    """Executes the full real lifecycle:
    Provider registers -> SUBMITTED state -> Citizen creates request -> Provider excluded (pending count=1)
    -> Admin verifies provider -> Citizen reruns matching -> Provider appears with natural score.
    """
    db = SessionLocal()
    try:
        client = TestClient(app)

        # 1. Admin User
        admin_pass = get_password_hash("Admin123!")
        admin_user = User(email="admin_lifecycle@lexlogic.demo", password_hash=admin_pass, role=UserRole.ADMIN)
        db.add(admin_user)
        db.commit()
        db.refresh(admin_user)
        admin_token = create_access_token(admin_user.id)
        admin_headers = {"Authorization": f"Bearer {admin_token}"}

        # 2. Advocate User Registration
        prov_pass = get_password_hash("ProvPass123!")
        prov_user = User(email="advocate_bengaluru@lexlogic.demo", password_hash=prov_pass, role=UserRole.PROVIDER)
        db.add(prov_user)
        db.commit()
        db.refresh(prov_user)

        # Create Provider Profile
        provider = Provider(
            user_id=prov_user.id,
            provider_type=ProviderType.ADVOCATE,
            full_name="Advocate Ramesh Kumar",
            phone="+919888877777",
            location="Bengaluru",
            experience_years=12,
            bio="Experienced High Court advocate specializing in Property Dispute litigation.",
            verification_status=VerificationStatus.SUBMITTED, # Pending admin approval
            availability_status=AvailabilityStatus.AVAILABLE
        )
        db.add(provider)
        db.commit()
        db.refresh(provider)

        # Update generic field: practice_area
        update_provider_generic_fields(db, provider, [
            {"field_name": "practice_area", "value": "Property Dispute"}
        ])

        # 3. Citizen User & Request
        cit_pass = get_password_hash("CitPass123!")
        cit_user = User(email="citizen_bengaluru@lexlogic.demo", password_hash=cit_pass, role=UserRole.CITIZEN)
        db.add(cit_user)
        db.commit()
        db.refresh(cit_user)
        cit_token = create_access_token(cit_user.id)
        cit_headers = {"Authorization": f"Bearer {cit_token}"}

        # Citizen creates Service Request for Property Dispute in Bengaluru
        request = ServiceRequest(
            citizen_id=cit_user.id,
            service_category="Property Dispute",
            description="Need legal advice regarding property boundary dispute in Bangalore.",
            location="Bengaluru",
            preferred_provider_type=ProviderType.ADVOCATE,
            urgency=RequestUrgency.NORMAL,
            status=RequestStatus.OPEN
        )
        db.add(request)
        db.commit()
        db.refresh(request)

        # 4. INITIAL MATCHING EXECUTION (Provider is SUBMITTED, not yet VERIFIED)
        match_resp = client.post(
            "/api/matching/providers",
            json={"request_id": request.id, "min_match_score": 0.0},
            headers=cit_headers
        )
        assert match_resp.status_code == 200
        data = match_resp.json()

        # Provider MUST NOT appear in active verified matches
        matched_ids = [p["provider_id"] for p in data["matched_providers"]]
        assert provider.id not in matched_ids, "Unverified provider should not appear in active matches"

        # Pending count MUST be at least 1, indicating pending provider exists
        assert data["pending_verification_count"] >= 1
        assert data["has_pending_matches"] is True

        # 5. ADMIN VERIFICATION APPROVAL
        decision_resp = client.post(
            f"/api/providers/admin/{provider.id}/verification/decision",
            json={
                "action": "APPROVE_CREDENTIAL",
                "target_status": "VERIFIED",
                "notes": "Verified Bar Council enrollment KAR/1842/2012"
            },
            headers=admin_headers
        )
        assert decision_resp.status_code == 200

        db.refresh(provider)
        assert provider.verification_status == VerificationStatus.VERIFIED

        # 6. POST-VERIFICATION MATCHING EXECUTION
        match_resp_2 = client.post(
            "/api/matching/providers",
            json={"request_id": request.id, "min_match_score": 0.0},
            headers=cit_headers
        )
        assert match_resp_2.status_code == 200
        data_2 = match_resp_2.json()

        # Provider MUST NOW APPEAR in active matches
        matched_ids_2 = [p["provider_id"] for p in data_2["matched_providers"]]
        assert provider.id in matched_ids_2, "Newly verified provider should now appear in active matches"

        # Find provider in response
        prov_out = next(p for p in data_2["matched_providers"] if p["provider_id"] == provider.id)
        assert prov_out["full_name"] == "Advocate Ramesh Kumar"
        assert prov_out["location"] == "Bengaluru"
        assert prov_out["is_advocate_factual_match"] is True

    finally:
        db.close()


def test_location_alias_and_category_filtering():
    """Verifies location alias matching (Bengaluru vs Bangalore) and category exclusion."""
    db = SessionLocal()
    try:
        user = User(email="adv_bangalore@lexlogic.demo", password_hash=get_password_hash("Pass123!"), role=UserRole.PROVIDER)
        db.add(user)
        db.commit()

        # Provider registered with "Bangalore" location
        provider = Provider(
            user_id=user.id,
            provider_type=ProviderType.ADVOCATE,
            full_name="Advocate Suresh Rao",
            phone="+919777766666",
            location="Bangalore",
            experience_years=8,
            bio="Bangalore High Court advocate handling Property Disputes.",
            verification_status=VerificationStatus.VERIFIED,
            availability_status=AvailabilityStatus.AVAILABLE
        )
        db.add(provider)
        db.commit()

        update_provider_generic_fields(db, provider, [
            {"field_name": "practice_area", "value": "Property Dispute"}
        ])

        # Request registered with "Bengaluru" location
        request = ServiceRequest(
            citizen_id=1,
            service_category="Property Dispute",
            description="Property encroachment case in Bengaluru.",
            location="Bengaluru",
            preferred_provider_type=ProviderType.ADVOCATE,
            urgency=RequestUrgency.NORMAL,
            status=RequestStatus.OPEN
        )
        db.add(request)
        db.commit()

        matches = find_matching_providers(request, db)
        matched_ids = [p.id for p, score in matches]
        assert provider.id in matched_ids, "Provider in 'Bangalore' should match request for 'Bengaluru'"

    finally:
        db.close()
