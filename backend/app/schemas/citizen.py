from pydantic import BaseModel, EmailStr, ConfigDict


class CitizenProfileOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: EmailStr
    full_name: str
    is_active: bool

