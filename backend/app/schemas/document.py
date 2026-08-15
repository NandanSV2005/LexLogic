from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field
from app.models.document import DocumentVisibility, DocumentShareStatus


class DocumentOut(BaseModel):
    """Document output metadata schema.
    
    CRITICAL SECURITY RULE: Hides private disk file_path from all API client responses.
    """
    model_config = ConfigDict(from_attributes=True)

    id: int
    owner_id: int
    title: str
    filename: str
    file_size_bytes: int
    mime_type: str
    visibility: DocumentVisibility
    created_at: datetime
    updated_at: datetime


class DocumentShareCreate(BaseModel):
    provider_id: int = Field(..., description="ID of the provider to grant document access to")


class DocumentShareRevoke(BaseModel):
    provider_id: int = Field(..., description="ID of the provider to revoke document access from")


class DocumentShareOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    document_id: int
    shared_with_provider_id: int
    status: DocumentShareStatus
    created_at: datetime
    updated_at: datetime
