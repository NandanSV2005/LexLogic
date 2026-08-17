import os
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.api.deps import get_current_active_user
from app.models.user import User, UserRole
from app.models.provider import Provider
from app.models.document import Document, DocumentVisibility, DocumentShare, DocumentShareStatus
from app.schemas.document import DocumentOut, DocumentShareCreate, DocumentShareRevoke, DocumentShareOut
from app.services.document_storage import validate_and_save_upload_file
from app.services.audit import log_audit

router = APIRouter(prefix="/documents", tags=["Secure Private Documents"])


@router.post(
    "/upload",
    response_model=DocumentOut,
    status_code=status.HTTP_201_CREATED,
    summary="Upload secure private document (alias)",
    description="Uploads PDF, JPG, or PNG document. owner_id is bound strictly to the authenticated user. File is stored in private disk storage."
)
@router.post(
    "",
    response_model=DocumentOut,
    status_code=status.HTTP_201_CREATED,
    summary="Upload secure private document",
    description="Uploads PDF, JPG, or PNG document. owner_id is bound strictly to the authenticated user. File is stored in private disk storage."
)

async def upload_document(
    file: UploadFile = File(...),
    title: Optional[str] = Form(None),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
) -> DocumentOut:
    content = await file.read()
    storage_path, sanitized_filename, file_size, mime_type = validate_and_save_upload_file(file, content)

    doc_title = title or sanitized_filename

    doc = Document(
        owner_id=current_user.id,
        title=doc_title,
        filename=sanitized_filename,
        file_path=storage_path,
        file_size_bytes=file_size,
        mime_type=mime_type,
        visibility=DocumentVisibility.PRIVATE,
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)

    log_audit(
        db=db,
        user_id=current_user.id,
        action="DOCUMENT_UPLOAD",
        resource_type="document",
        resource_id=doc.id,
        metadata_json={"file_size": file_size, "mime_type": mime_type}
    )

    return doc


@router.get(
    "/me",
    response_model=List[DocumentOut],
    status_code=status.HTTP_200_OK,
    summary="Get user's private & shared documents",
    description="Returns documents owned by or actively shared with the current user."
)
def get_my_documents(
    skip: int = 0,
    limit: int = 50,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
) -> List[DocumentOut]:
    owned_docs = db.query(Document).filter(Document.owner_id == current_user.id).all()

    shared_docs = []
    if current_user.role == UserRole.PROVIDER:
        provider = db.query(Provider).filter(Provider.user_id == current_user.id).first()
        if provider:
            active_shares = db.query(DocumentShare).filter(
                DocumentShare.shared_with_provider_id == provider.id,
                DocumentShare.status == DocumentShareStatus.ACTIVE
            ).all()
            shared_doc_ids = [s.document_id for s in active_shares]
            if shared_doc_ids:
                shared_docs = db.query(Document).filter(Document.id.in_(shared_doc_ids)).all()

    all_docs = list({d.id: d for d in (owned_docs + shared_docs)}.values())
    all_docs.sort(key=lambda d: d.created_at, reverse=True)
    return all_docs[skip : skip + limit]




