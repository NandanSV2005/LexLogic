from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.api.deps import get_current_active_user
from app.models.user import User, UserRole
from app.models.provider import Provider
from app.models.request import ServiceRequest, RequestProvider
from app.models.appointment import Appointment, AppointmentStatus
from app.schemas.appointment import AppointmentCreate, AppointmentOut
from app.services.audit import log_audit


router = APIRouter(prefix="/requests", tags=["Service Scheduling"])


@router.get(
    "/{request_id}/appointments",
    response_model=List[AppointmentOut],
    status_code=status.HTTP_200_OK,
    summary="List appointment slots for a service request",
    description="Returns scheduled appointments for an active case workspace."
)
def list_appointments(
    request_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
) -> List[AppointmentOut]:
    req = db.query(ServiceRequest).filter(ServiceRequest.id == request_id).first()
    if not req:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Service request not found")

    is_owner = (req.citizen_id == current_user.id)
    is_admin = (current_user.role == UserRole.ADMIN)
    is_connected = False

    if current_user.role == UserRole.PROVIDER:
        provider = db.query(Provider).filter(Provider.user_id == current_user.id).first()
        if provider:
            inter = db.query(RequestProvider).filter(
                RequestProvider.request_id == req.id,
                RequestProvider.provider_id == provider.id
            ).first()
            if inter:
                is_connected = True

    if not (is_owner or is_admin or is_connected):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not have authorization to view appointments for this request")

    appts = db.query(Appointment).filter(Appointment.request_id == request_id).all()
    return appts


@router.post(
    "/{request_id}/appointments",
    response_model=AppointmentOut,
    status_code=status.HTTP_201_CREATED,
    summary="Schedule an appointment slot for a service request",
    description="Schedules a appointment slot between Citizen and connected Provider."
)
def schedule_appointment(
    request_id: int,
    appt_in: AppointmentCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
) -> AppointmentOut:
    req = db.query(ServiceRequest).filter(ServiceRequest.id == request_id).first()
    if not req:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Service request not found")

    accepted_inter = req.accepted_interaction
    if not accepted_inter:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Appointments can only be scheduled once a provider has been accepted for representation"
        )

    provider_id = accepted_inter.provider_id
    citizen_id = req.citizen_id

    # Authorization Check
    is_citizen_owner = (current_user.id == citizen_id)
    is_provider_assigned = False

    if current_user.role == UserRole.PROVIDER:
        prov = db.query(Provider).filter(Provider.user_id == current_user.id).first()
        if prov and prov.id == provider_id:
            is_provider_assigned = True

    if not (is_citizen_owner or is_provider_assigned or current_user.role == UserRole.ADMIN):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only connected citizen and provider can schedule appointments for this request")

    appt = Appointment(
        request_id=request_id,
        provider_id=provider_id,
        citizen_id=citizen_id,
        slot_datetime=appt_in.slot_datetime,
        purpose=appt_in.purpose,
        status=AppointmentStatus.SCHEDULED
    )
    db.add(appt)
    db.commit()
    db.refresh(appt)

    log_audit(
        db=db,
        user_id=current_user.id,
        action="APPOINTMENT_SCHEDULE",
        resource_type="appointment",
        resource_id=appt.id,
        metadata_json={"request_id": request_id, "provider_id": provider_id, "slot": str(appt.slot_datetime)}
    )

    return appt
