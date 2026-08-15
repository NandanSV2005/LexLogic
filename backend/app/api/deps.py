from typing import List, Callable
from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.security import oauth2_scheme, decode_access_token
from app.db.database import get_db
from app.models.user import User, UserRole


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
) -> User:
    """Validate JWT access token and return currently authenticated user."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    payload = decode_access_token(token)
    if payload is None:
        raise credentials_exception

    user_id: str | None = payload.get("sub")
    if user_id is None:
        raise credentials_exception

    try:
        user_id_int = int(user_id)
    except ValueError:
        raise credentials_exception

    user = db.query(User).filter(User.id == user_id_int).first()
    if user is None:
        raise credentials_exception

    return user


def get_current_active_user(
    current_user: User = Depends(get_current_user)
) -> User:
    """Ensure authenticated user account is active."""
    if not current_user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Inactive user account"
        )
    return current_user


def require_role(allowed_roles: List[UserRole]) -> Callable:
    """Factory dependency enforcing Role-Based Access Control (RBAC)."""
    def role_checker(current_user: User = Depends(get_current_active_user)) -> User:
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"User role '{current_user.role.value}' does not have permission to access this resource"
            )
        return current_user
    return role_checker


# Convenient role-specific dependencies
require_citizen = require_role([UserRole.CITIZEN])
require_provider = require_role([UserRole.PROVIDER])
require_admin = require_role([UserRole.ADMIN])
