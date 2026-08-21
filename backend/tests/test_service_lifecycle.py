import pytest
from datetime import datetime, timedelta, timezone
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from app.main import app
from app.db.database import get_db, SessionLocal, init_db
from app.models.user import User, UserRole
from app.models.provider import Provider, ProviderType, VerificationStatus, AvailabilityStatus
from app.models.request import ServiceRequest, RequestStatus, RequestProvider, InteractionStatus, RequestUrgency
from app.models.document import Document, DocumentVisibility, DocumentShare, DocumentShareStatus, DocumentSharePermission
from app.models.appointment import Appointment, AppointmentStatus, ProviderAvailabilitySchedule, ProviderBlockedDate
from app.core.security import get_password_hash, create_access_token


@pytest.fixture
def db_session():
    init_db()
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture
def setup_lifecycle_users(db_session: Session):
    timestamp = datetime.now().timestamp()
    
    # Citizen
    citizen = User(
        email=f"lc_citizen_{timestamp}@example.com",
        password_hash=get_password_hash("password123"),
        role=UserRole.CITIZEN,
        is_active=True,
    )
    db_session.add(citizen)

    # Provider
    prov_user = User(
        email=f"lc_provider_{timestamp}@example.com",
        password_hash=get_password_hash("password123"),
        role=UserRole.PROVIDER,
        is_active=True,
    )
    db_session.add(prov_user)
    db_session.commit()
    db_session.refresh(citizen)
    db_session.refresh(prov_user)

    provider = Provider(
        user_id=prov_user.id,
        full_name=f"Adv. Lifecycle {timestamp}",
        provider_type=ProviderType.ADVOCATE,
        experience_years=8,
        location="Delhi",
        phone="9876543210",
        bio="Experienced advocate in property law.",
        verification_status=VerificationStatus.VERIFIED,
        availability_status=AvailabilityStatus.AVAILABLE,
        points=0,
        completed_requests=0,
        total_requests=0,
        reliability_score=100.0,
    )
    db_session.add(provider)
    db_session.commit()
    db_session.refresh(provider)

    citizen_token = create_access_token(subject=str(citizen.id))
    provider_token = create_access_token(subject=str(prov_user.id))

    return {
        "citizen": citizen,
        "provider_user": prov_user,
        "provider": provider,
        "citizen_token": citizen_token,
        "provider_token": provider_token,
    }


