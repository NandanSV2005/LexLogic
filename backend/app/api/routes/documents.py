import os
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form, Query
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.api.deps import get_current_active_user
from app.models.user import User, UserRole
from app.models.provider import Provider
from app.models.document import Document, DocumentVisibility, DocumentShare, DocumentShareStatus, DocumentSharePermission
from app.schemas.document import DocumentOut, DocumentShareCreate, DocumentShareRevoke, DocumentShareOut
from app.services.document_storage import validate_and_save_upload_file
from app.core.rate_limiter import check_upload_rate_limit
from app.services.audit import log_audit

router = APIRouter(prefix="/documents", tags=["Secure Private Documents"])


@router.post(
    "/upload",
    response_model=DocumentOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(check_upload_rate_limit)],
    summary="Upload secure private document (alias)",
    description="Uploads PDF, JPG, or PNG document. owner_id is bound strictly to the authenticated user. File is stored in private disk storage."
)
@router.post(
    "",
    response_model=DocumentOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(check_upload_rate_limit)],
    summary="Upload secure private document",
    description="Uploads PDF, JPG, or PNG document. owner_id is bound strictly to the authenticated user. File is stored in private disk storage."
)
async def upload_document(
    file: UploadFile = File(...),
    title: Optional[str] = Form(None),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
) -> Document:
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
    provider_perm_map = {}
    if current_user.role == UserRole.PROVIDER:
        provider = db.query(Provider).filter(Provider.user_id == current_user.id).first()
        if provider:
            active_shares = db.query(DocumentShare).filter(
                DocumentShare.shared_with_provider_id == provider.id,
                DocumentShare.status == DocumentShareStatus.ACTIVE
            ).all()
            for s in active_shares:
                provider_perm_map[s.document_id] = s.permission
            shared_doc_ids = list(provider_perm_map.keys())
            if shared_doc_ids:
                shared_docs = db.query(Document).filter(Document.id.in_(shared_doc_ids)).all()

    all_docs = list({d.id: d for d in (owned_docs + shared_docs)}.values())
    all_docs.sort(key=lambda d: d.created_at, reverse=True)
    sliced_docs = all_docs[skip : skip + limit]

    res = []
    for doc in sliced_docs:
        out = DocumentOut.model_validate(doc)
        if doc.owner_id == current_user.id:
            out.shares = [DocumentShareOut.model_validate(s) for s in doc.shares]
        elif doc.id in provider_perm_map:
            out.current_user_permission = provider_perm_map[doc.id]
        res.append(out)

    return res


@router.get(
    "/{document_id}",
    status_code=status.HTTP_200_OK,
    summary="Stream private document view or download with fine-grained permission authorization",
    description="Serves document file stream after strict RBAC & permission authorization (VIEW vs VIEW_AND_DOWNLOAD)."
)
def download_document(
    document_id: int,
    download: bool = Query(False, description="Set True for download attachment mode, False for inline view mode"),
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
                    if download and share.permission != DocumentSharePermission.VIEW_AND_DOWNLOAD:
                        reason = "download_permission_required"
                    else:
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
            metadata_json={"reason": reason, "attempted_download": download}
        )
        if reason == "download_permission_required":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Download access permission required. The citizen has granted View-Only access to this document."
            )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have authorization to access this private document"
        )

    if not os.path.exists(doc.file_path):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Physical document file missing from storage")

    action_label = "DOCUMENT_DOWNLOAD" if download else "DOCUMENT_VIEW"
    log_audit(
        db=db,
        user_id=current_user.id,
        action=action_label,
        resource_type="document",
        resource_id=doc.id,
        metadata_json={"mime_type": doc.mime_type, "download_mode": download}
    )

    disposition = "attachment" if download else "inline"
    return FileResponse(
        path=doc.file_path,
        filename=doc.filename,
        media_type=doc.mime_type,
        headers={"Content-Disposition": f'{disposition}; filename="{doc.filename}"'}
    )


@router.post(
    "/{document_id}/share",
    response_model=DocumentShareOut,
    status_code=status.HTTP_200_OK,
    summary="Share document with provider",
    description="Owner explicitly grants document access to a provider with specified permission level (VIEW or VIEW_AND_DOWNLOAD)."
)
def share_document(
    document_id: int,
    share_in: DocumentShareCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
) -> DocumentShare:
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

    # Prohibit self-sharing
    if provider.user_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot share document with your own provider account."
        )

    share = db.query(DocumentShare).filter(
        DocumentShare.document_id == doc.id,
        DocumentShare.shared_with_provider_id == provider.id
    ).first()

    if share:
        share.status = DocumentShareStatus.ACTIVE
        share.permission = share_in.permission
    else:
        share = DocumentShare(
            document_id=doc.id,
            shared_with_provider_id=provider.id,
            status=DocumentShareStatus.ACTIVE,
            permission=share_in.permission
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
        metadata_json={"provider_id": provider.id, "permission": share.permission.value, "share_status": DocumentShareStatus.ACTIVE.value}
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
) -> DocumentShare:
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
