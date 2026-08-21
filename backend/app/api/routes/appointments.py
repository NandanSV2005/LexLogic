from typing import List, Optional
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.api.deps import require_provider, require_citizen, get_current_active_user
from app.models.user import User, UserRole
from app.models.provider import Provider
from app.models.request import ServiceRequest, RequestProvider
from app.models.appointment import (
    Appointment,
    AppointmentStatus,
    ProviderAvailabilitySchedule,
    ProviderBlockedDate,
)
from app.schemas.appointment import (
    AppointmentCreate,
    AppointmentOut,
    AppointmentDeclineInput,
    ProviderAvailabilityScheduleInput,
    ProviderScheduleSlotOut,
    ProviderBlockedDateInput,
    ProviderBlockedDateOut,
    AvailableSlotsOut,
)
from app.services.availability_service import (
    get_provider_available_slots,
    validate_and_book_appointment,
    seed_default_provider_schedule_if_empty,
)
from app.services.timeline_service import log_timeline_event
from app.services.audit import log_audit


router = APIRouter(prefix="/appointments", tags=["Service Scheduling & Provider Availability"])


def _build_appointment_out(appt: Appointment) -> AppointmentOut:
    out = AppointmentOut.model_validate(appt)
    if appt.provider:
        out.provider_name = appt.provider.full_name
    if appt.citizen:
        out.citizen_name = appt.citizen.email
    if appt.request:
        out.service_category = appt.request.service_category
    return out


# ==============================================================================
# PROVIDER AVAILABILITY CONFIGURATION ENDPOINTS
# ==============================================================================

@router.get(
    "/availability/me",
    status_code=status.HTTP_200_OK,
    summary="Get current provider's availability schedule and blocked dates",
    description="Returns weekly recurring schedule and blocked dates for authenticated provider."
)
def get_my_availability(
    current_user: User = Depends(require_provider),
    db: Session = Depends(get_db)
):
    provider = db.query(Provider).filter(Provider.user_id == current_user.id).first()
    if not provider:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Provider profile not found")

    seed_default_provider_schedule_if_empty(db, provider.id)

    schedules = db.query(ProviderAvailabilitySchedule).filter(
        ProviderAvailabilitySchedule.provider_id == provider.id
    ).order_by(ProviderAvailabilitySchedule.day_of_week, ProviderAvailabilitySchedule.start_time).all()

    blocked = db.query(ProviderBlockedDate).filter(
        ProviderBlockedDate.provider_id == provider.id
    ).order_by(ProviderBlockedDate.blocked_date.desc()).all()

    return {
        "provider_id": provider.id,
        "schedules": [ProviderScheduleSlotOut.model_validate(s) for s in schedules],
        "blocked_dates": [ProviderBlockedDateOut.model_validate(b) for b in blocked],
    }


@router.post(
    "/availability/schedule",
    response_model=List[ProviderScheduleSlotOut],
    status_code=status.HTTP_200_OK,
    summary="Configure provider weekly availability schedule",
    description="Saves recurring weekly availability slots for authenticated provider."
)
def save_my_schedule(
    schedule_in: ProviderAvailabilityScheduleInput,
    current_user: User = Depends(require_provider),
    db: Session = Depends(get_db)
) -> List[ProviderScheduleSlotOut]:
    provider = db.query(Provider).filter(Provider.user_id == current_user.id).first()
    if not provider:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Provider profile not found")

    db.query(ProviderAvailabilitySchedule).filter(
        ProviderAvailabilitySchedule.provider_id == provider.id
    ).delete()
    db.commit()

    saved = []
    for item in schedule_in.schedules:
        slot = ProviderAvailabilitySchedule(
            provider_id=provider.id,
            day_of_week=item.day_of_week,
            start_time=item.start_time,
            end_time=item.end_time,
            is_available=item.is_available,
        )
        db.add(slot)
        saved.append(slot)

    db.commit()
    for s in saved:
        db.refresh(s)

    log_audit(
        db=db,
        user_id=current_user.id,
        action="PROVIDER_AVAILABILITY_UPDATE",
        resource_type="provider",
        resource_id=provider.id,
        metadata_json={"slots_count": len(saved)}
    )

    return [ProviderScheduleSlotOut.model_validate(s) for s in saved]


