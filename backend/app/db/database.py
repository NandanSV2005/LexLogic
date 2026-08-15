from typing import Generator
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from app.core.config import settings
from app.db.base import Base

# Configure engine. For SQLite, set check_same_thread to False for multithreaded access in FastAPI.
engine_args = {}
if settings.DATABASE_URL.startswith("sqlite"):
    engine_args["connect_args"] = {"check_same_thread": False}

engine = create_engine(settings.DATABASE_URL, **engine_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def init_db() -> None:
    """Initialize database tables automatically."""
    import app.models  # noqa: F401 - ensures all models register with Base.metadata
    Base.metadata.create_all(bind=engine)



def get_db() -> Generator[Session, None, None]:
    """Dependency injection helper for database sessions."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
