from app.api.routes.health import router as health_router
from app.api.routes.auth import router as auth_router
from app.api.routes.providers import router as providers_router
from app.api.routes.citizens import router as citizens_router
from app.api.routes.requests import router as requests_router
from app.api.routes.matching import router as matching_router
from app.api.routes.documents import router as documents_router
from app.api.routes.audit import router as audit_router

__all__ = [
    "health_router",
    "auth_router",
    "providers_router",
    "citizens_router",
    "requests_router",
    "matching_router",
    "documents_router",
    "audit_router",
]