@router.get(
    "/{document_id}",
    status_code=status.HTTP_200_OK,
    summary="Stream private document download with authorization",
    description="Serves document file download after strict RBAC authorization. Unauthorized or revoked access attempts return 403 Forbidden."
)
def download_document(
    document_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        log_audit(
            db=db,
            user_id=current_user.id,
            action="DOCUMENT_DENIED_ACCESS",
            resource_type="document",
            resource_id=document_id,
            metadata_json={"reason": "not_found"}
        )
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    is_authorized = False
    reason = "unauthorized"

    # 1. Owner access
    if doc.owner_id == current_user.id:
        is_authorized = True

    # 2. Admin access
    elif current_user.role == UserRole.ADMIN:
        is_authorized = True

    # 3. Provider explicit share check
    elif current_user.role == UserRole.PROVIDER:
        provider = db.query(Provider).filter(Provider.user_id == current_user.id).first()
        if provider:
            share = db.query(DocumentShare).filter(
                DocumentShare.document_id == doc.id,
                DocumentShare.shared_with_provider_id == provider.id
            ).first()

            if share:
                if share.status == DocumentShareStatus.ACTIVE:
                    is_authorized = True
                else:
                    reason = "access_revoked"
            else:
                reason = "not_shared"

    if not is_authorized:
        log_audit(
            db=db,
            user_id=current_user.id,
            action="DOCUMENT_DENIED_ACCESS",
            resource_type="document",
            resource_id=doc.id,
            metadata_json={"reason": reason}
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have authorization to access this private document"
        )

    if not os.path.exists(doc.file_path):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Physical document file missing from storage")

    log_audit(
        db=db,
        user_id=current_user.id,
        action="DOCUMENT_VIEW",
        resource_type="document",
        resource_id=doc.id,
        metadata_json={"mime_type": doc.mime_type}
    )

    return FileResponse(
        path=doc.file_path,
        filename=doc.filename,
        media_type=doc.mime_type
    )


@router.post(
    "/{document_id}/share",
    response_model=DocumentShareOut,
    status_code=status.HTTP_200_OK,
    summary="Share document with provider",
    description="Owner explicitly grants document access to a provider. Sets share status ACTIVE."
)
def share_document(
    document_id: int,
    share_in: DocumentShareCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
) -> DocumentShareOut:
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    # Only document owner can share
    if doc.owner_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the document owner can share access to this document"
        )

    provider = db.query(Provider).filter(Provider.id == share_in.provider_id).first()
    if not provider:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Target provider not found")

    share = db.query(DocumentShare).filter(
        DocumentShare.document_id == doc.id,
        DocumentShare.shared_with_provider_id == provider.id
    ).first()

    if share:
        share.status = DocumentShareStatus.ACTIVE
    else:
        share = DocumentShare(
            document_id=doc.id,
            shared_with_provider_id=provider.id,
            status=DocumentShareStatus.ACTIVE
        )
        db.add(share)

    doc.visibility = DocumentVisibility.SHARED
    db.commit()
    db.refresh(share)
    db.refresh(doc)

    log_audit(
        db=db,
        user_id=current_user.id,
        action="DOCUMENT_SHARE",
        resource_type="document",
        resource_id=doc.id,
        metadata_json={"provider_id": provider.id, "share_status": DocumentShareStatus.ACTIVE.value}
    )

    return share


@router.post(
    "/{document_id}/revoke",
    response_model=DocumentShareOut,
    status_code=status.HTTP_200_OK,
    summary="Revoke document access from provider",
    description="Owner revokes document access from a provider. Sets share status REVOKED."
)
def revoke_document(
    document_id: int,
    revoke_in: DocumentShareRevoke,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
) -> DocumentShareOut:
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    # Only document owner can revoke
    if doc.owner_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the document owner can revoke access to this document"
        )

    share = db.query(DocumentShare).filter(
        DocumentShare.document_id == doc.id,
        DocumentShare.shared_with_provider_id == revoke_in.provider_id
    ).first()

    if not share:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No active share grant found for this provider")

    share.status = DocumentShareStatus.REVOKED
    db.commit()

    # Check if any active shares remain
    active_remaining = db.query(DocumentShare).filter(
        DocumentShare.document_id == doc.id,
        DocumentShare.status == DocumentShareStatus.ACTIVE
    ).count()

    if active_remaining == 0:
        doc.visibility = DocumentVisibility.REVOKED

    db.commit()
    db.refresh(share)
    db.refresh(doc)

    log_audit(
        db=db,
        user_id=current_user.id,
        action="DOCUMENT_REVOKE",
        resource_type="document",
        resource_id=doc.id,
        metadata_json={"provider_id": revoke_in.provider_id, "share_status": DocumentShareStatus.REVOKED.value}
    )

    return share
