from typing import Optional
from datetime import datetime
from pydantic import BaseModel, EmailStr, ConfigDict, Field
from app.models.user import UserRole


class UserRegister(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=6, description="User password (at least 6 chars)")
    role: UserRole = Field(default=UserRole.CITIZEN, description="User role (CITIZEN or PROVIDER)")
    full_name: Optional[str] = Field(default=None, description="Full name (recommended for Providers)")


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: EmailStr
    role: UserRole
    is_active: bool
    created_at: datetime


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class TokenData(BaseModel):
    sub: Optional[str] = None
    role: Optional[UserRole] = None