@router.post(
    "/availability/blocked-dates",
    response_model=ProviderBlockedDateOut,
    status_code=status.HTTP_201_CREATED,
    summary="Add a blocked date for provider",
    description="Marks a specific calendar date as unavailable for provider appointments."
)
def add_blocked_date(
    blocked_in: ProviderBlockedDateInput,
    current_user: User = Depends(require_provider),
    db: Session = Depends(get_db)
) -> ProviderBlockedDateOut:
    provider = db.query(Provider).filter(Provider.user_id == current_user.id).first()
    if not provider:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Provider profile not found")

    existing = db.query(ProviderBlockedDate).filter(
        ProviderBlockedDate.provider_id == provider.id,
        ProviderBlockedDate.blocked_date == blocked_in.blocked_date
    ).first()
    if existing:
        return ProviderBlockedDateOut.model_validate(existing)

    blocked = ProviderBlockedDate(
        provider_id=provider.id,
        blocked_date=blocked_in.blocked_date,
        reason=blocked_in.reason,
    )
    db.add(blocked)
    db.commit()
    db.refresh(blocked)

    return ProviderBlockedDateOut.model_validate(blocked)


@router.delete(
    "/availability/blocked-dates/{blocked_id}",
    status_code=status.HTTP_200_OK,
    summary="Remove a blocked date for provider",
    description="Removes a blocked date restriction for authenticated provider."
)
def delete_blocked_date(
    blocked_id: int,
    current_user: User = Depends(require_provider),
    db: Session = Depends(get_db)
):
    provider = db.query(Provider).filter(Provider.user_id == current_user.id).first()
    if not provider:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Provider profile not found")

    blocked = db.query(ProviderBlockedDate).filter(
        ProviderBlockedDate.id == blocked_id,
        ProviderBlockedDate.provider_id == provider.id
    ).first()

    if not blocked:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Blocked date record not found")

    db.delete(blocked)
    db.commit()
    return {"detail": "Blocked date removed successfully"}


# ==============================================================================
# SLOT LOOKUP & APPOINTMENT BOOKING ENDPOINTS
# ==============================================================================

@router.get(
    "/available-slots",
    response_model=AvailableSlotsOut,
    status_code=status.HTTP_200_OK,
    summary="Check real provider availability slots for a target date",
    description="Returns available 30-minute time slots for provider on target date after excluding schedule blocks and existing booked appointments."
)
def query_available_slots(
    provider_id: int = Query(..., description="Target Provider ID"),
    date: str = Query(..., description="Target Date YYYY-MM-DD"),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
) -> AvailableSlotsOut:
    return get_provider_available_slots(db, provider_id, date)


@router.post(
    "/book",
    response_model=AppointmentOut,
    status_code=status.HTTP_201_CREATED,
    summary="Book an appointment with provider availability and double-booking validation",
    description="Validates provider availability and double-booking constraints before creating appointment request."
)
def book_appointment(
    appt_in: AppointmentCreate,
    current_user: User = Depends(require_citizen),
    db: Session = Depends(get_db)
) -> AppointmentOut:
    appt = validate_and_book_appointment(db, current_user.id, appt_in)
    return _build_appointment_out(appt)


# ==============================================================================
# APPOINTMENT DASHBOARD VISIBILITY & MANAGEMENT ENDPOINTS
# ==============================================================================

@router.get(
    "/provider/my-appointments",
    response_model=List[AppointmentOut],
    status_code=status.HTTP_200_OK,
    summary="Get current provider's upcoming and past appointments",
    description="Returns appointments for authenticated provider ordered chronologically. Provider IDOR isolated."
)
def get_provider_my_appointments(
    current_user: User = Depends(require_provider),
    db: Session = Depends(get_db)
) -> List[AppointmentOut]:
    provider = db.query(Provider).filter(Provider.user_id == current_user.id).first()
    if not provider:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Provider profile not found")

    appts = db.query(Appointment).filter(
        Appointment.provider_id == provider.id
    ).order_by(Appointment.slot_datetime.asc()).all()

    return [_build_appointment_out(a) for a in appts]