def test_full_service_lifecycle_flow(setup_lifecycle_users):
    client = TestClient(app)
    c_token = setup_lifecycle_users["citizen_token"]
    p_token = setup_lifecycle_users["provider_token"]
    provider_id = setup_lifecycle_users["provider"].id
    citizen_id = setup_lifecycle_users["citizen"].id

    # 1. Citizen creates service request
    req_resp = client.post(
        "/api/requests",
        headers={"Authorization": f"Bearer {c_token}"},
        json={
            "service_category": "Property Law",
            "description": "Boundary dispute requiring advocate representation",
            "location": "Delhi",
            "preferred_provider_type": "ADVOCATE",
            "urgency": "HIGH",
            "legal_aid_interest": True
        }
    )
    assert req_resp.status_code == 201
    request_id = req_resp.json()["id"]
    assert req_resp.json()["status"] == "OPEN"

    # 2. Provider expresses interest
    resp_interest = client.post(
        f"/api/requests/{request_id}/respond",
        headers={"Authorization": f"Bearer {p_token}"}
    )
    assert resp_interest.status_code == 200

    # 3. Citizen accepts provider
    accept_resp = client.post(
        f"/api/requests/{request_id}/accept-provider/{provider_id}",
        headers={"Authorization": f"Bearer {c_token}"}
    )
    assert accept_resp.status_code == 200
    assert accept_resp.json()["status"] == "IN_PROGRESS"

    # 4. Provider requests documents
    doc_req_resp = client.post(
        f"/api/requests/{request_id}/request-documents",
        headers={"Authorization": f"Bearer {p_token}"},
        json={"requested_documents": "Property deed, Tax receipt"}
    )
    assert doc_req_resp.status_code == 200

    # 5. Citizen uploads document with request_id & auto share with VIEW permission
    upload_resp = client.post(
        "/api/documents/upload",
        headers={"Authorization": f"Bearer {c_token}"},
        data={
            "title": "Property Deed Title",
            "request_id": str(request_id),
            "permission": "VIEW"
        },
        files={"file": ("deed.pdf", b"%PDF-1.4 test deed content", "application/pdf")}
    )
    assert upload_resp.status_code == 201
    doc_id = upload_resp.json()["id"]

    # 6. Provider views request documents (verifies view permission)
    req_docs_resp = client.get(
        f"/api/documents/request/{request_id}",
        headers={"Authorization": f"Bearer {p_token}"}
    )
    assert req_docs_resp.status_code == 200
    assert len(req_docs_resp.json()) >= 1
    assert req_docs_resp.json()[0]["current_user_permission"] == "VIEW"

    # 7. Provider reviews documents as SUFFICIENT
    review_resp = client.post(
        f"/api/requests/{request_id}/review-documents?action=SUFFICIENT",
        headers={"Authorization": f"Bearer {p_token}"}
    )
    assert review_resp.status_code == 200
    assert review_resp.json()["status"] == "DOCUMENTS_REVIEWED"

    # 8. Provider marks case ready for service
    ready_resp = client.post(
        f"/api/requests/{request_id}/mark-ready",
        headers={"Authorization": f"Bearer {p_token}"}
    )
    assert ready_resp.status_code == 200
    assert ready_resp.json()["status"] == "READY_FOR_SERVICE"

    # 9. Provider configures availability and Citizen checks slots
    target_dt = datetime.now() + timedelta(days=1)
    while target_dt.weekday() >= 5:  # Skip Saturday (5) and Sunday (6)
        target_dt += timedelta(days=1)
    target_date = target_dt.strftime("%Y-%m-%d")
    avail_resp = client.get(
        f"/api/appointments/available-slots?provider_id={provider_id}&date={target_date}",
        headers={"Authorization": f"Bearer {c_token}"}
    )
    assert avail_resp.status_code == 200
    avail_slots = avail_resp.json()["available_slots"]
    assert len(avail_slots) > 0
    chosen_slot_time = avail_slots[0]

    # 10. Citizen books appointment slot
    slot_dt_str = f"{target_date}T{chosen_slot_time}:00Z"
    book_resp = client.post(
        "/api/appointments/book",
        headers={"Authorization": f"Bearer {c_token}"},
        json={
            "request_id": request_id,
            "provider_id": provider_id,
            "slot_datetime": slot_dt_str,
            "purpose": "Initial Case Consultation",
            "duration_minutes": 30
        }
    )
    assert book_resp.status_code == 201
    appt_id = book_resp.json()["id"]

    # 11. Double-booking prevention check (attempt same slot)
    double_book_resp = client.post(
        "/api/appointments/book",
        headers={"Authorization": f"Bearer {c_token}"},
        json={
            "request_id": request_id,
            "provider_id": provider_id,
            "slot_datetime": slot_dt_str,
            "purpose": "Conflicting Consultation",
            "duration_minutes": 30
        }
    )
    assert double_book_resp.status_code == 400
    assert any(term in double_book_resp.json()["detail"].lower() for term in ["booked", "unavailable"])

    # 12. Provider confirms appointment
    confirm_appt_resp = client.post(
        f"/api/appointments/{appt_id}/confirm",
        headers={"Authorization": f"Bearer {p_token}"}
    )
    assert confirm_appt_resp.status_code == 200
    assert confirm_appt_resp.json()["status"] == "CONFIRMED"

    # 13. Provider starts service execution (seeds milestones)
    start_resp = client.post(
        f"/api/requests/{request_id}/start-service",
        headers={"Authorization": f"Bearer {p_token}"}
    )
    assert start_resp.status_code == 200
    assert start_resp.json()["status"] == "IN_PROGRESS"

    # Check milestones seeded
    ms_resp = client.get(
        f"/api/requests/{request_id}/milestones",
        headers={"Authorization": f"Bearer {c_token}"}
    )
    assert ms_resp.status_code == 200
    milestones = ms_resp.json()
    assert len(milestones) >= 5

    # Provider completes first milestone
    first_ms_id = milestones[0]["id"]
    update_ms_resp = client.put(
        f"/api/requests/{request_id}/milestones/{first_ms_id}",
        headers={"Authorization": f"Bearer {p_token}"},
        json={"status": "COMPLETED", "notes": "Case assessment fully executed"}
    )
    assert update_ms_resp.status_code == 200
    assert update_ms_resp.json()["status"] == "COMPLETED"

    # 14. Lightweight Case Update
    upd_resp = client.post(
        f"/api/requests/{request_id}/updates",
        headers={"Authorization": f"Bearer {p_token}"},
        json={"update_text": "Drafted initial notice for boundary dispute."}
    )
    assert upd_resp.status_code == 201

    # 15. Provider submits completion note
    sub_comp_resp = client.post(
        f"/api/requests/{request_id}/submit-completion",
        headers={"Authorization": f"Bearer {p_token}"},
        json={"completion_note": "Boundary dispute notice served and matter concluded."}
    )
    assert sub_comp_resp.status_code == 200
    assert sub_comp_resp.json()["status"] == "COMPLETION_PENDING"

    # 16. Citizen confirms completion
    confirm_comp_resp = client.post(
        f"/api/requests/{request_id}/complete",
        headers={"Authorization": f"Bearer {c_token}"}
    )
    assert confirm_comp_resp.status_code == 200
    assert confirm_comp_resp.json()["status"] == "COMPLETED"

    # 17. Verify timeline events
    timeline_resp = client.get(
        f"/api/requests/{request_id}/timeline",
        headers={"Authorization": f"Bearer {c_token}"}
    )
    assert timeline_resp.status_code == 200
    events = timeline_resp.json()
    assert len(events) >= 5

    # 18. Final case summary check
    summary_resp = client.get(
        f"/api/requests/{request_id}/summary",
        headers={"Authorization": f"Bearer {c_token}"}
    )
    assert summary_resp.status_code == 200
    summary_data = summary_resp.json()
    assert summary_data["final_status"] == "COMPLETED"
    assert summary_data["documents_exchanged_count"] >= 1
    assert summary_data["appointment_count"] >= 1
    assert summary_data["final_completion_note"] is not None
