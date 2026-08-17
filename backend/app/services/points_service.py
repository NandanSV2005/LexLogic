from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Set
from sqlalchemy.orm import Session
from app.models.provider import Provider, ProviderType
from app.models.points import PointTransaction, PointAction

# Centralized Incentive Rule Map
INCENTIVE_RULES: Dict[PointAction, int] = {
    PointAction.PROFILE_COMPLETED: 20,
    PointAction.AVAILABILITY_ADDED: 10,
    PointAction.REQUEST_RESPONDED: 10,
    PointAction.SERVICE_COMPLETED: 20,
    PointAction.PRO_BONO_COMPLETED: 30,
}

# Alias for backward compatibility
POINT_VALUES = INCENTIVE_RULES

# Professional Activity Matrix per Provider Type
VALID_ACTIVITIES_PER_PROVIDER_TYPE: Dict[ProviderType, Set[PointAction]] = {
    ProviderType.ADVOCATE: {
        PointAction.PROFILE_COMPLETED,
        PointAction.AVAILABILITY_ADDED,
        PointAction.REQUEST_RESPONDED,
        PointAction.SERVICE_COMPLETED,
        PointAction.PRO_BONO_COMPLETED,
    },
    ProviderType.MEDIATOR: {
        PointAction.PROFILE_COMPLETED,
        PointAction.AVAILABILITY_ADDED,
        PointAction.REQUEST_RESPONDED,
        PointAction.SERVICE_COMPLETED,
        PointAction.PRO_BONO_COMPLETED,
    },
    ProviderType.ARBITRATOR: {
        PointAction.PROFILE_COMPLETED,
        PointAction.AVAILABILITY_ADDED,
        PointAction.REQUEST_RESPONDED,
        PointAction.SERVICE_COMPLETED,
    },
    ProviderType.NOTARY: {
        PointAction.PROFILE_COMPLETED,
        PointAction.AVAILABILITY_ADDED,
        PointAction.REQUEST_RESPONDED,
        PointAction.SERVICE_COMPLETED,
    },
    ProviderType.DOCUMENT_WRITER: {
        PointAction.PROFILE_COMPLETED,
        PointAction.AVAILABILITY_ADDED,
        PointAction.REQUEST_RESPONDED,
        PointAction.SERVICE_COMPLETED,
    },
}


def is_activity_valid_for_provider_type(provider_type: ProviderType, action: PointAction) -> bool:
    """Validates if the activity is professional & valid for the specified provider type."""
    allowed_actions = VALID_ACTIVITIES_PER_PROVIDER_TYPE.get(provider_type, set())
    return action in allowed_actions


def award_points(
    db: Session,
    provider: Provider,
    action: PointAction,
    reference_id: Optional[int] = None,
    description: Optional[str] = None
) -> Optional[PointTransaction]:
    """Centralized service for awarding provider incentive points.
    
    Enforces:
    1. Provider-Type Activity Validation
    2. Backend Anti-Abuse & Duplicate Award Protection
    3. Traceable PointTransaction Ledger logging
    """
    # 1. Check if activity is valid for provider's profession
    if not is_activity_valid_for_provider_type(provider.provider_type, action):
        return None

    points_to_add = INCENTIVE_RULES.get(action, 0)
    if points_to_add <= 0:
        return None

    # 2. Duplicate Award Protection
    # A. One-time action: Profile Completion
    if action == PointAction.PROFILE_COMPLETED:
        existing_tx = db.query(PointTransaction).filter(
            PointTransaction.provider_id == provider.id,
            PointTransaction.action == action
        ).first()
        if existing_tx:
            return None  # Duplicate profile completion reward prevented

    # B. Request Response: Unique per (provider_id, request_id)
    elif action == PointAction.REQUEST_RESPONDED:
        if reference_id is not None:
            existing_tx = db.query(PointTransaction).filter(
                PointTransaction.provider_id == provider.id,
                PointTransaction.action == action,
                PointTransaction.reference_id == reference_id
            ).first()
            if existing_tx:
                return None  # Duplicate request response reward prevented

    # C. Service Completion / Pro-Bono Completion: Unique per (provider_id, request_id, action)
    elif action in (PointAction.SERVICE_COMPLETED, PointAction.PRO_BONO_COMPLETED):
        if reference_id is not None:
            existing_tx = db.query(PointTransaction).filter(
                PointTransaction.provider_id == provider.id,
                PointTransaction.action == action,
                PointTransaction.reference_id == reference_id
            ).first()
            if existing_tx:
                return None  # Duplicate service completion reward prevented


    # D. Availability Update Anti-Spam: 24h cooldown to prevent toggle spamming
    elif action == PointAction.AVAILABILITY_ADDED:
        twenty_four_hours_ago = datetime.now(timezone.utc) - timedelta(hours=24)
        recent_tx = db.query(PointTransaction).filter(
            PointTransaction.provider_id == provider.id,
            PointTransaction.action == action,
            PointTransaction.created_at >= twenty_four_hours_ago
        ).first()
        if recent_tx:
            return None  # Availability spam reward prevented

    # 3. Construct default description
    action_desc = description or f"Awarded {points_to_add} points for {action.value.replace('_', ' ').title()}"

    # 4. Create Point Transaction Ledger record
    tx = PointTransaction(
        provider_id=provider.id,
        action=action,
        points=points_to_add,
        reference_id=reference_id,
        description=action_desc
    )
    db.add(tx)

    # 5. Safely update provider total points balance
    provider.points += points_to_add

    db.commit()
    db.refresh(tx)
    db.refresh(provider)

    return tx


def sync_provider_total_points(db: Session, provider: Provider) -> int:
    """Recalculates and synchronizes provider total points directly from transaction history."""
    transactions = db.query(PointTransaction).filter(
        PointTransaction.provider_id == provider.id
    ).all()

    total = sum(tx.points for tx in transactions)
    provider.points = total
    db.commit()
    db.refresh(provider)
    return total
