from typing import List, Dict, Any
from sqlalchemy.orm import Session
from app.models.provider import (
    Provider,
    ProviderType,
    ProviderFieldDefinition,
    ProviderFieldValue,
)
from app.models.points import PointAction
from app.services.points_service import award_points
from app.services.reliability_service import calculate_reliability_score


DEFAULT_FIELD_DEFINITIONS = [
    # ADVOCATE
    {
        "provider_type": ProviderType.ADVOCATE,
        "field_name": "practice_area",
        "field_label": "Practice Area(s)",
        "field_type": "text",
        "is_required": True,
    },
    {
        "provider_type": ProviderType.ADVOCATE,
        "field_name": "registration_details",
        "field_label": "Bar Council / Registration Details",
        "field_type": "text",
        "is_required": True,
    },
    # MEDIATOR
    {
        "provider_type": ProviderType.MEDIATOR,
        "field_name": "specialization",
        "field_label": "Mediation Specialization",
        "field_type": "text",
        "is_required": True,
    },
    {
        "provider_type": ProviderType.MEDIATOR,
        "field_name": "availability_schedule",
        "field_label": "Availability Schedule",
        "field_type": "text",
        "is_required": False,
    },
    # NOTARY
    {
        "provider_type": ProviderType.NOTARY,
        "field_name": "registration_details",
        "field_label": "Notary License / Registration Details",
        "field_type": "text",
        "is_required": True,
    },
    {
        "provider_type": ProviderType.NOTARY,
        "field_name": "service_type",
        "field_label": "Notary Services Offered",
        "field_type": "text",
        "is_required": True,
    },
    # DOCUMENT_WRITER
    {
        "provider_type": ProviderType.DOCUMENT_WRITER,
        "field_name": "document_types",
        "field_label": "Document Types Handled",
        "field_type": "text",
        "is_required": True,
    },
    # ARBITRATOR
    {
        "provider_type": ProviderType.ARBITRATOR,
        "field_name": "specialization",
        "field_label": "Arbitration Specialization",
        "field_type": "text",
        "is_required": True,
    },
    {
        "provider_type": ProviderType.ARBITRATOR,
        "field_name": "availability_schedule",
        "field_label": "Availability Schedule",
        "field_type": "text",
        "is_required": False,
    },
]


def seed_default_provider_field_definitions(db: Session) -> None:
    """Pre-populates default ProviderFieldDefinition entries for all provider types."""
    for def_data in DEFAULT_FIELD_DEFINITIONS:
        existing = db.query(ProviderFieldDefinition).filter(
            ProviderFieldDefinition.provider_type == def_data["provider_type"],
            ProviderFieldDefinition.field_name == def_data["field_name"]
        ).first()

        if not existing:
            field_def = ProviderFieldDefinition(
                provider_type=def_data["provider_type"],
                field_name=def_data["field_name"],
                field_label=def_data["field_label"],
                field_type=def_data["field_type"],
                is_required=def_data["is_required"],
            )
            db.add(field_def)
    db.commit()


def calculate_profile_completion(provider: Provider, db: Session) -> float:
    """Calculates profile completion percentage deterministically based on filled base fields + required provider fields."""
    # 1. Base required fields check (5 core fields)
    base_fields = [
        bool(provider.full_name and provider.full_name.strip()),
        bool(provider.phone and provider.phone.strip()),
        bool(provider.location and provider.location.strip()),
        bool(provider.bio and provider.bio.strip()),
        provider.experience_years > 0,
    ]
    base_filled = sum(1 for f in base_fields if f)
    base_total = len(base_fields)

    # 2. Provider-type-specific required fields check
    req_definitions = db.query(ProviderFieldDefinition).filter(
        ProviderFieldDefinition.provider_type == provider.provider_type,
        ProviderFieldDefinition.is_required == True
    ).all()

    req_defs_total = len(req_definitions)
    req_defs_filled = 0

    if req_defs_total > 0:
        req_def_ids = [d.id for d in req_definitions]
        filled_vals = db.query(ProviderFieldValue).filter(
            ProviderFieldValue.provider_id == provider.id,
            ProviderFieldValue.field_definition_id.in_(req_def_ids)
        ).all()

        for val in filled_vals:
            if val.value and val.value.strip():
                req_defs_filled += 1

    total_checks = base_total + req_defs_total
    total_filled = base_filled + req_defs_filled

    completion_pct = round((total_filled / total_checks) * 100.0, 1) if total_checks > 0 else 100.0
    
    # Update provider record attributes
    provider.profile_completion_percentage = completion_pct

    # Update reliability score
    calculate_reliability_score(provider)

    db.commit()
    db.refresh(provider)

    # Award points if 100% profile completion reached
    if provider.is_profile_complete:
        award_points(db, provider, PointAction.PROFILE_COMPLETED)

    return completion_pct


def update_provider_generic_fields(db: Session, provider: Provider, field_updates: List[Dict[str, str]]) -> None:
    """Upserts generic field values for a provider by field_name."""
    for item in field_updates:
        field_name = item.get("field_name")
        val_str = item.get("value")
        if not field_name:
            continue

        # Look up definition for this provider's type
        field_def = db.query(ProviderFieldDefinition).filter(
            ProviderFieldDefinition.provider_type == provider.provider_type,
            ProviderFieldDefinition.field_name == field_name
        ).first()

        if not field_def:
            field_def = ProviderFieldDefinition(
                provider_type=provider.provider_type,
                field_name=field_name,
                field_label=field_name.replace("_", " ").title(),
                field_type="text",
                is_required=False,
            )
            db.add(field_def)
            db.commit()
            db.refresh(field_def)

        # Upsert value record
        existing_val = db.query(ProviderFieldValue).filter(
            ProviderFieldValue.provider_id == provider.id,
            ProviderFieldValue.field_definition_id == field_def.id
        ).first()

        if existing_val:
            existing_val.value = val_str
        else:
            new_val = ProviderFieldValue(
                provider_id=provider.id,
                field_definition_id=field_def.id,
                value=val_str
            )
            db.add(new_val)

    db.commit()
