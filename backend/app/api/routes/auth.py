from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.core.security import get_password_hash, verify_password, create_access_token
from app.api.deps import get_current_active_user
from app.models.user import User, UserRole
from app.models.provider import Provider, ProviderType, VerificationStatus, AvailabilityStatus
from app.schemas.auth import UserRegister, UserLogin, UserOut, Token
from app.services.audit import log_audit

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post(
    "/register",
    response_model=UserOut,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new user account (Citizen or Provider)",
    description="Registers a new Citizen or Provider user account. Public registration as ADMIN is prohibited."
)
def register(
    user_in: UserRegister,
    db: Session = Depends(get_db)
) -> UserOut:
    # 1. Prohibit public registration as ADMIN
    if user_in.role == UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Public registration as ADMIN is prohibited. Admin accounts must be created through admin provisioning."
        )

    # 2. Check for duplicate email
    existing_user = db.query(User).filter(User.email == user_in.email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email is already registered"
        )

    # 3. Create user with bcrypt password hash
    password_hash = get_password_hash(user_in.password)
    user = User(
        email=user_in.email,
        password_hash=password_hash,
        role=user_in.role,
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    # 4. If registering as a Provider, automatically instantiate default ProviderProfile
    if user.role == UserRole.PROVIDER:
        display_name = user_in.full_name or user.email.split("@")[0].capitalize()
        provider_profile = Provider(
            user_id=user.id,
            provider_type=ProviderType.ADVOCATE,
            full_name=display_name,
            verification_status=VerificationStatus.PENDING,
            availability_status=AvailabilityStatus.AVAILABLE,
        )
        db.add(provider_profile)
        db.commit()

    # 5. Audit log event
    log_audit(
        db=db,
        user_id=user.id,
        action="USER_REGISTER",
        resource_type="user",
        resource_id=user.id,
        metadata_json={"role": user.role.value, "email": user.email}
    )

    return user


@router.post(
    "/login",
    response_model=Token,
    status_code=status.HTTP_200_OK,
    summary="User login with JSON payload",
    description="Authenticates user credentials using JSON body and returns a JWT access token."
)
def login(
    login_data: UserLogin,
    db: Session = Depends(get_db)
) -> Token:
    user = db.query(User).filter(User.email == login_data.email).first()
    if not user or not verify_password(login_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Inactive user account"
        )

    # Issue JWT token
    access_token = create_access_token(
        subject=user.id,
        custom_claims={"email": user.email, "role": user.role.value}
    )

    # Audit log event
    log_audit(
        db=db,
        user_id=user.id,
        action="USER_LOGIN",
        resource_type="user",
        resource_id=user.id,
        metadata_json={"role": user.role.value}
    )

    return Token(
        access_token=access_token,
        token_type="bearer",
        user=user
    )


@router.post(
    "/login/form",
    response_model=Token,
    status_code=status.HTTP_200_OK,
    include_in_schema=False,
    summary="User login with OAuth2 Form payload for Swagger UI"
)
def login_form(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
) -> Token:
    user = db.query(User).filter(User.email == form_data.username).first()
    if not user or not verify_password(form_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Inactive user account"
        )

    access_token = create_access_token(
        subject=user.id,
        custom_claims={"email": user.email, "role": user.role.value}
    )

    return Token(
        access_token=access_token,
        token_type="bearer",
        user=user
    )


@router.get(
    "/me",
    response_model=UserOut,
    status_code=status.HTTP_200_OK,
    summary="Get current user details",
    description="Returns profile details of the currently authenticated user."
)
def get_me(
    current_user: User = Depends(get_current_active_user)
) -> UserOut:
    return current_user
