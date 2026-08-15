from typing import Optional, Dict
from sqlalchemy.orm import Session
from app.models.provider import Provider
from app.models.points import PointTransaction, PointAction

# Configurable central points map
POINT_VALUES: Dict[PointAction, int] = {
    PointAction.PROFILE_COMPLETED: 20,
    PointAction.AVAILABILITY_ADDED: 10,
    PointAction.REQUEST_RESPONDED: 10,
    PointAction.SERVICE_COMPLETED: 20,
    PointAction.PRO_BONO_COMPLETED: 30,  # ELIGIBLE_PRO_BONO
}

# Actions that can only be awarded once per provider
ONE_TIME_ACTIONS = {
    PointAction.PROFILE_COMPLETED,
}


def award_points(
    db: Session,
    provider: Provider,
    action: PointAction,
    description: Optional[str] = None
) -> Optional[PointTransaction]:
    """Centralized service for awarding provider incentive points.
    
    Prevents duplicate awards for one-time actions and creates an audit transaction log.
    """
    points_to_add = POINT_VALUES.get(action, 0)
    if points_to_add <= 0:
        return None

    # Check for duplicate award if action is a one-time action
    if action in ONE_TIME_ACTIONS:
        existing_tx = db.query(PointTransaction).filter(
            PointTransaction.provider_id == provider.id,
            PointTransaction.action == action
        ).first()
        if existing_tx:
            return None  # Duplicate prevented

    # Construct default description if not provided
    action_desc = description or f"Awarded {points_to_add} points for {action.value.replace('_', ' ').title()}"

    # Create transaction log
    tx = PointTransaction(
        provider_id=provider.id,
        action=action,
        points=points_to_add,
        description=action_desc
    )
    db.add(tx)

    # Safely update provider total points
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
