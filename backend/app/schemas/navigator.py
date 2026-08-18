from pydantic import BaseModel, Field
from app.models.provider import ProviderType


class NavigatorInput(BaseModel):
    description: str = Field(..., description="Natural language description of legal problem or service need")


class NavigatorOutput(BaseModel):
    service_category: str
    preferred_provider_type: ProviderType
    summary_context: str
    disclaimer: str = "LexLogic helps identify the type of service you may need. This is not legal advice."
