import os
import uuid
import re
from typing import Tuple
from fastapi import UploadFile, HTTPException, status
from app.core.config import settings

ALLOWED_EXTENSIONS = {".pdf", ".png", ".jpg", ".jpeg"}

ALLOWED_MIME_TYPES = {
    "application/pdf",
    "image/png",
    "image/jpeg",
    "image/jpg",
}

# Magic headers for true file format validation
MAGIC_HEADERS = {
    "pdf": [b"%PDF-"],
    "png": [b"\x89PNG\r\n\x1a\n"],
    "jpg": [b"\xff\xd8\xff"],
}


def sanitize_filename(filename: str) -> str:
    """Sanitizes raw client filename by stripping directory paths and invalid characters."""
    base_name = os.path.basename(filename)
    sanitized = re.sub(r"[^\w\.-]", "_", base_name)
    return sanitized or "document"


def validate_file_magic_bytes(content: bytes, ext: str) -> bool:
    """Validates actual file binary content against magic header bytes."""
    ext_clean = ext.lower().lstrip(".")
    if ext_clean in ("jpg", "jpeg"):
        key = "jpg"
    elif ext_clean == "png":
        key = "png"
    elif ext_clean == "pdf":
        key = "pdf"
    else:
        return False

    valid_headers = MAGIC_HEADERS.get(key, [])
    for header in valid_headers:
        if content.startswith(header):
            return True
    return False


def validate_and_save_upload_file(file: UploadFile, content: bytes) -> Tuple[str, str, int, str]:
    """Validates upload file size, extension, MIME type, and magic bytes, saving to private storage.
    
    Returns tuple: (storage_file_path, sanitized_filename, file_size_bytes, mime_type)
    """
    # 1. Size check
    file_size = len(content)
    if file_size > settings.MAX_UPLOAD_SIZE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File size exceeds maximum limit of {settings.MAX_UPLOAD_SIZE_BYTES // (1024 * 1024)}MB"
        )
    if file_size == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File content is empty"
        )

    # 2. Extension check
    filename = sanitize_filename(file.filename or "upload.bin")
    _, ext = os.path.splitext(filename)
    ext_lower = ext.lower()
    if ext_lower not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file extension '{ext_lower}'. Allowed: PDF, JPG, PNG"
        )

    # 3. MIME type check
    mime_type = file.content_type or "application/octet-stream"
    if mime_type.lower() not in ALLOWED_MIME_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file MIME type '{mime_type}'. Allowed: PDF, JPG, PNG"
        )

    # 4. Magic header byte check (prevents filename/MIME extension spoofing)
    if not validate_file_magic_bytes(content, ext_lower):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File binary headers do not match claimed file extension. Upload rejected."
        )

    # Ensure private storage directory exists
    storage_dir = settings.UPLOAD_STORAGE_DIR
    os.makedirs(storage_dir, exist_ok=True)

    # Generate unique UUID filename for internal disk storage
    storage_filename = f"{uuid.uuid4().hex}{ext_lower}"
    storage_path = os.path.join(storage_dir, storage_filename)

    # Save to private disk location
    with open(storage_path, "wb") as f:
        f.write(content)

    return storage_path, filename, file_size, mime_type
