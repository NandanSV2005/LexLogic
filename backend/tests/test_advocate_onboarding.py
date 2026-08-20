from datetime import datetime, timezone
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.db.base import Base
from app.db.database import SessionLocal, engine
from app.core.security import get_password_hash, create_access_token
from app.models.user import User, UserRole
from app.models.provider import Provider, ProviderType, VerificationStatus
from app.models.verification import DetailedVerificationStatus, CredentialType


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
        Base.metadata.drop_all(bind=engine)


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


def test_advocate_verification_submission_flow(client):
    """Test full advocate professional registration submission endpoint."""
    # 1. Register user & generate token directly
    user = User(
        email="advocate_test@lexlogic.demo",
        password_hash=get_password_hash("Password123!"),
        role=UserRole.PROVIDER,
        is_active=True,
    )
    db = SessionLocal()
    db.add(user)
    db.commit()
    db.refresh(user)

    provider = Provider(
        user_id=user.id,
        provider_type=ProviderType.ADVOCATE,
        full_name="Adv. Ramesh Varma",
        phone="+919876543210",
        location="New Delhi",
        experience_years=8,
        bio="Experienced Civil & Constitutional Advocate at Delhi High Court.",
    )
    db.add(provider)
    db.commit()

    token = create_access_token(user.id)
    headers = {"Authorization": f"Bearer {token}"}

    # 3. Submit advocate verification (Step 2, 3, 4)
    submit_payload = {
        "full_legal_name": "Ramesh Varma",
        "jurisdiction_city": "New Delhi",
        "jurisdiction_state": "Delhi",
        "state_bar_council": "Bar Council of Delhi",
        "enrollment_number": "D/1098/2016",
        "enrollment_year": 2016,
        "credential_type": "BAR_ENROLLMENT_CERTIFICATE",
        "practice_areas": "Civil Litigation, Commercial Disputes",
        "case_references": [
            {
                "case_number": "W.P.(C) 1204/2021",
                "court_name": "High Court of Delhi",
                "case_type": "Constitutional",
                "case_year": 2021,
                "advocate_role": "Lead Counsel",
            },
            {
                "case_number": "CS(OS) 554/2022",
                "court_name": "Delhi District Court",
                "case_type": "Property Dispute",
                "case_year": 2022,
                "advocate_role": "Co-Counsel",
            }
        ]
    }

    sub_resp = client.post("/api/providers/verification/advocate/submit", json=submit_payload, headers=headers)
    assert sub_resp.status_code == 200
    sub_data = sub_resp.json()

    assert sub_data["overall_status"] == "SUBMITTED"
    assert sub_data["identity_status"] == "SUBMITTED"
    assert sub_data["credential_status"] == "SUBMITTED"
    assert sub_data["practice_status"] == "SUBMITTED"

    assert sub_data["advocate_profile"]["state_bar_council"] == "Bar Council of Delhi"
    assert sub_data["advocate_profile"]["enrollment_number"] == "D/1098/2016"
    assert len(sub_data["advocate_profile"]["case_references"]) == 2
    assert len(sub_data["history_entries"]) >= 1

    # 4. Fetch GET /verification/me
    get_resp = client.get("/api/providers/verification/me", headers=headers)
    assert get_resp.status_code == 200
    get_data = get_resp.json()

    assert get_data["overall_status"] == "SUBMITTED"
    assert get_data["advocate_profile"]["enrollment_number"] == "D/1098/2016"
