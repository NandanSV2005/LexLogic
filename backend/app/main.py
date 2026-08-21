from contextlib import asynccontextmanager
import logging
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError, HTTPException
from fastapi.openapi.utils import get_openapi
from app.core.config import settings
from app.db.database import init_db, SessionLocal
from app.services.provider_service import seed_default_provider_field_definitions
from app.api.routes.health import router as health_router
from app.api.router import api_router

logger = logging.getLogger("lexlogic")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: initialize database tables & seed default provider field definitions
    init_db()
    db = SessionLocal()
    try:
        seed_default_provider_field_definitions(db)
    finally:
        db.close()
    yield
    # Shutdown actions (if any)


app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="LexLogic Legal Services Marketplace Backend API - Role-based Authentication, Provider Onboarding, Matching Engine, Incentives, Secure Private Documents, and Security Audit Logs.",
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    lifespan=lifespan,
)

# Configure CORS for local development & specified origins
cors_origins = list(settings.CORS_ORIGINS) if settings.CORS_ORIGINS else ["*"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1)(:\d+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Security HTTP Headers Middleware
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    return response



# Include root health endpoint
app.include_router(health_router)

# Include aggregated API routers
app.include_router(api_router)


# -------------------------------------------------------------------
# Global Exception Handlers
# -------------------------------------------------------------------
@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail}
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    errors = []
    for err in exc.errors():
        field = " -> ".join([str(loc) for loc in err.get("loc", [])])
        msg = err.get("msg", "Invalid value")
        errors.append({"field": field, "message": msg})
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"detail": "Validation error in request body or parameters", "errors": errors}
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled exception on {request.method} {request.url.path}: {exc}", exc_info=True)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "Internal server error occurred. Please contact support."}
    )


# -------------------------------------------------------------------
# OpenAPI / Swagger UI Security Documentation Customization
# -------------------------------------------------------------------
def custom_openapi():
    if app.openapi_schema:
        return app.openapi_schema
    openapi_schema = get_openapi(
        title=app.title,
        version=app.version,
        description=app.description,
        routes=app.routes,
    )
    openapi_schema["components"]["securitySchemes"] = {
        "HTTPBearer": {
            "type": "http",
            "scheme": "bearer",
            "bearerFormat": "JWT",
            "description": "Enter your JWT token obtained from POST /api/auth/login or POST /api/auth/register."
        }
    }
    openapi_schema["security"] = [{"HTTPBearer": []}]
    app.openapi_schema = openapi_schema
    return app.openapi_schema


app.openapi = custom_openapi


@app.get("/", include_in_schema=False)
def root():
    return {
        "message": "Welcome to LexLogic API",
        "docs_url": "/docs",
        "health_url": "/health"
    }