@router.get(
    "/citizen/my-appointments",
    response_model=List[AppointmentOut],
    status_code=status.HTTP_200_OK,
    summary="Get current citizen's requested and confirmed appointments",
    description="Returns appointments created by authenticated citizen."
)
def get_citizen_my_appointments(
    current_user: User = Depends(require_citizen),
    db: Session = Depends(get_db)
) -> List[AppointmentOut]:
    appts = db.query(Appointment).filter(
        Appointment.citizen_id == current_user.id
    ).order_by(Appointment.slot_datetime.asc()).all()

    return [_build_appointment_out(a) for a in appts]


@router.post(
    "/{appointment_id}/confirm",
    response_model=AppointmentOut,
    status_code=status.HTTP_200_OK,
    summary="Provider confirms an appointment request",
    description="Updates appointment status to CONFIRMED. Enforces provider ownership."
)
def confirm_appointment(
    appointment_id: int,
    current_user: User = Depends(require_provider),
    db: Session = Depends(get_db)
) -> AppointmentOut:
    provider = db.query(Provider).filter(Provider.user_id == current_user.id).first()
    if not provider:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Provider profile not found")

    appt = db.query(Appointment).filter(Appointment.id == appointment_id).first()
    if not appt:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Appointment not found")

    if appt.provider_id != provider.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied: You do not own this appointment.")

    appt.status = AppointmentStatus.CONFIRMED
    db.commit()
    db.refresh(appt)

    log_timeline_event(
        db=db,
        request_id=appt.request_id,
        event_type="APPOINTMENT_CONFIRMED",
        title=f"Appointment confirmed: {appt.purpose}",
        description=f"Confirmed for {appt.slot_datetime.strftime('%Y-%m-%d %H:%M')}",
        actor_id=current_user.id,
    )

    return _build_appointment_out(appt)


@router.post(
    "/{appointment_id}/decline",
    response_model=AppointmentOut,
    status_code=status.HTTP_200_OK,
    summary="Provider declines an appointment request",
    description="Updates appointment status to DECLINED with decline reason. Enforces provider ownership."
)
def decline_appointment(
    appointment_id: int,
    decline_in: AppointmentDeclineInput,
    current_user: User = Depends(require_provider),
    db: Session = Depends(get_db)
) -> AppointmentOut:
    provider = db.query(Provider).filter(Provider.user_id == current_user.id).first()
    if not provider:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Provider profile not found")

    appt = db.query(Appointment).filter(Appointment.id == appointment_id).first()
    if not appt:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Appointment not found")

    if appt.provider_id != provider.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied: You do not own this appointment.")

    appt.status = AppointmentStatus.DECLINED
    appt.decline_reason = decline_in.decline_reason.strip()
    db.commit()
    db.refresh(appt)

    log_timeline_event(
        db=db,
        request_id=appt.request_id,
        event_type="APPOINTMENT_DECLINED",
        title=f"Appointment declined: {appt.purpose}",
        description=f"Reason: {appt.decline_reason}",
        actor_id=current_user.id,
    )

    return _build_appointment_out(appt)


@router.post(
    "/{appointment_id}/cancel",
    response_model=AppointmentOut,
    status_code=status.HTTP_200_OK,
    summary="Cancel an appointment",
    description="Cancels an appointment slot. Access restricted to citizen owner, assigned provider, or admin."
)
def cancel_appointment(
    appointment_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
) -> AppointmentOut:
    appt = db.query(Appointment).filter(Appointment.id == appointment_id).first()
    if not appt:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Appointment not found")

    provider = db.query(Provider).filter(Provider.user_id == current_user.id).first()
    is_provider_owner = (provider and provider.id == appt.provider_id)
    is_citizen_owner = (current_user.id == appt.citizen_id)
    is_admin = (current_user.role == UserRole.ADMIN)

    if not (is_provider_owner or is_citizen_owner or is_admin):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied: You cannot cancel this appointment.")

    appt.status = AppointmentStatus.CANCELLED
    db.commit()
    db.refresh(appt)

    log_timeline_event(
        db=db,
        request_id=appt.request_id,
        event_type="APPOINTMENT_CANCELLED",
        title=f"Appointment cancelled: {appt.purpose}",
        actor_id=current_user.id,
    )

    return _build_appointment_out(appt)


# ==============================================================================
# LEGACY ENDPOINTS (Preserved for backwards compatibility)
# ==============================================================================

@router.get(
    "/request/{request_id}",
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
    return [_build_appointment_out(a) for a in appts]
