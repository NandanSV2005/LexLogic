from datetime import datetime, date, timedelta, timezone
from typing import List, Tuple, Optional
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.models.appointment import (
    Appointment,
    AppointmentStatus,
    ProviderAvailabilitySchedule,
    ProviderBlockedDate,
)
from app.models.provider import Provider
from app.models.request import ServiceRequest, InteractionStatus, RequestProvider
from app.schemas.appointment import AvailableSlotsOut, AppointmentCreate
from app.services.timeline_service import log_timeline_event
from app.services.audit import log_audit


DEFAULT_WEEKDAY_SCHEDULE = [
    (0, "09:00", "17:00"),  # Monday
    (1, "09:00", "17:00"),  # Tuesday
    (2, "09:00", "17:00"),  # Wednesday
    (3, "09:00", "17:00"),  # Thursday
    (4, "09:00", "17:00"),  # Friday
]


def seed_default_provider_schedule_if_empty(db: Session, provider_id: int):
    """Seeds default Mon-Fri 09:00-17:00 schedule if provider has not configured availability."""
    count = db.query(ProviderAvailabilitySchedule).filter(
        ProviderAvailabilitySchedule.provider_id == provider_id
    ).count()
    if count == 0:
        for day, start_t, end_t in DEFAULT_WEEKDAY_SCHEDULE:
            sched = ProviderAvailabilitySchedule(
                provider_id=provider_id,
                day_of_week=day,
                start_time=start_t,
                end_time=end_t,
                is_available=True,
            )
            db.add(sched)
        db.commit()


def get_provider_available_slots(
    db: Session,
    provider_id: int,
    target_date_str: str
) -> AvailableSlotsOut:
    """Calculates available 30-minute time slots for a provider on a target date."""
    try:
        dt_target = datetime.strptime(target_date_str, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid date format. Use YYYY-MM-DD."
        )

    day_of_week = dt_target.weekday()  # 0=Monday ... 6=Sunday

    # Check if date is blocked
    blocked = db.query(ProviderBlockedDate).filter(
        ProviderBlockedDate.provider_id == provider_id,
        ProviderBlockedDate.blocked_date == target_date_str
    ).first()

    if blocked:
        return AvailableSlotsOut(
            provider_id=provider_id,
            date=target_date_str,
            day_of_week=day_of_week,
            is_blocked=True,
            blocked_reason=blocked.reason or "Provider is unavailable on this date",
            available_slots=[]
        )

    seed_default_provider_schedule_if_empty(db, provider_id)

    schedules = db.query(ProviderAvailabilitySchedule).filter(
        ProviderAvailabilitySchedule.provider_id == provider_id,
        ProviderAvailabilitySchedule.day_of_week == day_of_week,
        ProviderAvailabilitySchedule.is_available == True
    ).all()

    if not schedules:
        return AvailableSlotsOut(
            provider_id=provider_id,
            date=target_date_str,
            day_of_week=day_of_week,
            is_blocked=False,
            available_slots=[]
        )

    # Generate 30-min candidate slots
    candidate_slots = []
    for sched in schedules:
        start_hour, start_min = map(int, sched.start_time.split(":"))
        end_hour, end_min = map(int, sched.end_time.split(":"))
        
        curr_dt = datetime.combine(dt_target, datetime.min.time()).replace(hour=start_hour, minute=start_min)
        end_dt = datetime.combine(dt_target, datetime.min.time()).replace(hour=end_hour, minute=end_min)

        while curr_dt + timedelta(minutes=30) <= end_dt:
            candidate_slots.append(curr_dt.strftime("%H:%M"))
            curr_dt += timedelta(minutes=30)

    # Query existing active appointments for target date
    start_of_day = datetime.combine(dt_target, datetime.min.time(), tzinfo=timezone.utc)
    end_of_day = start_of_day + timedelta(days=1)

    existing_apps = db.query(Appointment).filter(
        Appointment.provider_id == provider_id,
        Appointment.slot_datetime >= start_of_day,
        Appointment.slot_datetime < end_of_day,
        Appointment.status.in_([AppointmentStatus.REQUESTED, AppointmentStatus.CONFIRMED, AppointmentStatus.SCHEDULED])
    ).all()

    booked_slots = set()
    for app in existing_apps:
        # Convert slot_datetime to local HH:MM string
        slot_time_str = app.slot_datetime.strftime("%H:%M")
        booked_slots.add(slot_time_str)

    available_slots = [slot for slot in candidate_slots if slot not in booked_slots]

    return AvailableSlotsOut(
        provider_id=provider_id,
        date=target_date_str,
        day_of_week=day_of_week,
        is_blocked=False,
        available_slots=available_slots
    )


def validate_and_book_appointment(
    db: Session,
    citizen_user_id: int,
    appointment_in: AppointmentCreate
) -> Appointment:
    """Validates availability & double-booking prevention, then creates an appointment."""
    req = db.query(ServiceRequest).filter(ServiceRequest.id == appointment_in.request_id).first()
    if not req:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Service request not found")

    if req.citizen_id != citizen_user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to book appointments for this request"
        )

    provider = db.query(Provider).filter(Provider.id == appointment_in.provider_id).first()
    if not provider:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Provider profile not found")

    # Verify provider is connected to request
    interaction = db.query(RequestProvider).filter(
        RequestProvider.request_id == req.id,
        RequestProvider.provider_id == provider.id
    ).first()
    if not interaction:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Provider is not connected to this service request"
        )

    slot_dt = appointment_in.slot_datetime
    target_date_str = slot_dt.strftime("%Y-%m-%d")
    slot_time_str = slot_dt.strftime("%H:%M")

    # Check availability
    slots_info = get_provider_available_slots(db, provider.id, target_date_str)
    if slots_info.is_blocked:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Provider is unavailable: {slots_info.blocked_reason}"
        )

    if slot_time_str not in slots_info.available_slots:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Provider is unavailable at the selected time."
        )

    # Double-booking check with explicit query lock
    existing_conflict = db.query(Appointment).filter(
        Appointment.provider_id == provider.id,
        Appointment.slot_datetime == slot_dt,
        Appointment.status.in_([AppointmentStatus.REQUESTED, AppointmentStatus.CONFIRMED, AppointmentStatus.SCHEDULED])
    ).with_for_update().first()

    if existing_conflict:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Provider is already booked for this time slot. Please select another slot."
        )

    end_dt = slot_dt + timedelta(minutes=appointment_in.duration_minutes)

    app = Appointment(
        request_id=req.id,
        provider_id=provider.id,
        citizen_id=citizen_user_id,
        slot_datetime=slot_dt,
        end_datetime=end_dt,
        duration_minutes=appointment_in.duration_minutes,
        purpose=appointment_in.purpose.strip(),
        status=AppointmentStatus.REQUESTED,
        notes=appointment_in.notes.strip() if appointment_in.notes else None,
    )
    db.add(app)
    db.commit()
    db.refresh(app)

    # Log Timeline Event
    log_timeline_event(
        db=db,
        request_id=req.id,
        event_type="APPOINTMENT_REQUESTED",
        title=f"Appointment requested: {app.purpose}",
        description=f"Scheduled for {target_date_str} at {slot_time_str} with {provider.full_name}",
        actor_id=citizen_user_id,
    )

    log_audit(
        db=db,
        user_id=citizen_user_id,
        action="APPOINTMENT_CREATE",
        resource_type="appointment",
        resource_id=app.id,
        metadata_json={
            "request_id": req.id,
            "provider_id": provider.id,
            "slot_datetime": slot_dt.isoformat(),
        }
    )

    return app
