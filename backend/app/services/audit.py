from typing import Optional, Dict, Any
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from app.models.audit import AuditLog

# Standard Audit Actions
ACTION_USER_REGISTERED = "USER_REGISTERED"
ACTION_USER_LOGIN = "USER_LOGIN"
ACTION_PROFILE_CREATED = "PROFILE_CREATED"
ACTION_PROFILE_UPDATED = "PROFILE_UPDATED"
ACTION_VERIFICATION_SUBMITTED = "VERIFICATION_SUBMITTED"
ACTION_VERIFICATION_UPDATED = "VERIFICATION_UPDATED"
ACTION_REQUEST_CREATED = "REQUEST_CREATED"
ACTION_REQUEST_RESPONDED = "REQUEST_RESPONDED"
ACTION_REQUEST_COMPLETED = "REQUEST_COMPLETED"
ACTION_DOCUMENT_UPLOADED = "DOCUMENT_UPLOADED"
ACTION_DOCUMENT_VIEWED = "DOCUMENT_VIEWED"
ACTION_DOCUMENT_SHARED = "DOCUMENT_SHARED"
ACTION_DOCUMENT_REVOKED = "DOCUMENT_REVOKED"
ACTION_DOCUMENT_ACCESS_DENIED = "DOCUMENT_ACCESS_DENIED"

PROHIBITED_METADATA_KEYS = {
    "password", "password_hash", "token", "access_token",
    "secret", "content", "document_content", "file_data"
}


def sanitize_metadata(metadata: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    """Sanitizes metadata dictionary to ensure sensitive fields are NEVER written to audit records."""
    if not metadata:
        return None

    clean_metadata = {}
    for k, v in metadata.items():
        if k.lower() in PROHIBITED_METADATA_KEYS:
            continue
        clean_metadata[k] = v
    return clean_metadata


def log_audit(
    db: Session,
    user_id: Optional[int],
    action: str,
    resource_type: Optional[str] = None,
    resource_id: Optional[int] = None,
    metadata_json: Optional[Dict[str, Any]] = None
) -> AuditLog:
    """Centralized security audit logging service.
    
    Creates a immutable audit record with UTC timestamp and sanitized metadata.
    """
    clean_meta = sanitize_metadata(metadata_json)

    audit_entry = AuditLog(
        user_id=user_id,
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        timestamp=datetime.now(timezone.utc),
        metadata_json=clean_meta
    )
    db.add(audit_entry)
    db.commit()
    db.refresh(audit_entry)
    return audit_entry
