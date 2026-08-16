import json
from typing import List, Optional, Union
from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    PROJECT_NAME: str = "LexLogic API"
    VERSION: str = "0.1.0"
    API_V1_STR: str = "/api"
    ENVIRONMENT: str = "development"

    DATABASE_URL: str = "sqlite:///./lexlogic.db"
    DATABASE_PATH: Optional[str] = None

    JWT_SECRET: str = "lexlogic_dev_secret_key_change_in_production_987654321"
    JWT_SECRET_KEY: Optional[str] = None
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

    CORS_ORIGINS: Union[List[str], str] = [
        "http://localhost:3000",
        "http://localhost:5173",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",
    ]

    UPLOAD_STORAGE_DIR: str = "storage/documents"
    PRIVATE_UPLOAD_DIR: Optional[str] = None
    MAX_UPLOAD_SIZE_BYTES: int = 10 * 1024 * 1024  # 10 MB default limit

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> List[str]:
        if isinstance(v, str) and not v.startswith("["):
            return [i.strip() for i in v.split(",") if i.strip()]
        elif isinstance(v, str) and v.startswith("["):
            return json.loads(v)
        elif isinstance(v, list):
            return v
        raise ValueError(v)

    @model_validator(mode="after")
    def resolve_aliases_and_environments(self) -> "Settings":
        # Resolve JWT_SECRET from JWT_SECRET_KEY if provided
        if self.JWT_SECRET_KEY:
            self.JWT_SECRET = self.JWT_SECRET_KEY

        # Enforce non-default JWT secret in production
        if self.ENVIRONMENT.lower() == "production":
            if self.JWT_SECRET == "lexlogic_dev_secret_key_change_in_production_987654321":
                raise ValueError("In production mode, JWT_SECRET or JWT_SECRET_KEY must be set to a secure non-default key!")

        # Resolve DATABASE_URL from DATABASE_PATH if DATABASE_PATH is provided
        if self.DATABASE_PATH:
            path_str = self.DATABASE_PATH.replace("\\", "/")
            if not path_str.startswith("sqlite:///"):
                self.DATABASE_URL = f"sqlite:///{path_str}"
            else:
                self.DATABASE_URL = path_str

        # Resolve UPLOAD_STORAGE_DIR from PRIVATE_UPLOAD_DIR if provided
        if self.PRIVATE_UPLOAD_DIR:
            self.UPLOAD_STORAGE_DIR = self.PRIVATE_UPLOAD_DIR

        return self

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore"
    )


settings = Settings()

