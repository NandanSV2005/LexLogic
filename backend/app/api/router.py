from fastapi import APIRouter
from app.api.routes import (
    auth_router,
    providers_router,
    citizens_router,
    requests_router,
    matching_router,
    documents_router,
    audit_router,
)

api_router = APIRouter(prefix="/api")

api_router.include_router(auth_router)
api_router.include_router(providers_router)
api_router.include_router(citizens_router)
api_router.include_router(requests_router)
api_router.include_router(matching_router)
api_router.include_router(documents_router)
api_router.include_router(audit_router)
