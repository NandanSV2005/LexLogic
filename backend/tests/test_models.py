from datetime import datetime, timezone
import pytest
from sqlalchemy.exc import IntegrityError
from app.db.base import Base
from app.db.database import SessionLocal, init_db, engine

from app.core.security import get_password_hash
from app.models.user import User, UserRole
from app.models.provider import (
    Provider,
    ProviderType,
    VerificationStatus,
    AvailabilityStatus,
    ProviderFieldDefinition,
    ProviderFieldValue,
)
from app.models.request import ServiceRequest, RequestStatus, RequestProvider, InteractionStatus
from app.models.document import Document, DocumentVisibility, DocumentShare, DocumentShareStatus
from app.models.points import PointTransaction, PointAction
from app.models.audit import AuditLog


@pytest.fixture(autouse=True)
def setup_database():
    """Re-initialize clean tables before each test."""
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
        Base.metadata.drop_all(bind=engine)



def test_user_creation(setup_database):
    """Test User creation, password hashing, and unique email constraint."""
    db = setup_database
    hashed_pwd = get_password_hash("Secret123!")
    user = User(
        email="citizen@example.com",
        password_hash=hashed_pwd,
        role=UserRole.CITIZEN,
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    assert user.id is not None
    assert user.email == "citizen@example.com"
    assert user.password_hash != "Secret123!"
    assert user.role == UserRole.CITIZEN

    # Test unique email constraint
    duplicate_user = User(
        email="citizen@example.com",
        password_hash=hashed_pwd,
        role=UserRole.CITIZEN,
    )
    db.add(duplicate_user)
    with pytest.raises(IntegrityError):
        db.commit()
    db.rollback()


def test_provider_creation(setup_database):
    """Test Provider creation linked to User."""
    db = setup_database
    user = User(
        email="provider@example.com",
        password_hash=get_password_hash("ProviderPass1!"),
        role=UserRole.PROVIDER,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    provider = Provider(
        user_id=user.id,
        provider_type=ProviderType.ADVOCATE,
        full_name="Jane Doe, Esq.",
        phone="+1234567890",
        location="New York",
        experience_years=8,
        bio="Experienced legal advocate specializing in civil litigation.",
    )
    db.add(provider)
    db.commit()
    db.refresh(provider)

    assert provider.id is not None
    assert provider.user_id == user.id
    assert provider.provider_type == ProviderType.ADVOCATE
    assert provider.verification_status == VerificationStatus.PENDING
    assert provider.availability_status == AvailabilityStatus.AVAILABLE
    assert provider.reliability_score == 100.0
    assert provider.points == 0
    assert user.provider is not None
    assert user.provider.id == provider.id


def test_provider_type_validation_and_generic_fields(setup_database):
    """Test generic field definitions and values per ProviderType."""
    db = setup_database

    # Create field definition for ADVOCATE
    advocate_field = ProviderFieldDefinition(
        provider_type=ProviderType.ADVOCATE,
        field_name="practice_area",
        field_label="Practice Area",
        field_type="text",
        is_required=True,
    )

    # Create field definition for NOTARY
    notary_field = ProviderFieldDefinition(
        provider_type=ProviderType.NOTARY,
        field_name="registration_details",
        field_label="Registration Details",
        field_type="text",
        is_required=True,
    )

    db.add_all([advocate_field, notary_field])
    db.commit()

    # Create Provider User
    user = User(
        email="advocate@example.com",
        password_hash=get_password_hash("Pass123!"),
        role=UserRole.PROVIDER,
    )
    db.add(user)
    db.commit()

    provider = Provider(
        user_id=user.id,
        provider_type=ProviderType.ADVOCATE,
        full_name="Advocate Alex",
    )
    db.add(provider)
    db.commit()

    # Assign fieldValue
    field_value = ProviderFieldValue(
        provider_id=provider.id,
        field_definition_id=advocate_field.id,
        value="Corporate & Criminal Law",
    )
    db.add(field_value)
    db.commit()
    db.refresh(provider)

    assert len(provider.field_values) == 1
    assert provider.field_values[0].value == "Corporate & Criminal Law"
    assert provider.field_values[0].field_definition.field_name == "practice_area"


def test_service_request_creation(setup_database):
    """Test Citizen Service Request creation and Provider interaction relationship."""
    db = setup_database

    citizen = User(
        email="citizen_req@example.com",
        password_hash=get_password_hash("Pass123!"),
        role=UserRole.CITIZEN,
    )
    provider_user = User(
        email="provider_req@example.com",
        password_hash=get_password_hash("Pass123!"),
        role=UserRole.PROVIDER,
    )
    db.add_all([citizen, provider_user])
    db.commit()

    provider = Provider(
        user_id=provider_user.id,
        provider_type=ProviderType.MEDIATOR,
        full_name="Mediator Mark",
    )
    db.add(provider)
    db.commit()

    # Create ServiceRequest
    req = ServiceRequest(
        citizen_id=citizen.id,
        service_category="Dispute Resolution",
        description="Property dispute resolution needed.",
        location="Boston, MA",
        preferred_provider_type=ProviderType.MEDIATOR,
    )
    db.add(req)
    db.commit()
    db.refresh(req)

    assert req.id is not None
    assert req.status == RequestStatus.OPEN
    assert req.citizen.email == "citizen_req@example.com"

    # Create RequestProvider interaction
    interaction = RequestProvider(
        request_id=req.id,
        provider_id=provider.id,
        status=InteractionStatus.CONTACTED,
    )
    db.add(interaction)
    db.commit()
    db.refresh(req)

    assert len(req.provider_interactions) == 1
    assert req.provider_interactions[0].provider_id == provider.id
    assert req.provider_interactions[0].status == InteractionStatus.CONTACTED


def test_document_ownership(setup_database):
    """Test Document creation with owner and default PRIVATE status."""
    db = setup_database

    owner = User(
        email="doc_owner@example.com",
        password_hash=get_password_hash("Pass123!"),
        role=UserRole.CITIZEN,
    )
    db.add(owner)
    db.commit()

    doc = Document(
        owner_id=owner.id,
        title="Title Deed",
        filename="title_deed.pdf",
        file_path="/secure/uploads/title_deed.pdf",
        mime_type="application/pdf",
        file_size_bytes=1024500,
        visibility=DocumentVisibility.PRIVATE,
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)

    assert doc.id is not None
    assert doc.visibility == DocumentVisibility.PRIVATE
    assert doc.owner.email == "doc_owner@example.com"


def test_document_sharing_relationship(setup_database):
    """Test Document sharing and revocation lifecycle (PRIVATE -> SHARED -> REVOKED)."""
    db = setup_database

    owner = User(
        email="doc_sharer@example.com",
        password_hash=get_password_hash("Pass123!"),
        role=UserRole.CITIZEN,
    )
    provider_user = User(
        email="doc_receiver@example.com",
        password_hash=get_password_hash("Pass123!"),
        role=UserRole.PROVIDER,
    )
    db.add_all([owner, provider_user])
    db.commit()

    from app.models.provider import Provider, ProviderType
    provider = Provider(user_id=provider_user.id, provider_type=ProviderType.ADVOCATE, full_name="Advocate Receiver")
    db.add(provider)
    db.commit()

    doc = Document(
        owner_id=owner.id,
        title="Contract Draft",
        filename="contract_draft.pdf",
        file_path="/secure/uploads/contract_draft.pdf",
        mime_type="application/pdf",
        file_size_bytes=512000,
    )
    db.add(doc)
    db.commit()

    # Share document
    doc_share = DocumentShare(
        document_id=doc.id,
        shared_with_provider_id=provider.id,
        status=DocumentShareStatus.ACTIVE,
    )
    doc.visibility = DocumentVisibility.SHARED
    db.add(doc_share)
    db.commit()

    assert doc.visibility == DocumentVisibility.SHARED
    assert len(doc.shares) == 1
    assert doc.shares[0].status == DocumentShareStatus.ACTIVE


    # Revoke share
    doc_share.status = DocumentShareStatus.REVOKED
    doc.visibility = DocumentVisibility.REVOKED
    db.commit()

    assert doc.visibility == DocumentVisibility.REVOKED
    assert doc.shares[0].status == DocumentShareStatus.REVOKED


def test_point_transaction_creation(setup_database):
    """Test PointTransaction history creation and points calculation for Provider."""
    db = setup_database

    user = User(
        email="points_provider@example.com",
        password_hash=get_password_hash("Pass123!"),
        role=UserRole.PROVIDER,
    )
    db.add(user)
    db.commit()

    provider = Provider(
        user_id=user.id,
        provider_type=ProviderType.DOCUMENT_WRITER,
        full_name="Writer Will",
        points=0,
    )
    db.add(provider)
    db.commit()

    tx1 = PointTransaction(
        provider_id=provider.id,
        action=PointAction.PROFILE_COMPLETED,
        points=20,
        description="Profile completed +20 points",
    )
    provider.points += tx1.points

    tx2 = PointTransaction(
        provider_id=provider.id,
        action=PointAction.SERVICE_COMPLETED,
        points=20,
        description="Service completed +20 points",
    )
    provider.points += tx2.points

    db.add_all([tx1, tx2])
    db.commit()
    db.refresh(provider)

    assert provider.points == 40
    assert len(provider.point_transactions) == 2
    assert provider.point_transactions[0].action == PointAction.PROFILE_COMPLETED
    assert provider.point_transactions[1].action == PointAction.SERVICE_COMPLETED
