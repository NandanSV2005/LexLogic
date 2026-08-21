from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field
from app.models.document import DocumentVisibility, DocumentShareStatus, DocumentSharePermission


class DocumentShareOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    document_id: int
    shared_with_provider_id: int
    status: DocumentShareStatus
    permission: DocumentSharePermission
    created_at: datetime
    updated_at: datetime


class DocumentOut(BaseModel):
    """Document output metadata schema.
    
    CRITICAL SECURITY RULE: Hides private disk file_path from all API client responses.
    """
    model_config = ConfigDict(from_attributes=True)

    id: int
    owner_id: int
    request_id: Optional[int] = None
    parent_document_id: Optional[int] = None
    version_number: int = 1
    title: str
    filename: str
    file_size_bytes: int
    mime_type: str
    visibility: DocumentVisibility
    request_note: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    shares: Optional[List[DocumentShareOut]] = None
    current_user_permission: Optional[DocumentSharePermission] = None


class DocumentShareCreate(BaseModel):
    provider_id: int = Field(..., description="ID of the provider to grant document access to")
    permission: DocumentSharePermission = Field(
        default=DocumentSharePermission.VIEW,
        description="Access level: VIEW (View-Only default) or VIEW_AND_DOWNLOAD"
    )


class DocumentShareRevoke(BaseModel):
    provider_id: int = Field(..., description="ID of the provider to revoke document access from")


class DocumentPrivacyItemOut(BaseModel):
    document_id: int
    title: str
    filename: str
    visibility: DocumentVisibility
    provider_id: Optional[int] = None
    provider_name: Optional[str] = None
    share_status: Optional[DocumentShareStatus] = None
    permission: Optional[DocumentSharePermission] = None


class PrivacySummaryOut(BaseModel):
    request_id: int
    citizen_id: int
    items: List[DocumentPrivacyItemOut]
