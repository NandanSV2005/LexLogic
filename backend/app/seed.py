import os
import io
import argparse
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from app.db.database import SessionLocal, init_db, engine
from app.db.base import Base
from app.core.security import get_password_hash
from app.models.user import User, UserRole
from app.models.provider import Provider, ProviderType, VerificationStatus, AvailabilityStatus
from app.models.request import ServiceRequest, RequestStatus, RequestUrgency, RequestProvider, InteractionStatus
from app.models.document import Document, DocumentVisibility, DocumentShare, DocumentShareStatus
from app.models.points import PointAction
from app.services.provider_service import (
    seed_default_provider_field_definitions,
    update_provider_generic_fields,
    calculate_profile_completion,
)
from app.services.points_service import award_points
from app.services.reliability_service import calculate_reliability_score
from app.services.audit import log_audit, ACTION_USER_REGISTERED, ACTION_USER_LOGIN, ACTION_DOCUMENT_UPLOADED, ACTION_DOCUMENT_SHARED
from fastapi import UploadFile
from starlette.datastructures import Headers
from app.services.document_storage import validate_and_save_upload_file



def run_seed(reset_db: bool = False) -> None:
    """Populates deterministic demo data for LexLogic hackathon presentation."""
    if reset_db:
        print("Resetting database tables...")
        Base.metadata.drop_all(bind=engine)

    init_db()
    db: Session = SessionLocal()

    try:
        print("Seeding default provider field definitions...")
        seed_default_provider_field_definitions(db)

        # Check if data already exists (Idempotency check)
        existing_admin = db.query(User).filter(User.role == UserRole.ADMIN).first()
        if existing_admin and not reset_db:
            print("Database already contains seed data. Use --reset flag to re-seed.")
            return

        print("Seeding demo users & roles...")
        # 1. ADMIN USER
        admin_pass = get_password_hash("Admin123!")
        admin_user = User(email="admin@lexlogic.demo", password_hash=admin_pass, role=UserRole.ADMIN)
        db.add(admin_user)
        db.commit()
        db.refresh(admin_user)
        log_audit(db, user_id=admin_user.id, action=ACTION_USER_REGISTERED, resource_type="user", resource_id=admin_user.id)

        # 2. CITIZEN USERS
        cit_pass = get_password_hash("Citizen123!")
        cit_anita = User(email="citizen.anita@lexlogic.demo", password_hash=cit_pass, role=UserRole.CITIZEN)
        cit_vikram = User(email="citizen.vikram@lexlogic.demo", password_hash=cit_pass, role=UserRole.CITIZEN)
        db.add_all([cit_anita, cit_vikram])
        db.commit()
        db.refresh(cit_anita)
        db.refresh(cit_vikram)

        log_audit(db, user_id=cit_anita.id, action=ACTION_USER_REGISTERED, resource_type="user", resource_id=cit_anita.id)
        log_audit(db, user_id=cit_vikram.id, action=ACTION_USER_REGISTERED, resource_type="user", resource_id=cit_vikram.id)

        # 3. PROVIDER USERS & PROFILES
        prov_pass = get_password_hash("Provider123!")

        # --- ADVOCATE 1: Verified Senior Advocate (Delhi) ---
        user_adv1 = User(email="advocate.sharma@lexlogic.demo", password_hash=prov_pass, role=UserRole.PROVIDER)
        db.add(user_adv1)
        db.commit()
        db.refresh(user_adv1)

        prov_adv1 = Provider(
            user_id=user_adv1.id,
            provider_type=ProviderType.ADVOCATE,
            full_name="Advocate Rajesh Sharma",
            phone="+919811122334",
            location="New Delhi",
            experience_years=15,
            bio="Senior High Court Advocate specializing in constitutional law and commercial property litigation.",
            verification_status=VerificationStatus.VERIFIED,
            availability_status=AvailabilityStatus.AVAILABLE,
            rating=4.8,
            completed_requests=14,
            total_requests=15,
            response_rate=95.0,
        )
        db.add(prov_adv1)
        db.commit()
        db.refresh(prov_adv1)

        update_provider_generic_fields(db, prov_adv1, [
            {"field_name": "practice_area", "value": "Constitutional & Commercial Property Litigation"},
            {"field_name": "registration_details", "value": "D/9876/2009"}
        ])
        calculate_profile_completion(prov_adv1, db)
        award_points(db, prov_adv1, PointAction.AVAILABILITY_ADDED)
        award_points(db, prov_adv1, PointAction.SERVICE_COMPLETED)
        calculate_reliability_score(prov_adv1)

        # --- ADVOCATE 2: Submitted Junior Advocate (Mumbai) ---
        user_adv2 = User(email="advocate.verma@lexlogic.demo", password_hash=prov_pass, role=UserRole.PROVIDER)
        db.add(user_adv2)
        db.commit()
        db.refresh(user_adv2)

        prov_adv2 = Provider(
            user_id=user_adv2.id,
            provider_type=ProviderType.ADVOCATE,
            full_name="Advocate Meera Verma",
            phone="+919822233445",
            location="Mumbai",
            experience_years=8,
            bio="Litigation advocate focused on civil disputes and employment law.",
            verification_status=VerificationStatus.SUBMITTED,
            availability_status=AvailabilityStatus.AVAILABLE,
            rating=4.2,
            completed_requests=5,
            total_requests=6,
            response_rate=90.0,
        )
        db.add(prov_adv2)
        db.commit()
        db.refresh(prov_adv2)

        update_provider_generic_fields(db, prov_adv2, [
            {"field_name": "practice_area", "value": "Civil Litigation & Employment Law"},
            {"field_name": "registration_details", "value": "MAH/4321/2016"}
        ])
        calculate_profile_completion(prov_adv2, db)
        calculate_reliability_score(prov_adv2)

        # --- MEDIATOR 1: Verified Commercial Mediator (Bangalore) ---
        user_med1 = User(email="mediator.kapoor@lexlogic.demo", password_hash=prov_pass, role=UserRole.PROVIDER)
        db.add(user_med1)
        db.commit()
        db.refresh(user_med1)

        prov_med1 = Provider(
            user_id=user_med1.id,
            provider_type=ProviderType.MEDIATOR,
            full_name="Mediator Suresh Kapoor",
            phone="+919833344556",
            location="Bangalore",
            experience_years=12,
            bio="Certified mediator specializing in corporate shareholder disputes and family settlement mediation.",
            verification_status=VerificationStatus.VERIFIED,
            availability_status=AvailabilityStatus.AVAILABLE,
            rating=4.9,
            completed_requests=20,
            total_requests=21,
            response_rate=98.0,
        )
        db.add(prov_med1)
        db.commit()
        db.refresh(prov_med1)

        update_provider_generic_fields(db, prov_med1, [
            {"field_name": "specialization", "value": "Corporate Shareholder & Family Business Mediation"}
        ])
        calculate_profile_completion(prov_med1, db)
        award_points(db, prov_med1, PointAction.AVAILABILITY_ADDED)
        award_points(db, prov_med1, PointAction.SERVICE_COMPLETED)
        calculate_reliability_score(prov_med1)

        # --- MEDIATOR 2: Pending Mediator (New Delhi) ---
        user_med2 = User(email="mediator.singh@lexlogic.demo", password_hash=prov_pass, role=UserRole.PROVIDER)
        db.add(user_med2)
        db.commit()
        db.refresh(user_med2)

        prov_med2 = Provider(
            user_id=user_med2.id,
            provider_type=ProviderType.MEDIATOR,
            full_name="Mediator Priya Singh",
            phone="+919844455667",
            location="New Delhi",
            experience_years=5,
            bio="Community & commercial mediator.",
            verification_status=VerificationStatus.PENDING,
            availability_status=AvailabilityStatus.BUSY,
            rating=4.0,
            completed_requests=2,
            total_requests=3,
            response_rate=80.0,
        )
        db.add(prov_med2)
        db.commit()
        db.refresh(prov_med2)

        update_provider_generic_fields(db, prov_med2, [
            {"field_name": "specialization", "value": "Commercial Dispute Resolution"}
        ])
        calculate_profile_completion(prov_med2, db)
        calculate_reliability_score(prov_med2)

        # --- ARBITRATOR 1: Senior Arbitrator (New Delhi) ---
        user_arb1 = User(email="arbitrator.iyer@lexlogic.demo", password_hash=prov_pass, role=UserRole.PROVIDER)
        db.add(user_arb1)
        db.commit()
        db.refresh(user_arb1)

        prov_arb1 = Provider(
            user_id=user_arb1.id,
            provider_type=ProviderType.ARBITRATOR,
            full_name="Arbitrator Justice V. Iyer",
            phone="+919855566778",
            location="New Delhi",
            experience_years=22,
            bio="Former judicial officer & international arbitration practitioner.",
            verification_status=VerificationStatus.VERIFIED,
            availability_status=AvailabilityStatus.AVAILABLE,
            rating=4.95,
            completed_requests=35,
            total_requests=36,
            response_rate=99.0,
        )
        db.add(prov_arb1)
        db.commit()
        db.refresh(prov_arb1)

        update_provider_generic_fields(db, prov_arb1, [
            {"field_name": "specialization", "value": "International Commercial & Infrastructure Arbitration"}
        ])
        calculate_profile_completion(prov_arb1, db)
        award_points(db, prov_arb1, PointAction.AVAILABILITY_ADDED)
        award_points(db, prov_arb1, PointAction.SERVICE_COMPLETED)
        calculate_reliability_score(prov_arb1)

        # --- NOTARY 1: Licensed Notary (New Delhi) ---
        user_not1 = User(email="notary.gupta@lexlogic.demo", password_hash=prov_pass, role=UserRole.PROVIDER)
        db.add(user_not1)
        db.commit()
        db.refresh(user_not1)

        prov_not1 = Provider(
            user_id=user_not1.id,
            provider_type=ProviderType.NOTARY,
            full_name="Notary Amit Gupta",
            phone="+919866677889",
            location="New Delhi",
            experience_years=10,
            bio="Government-appointed Notary Public for document authentication and attestations.",
            verification_status=VerificationStatus.VERIFIED,
            availability_status=AvailabilityStatus.AVAILABLE,
            rating=4.6,
            completed_requests=45,
            total_requests=46,
            response_rate=96.0,
        )
        db.add(prov_not1)
        db.commit()
        db.refresh(prov_not1)

        update_provider_generic_fields(db, prov_not1, [
            {"field_name": "registration_details", "value": "NOT/DEL/5544/2014"},
            {"field_name": "service_type", "value": "Affidavit Attestation & Agreement Notarization"}
        ])
        calculate_profile_completion(prov_not1, db)
        award_points(db, prov_not1, PointAction.AVAILABILITY_ADDED)
        calculate_reliability_score(prov_not1)

        # --- DOCUMENT WRITER 1: Expert Legal Drafter (Ahmedabad) ---
        user_wrt1 = User(email="writer.patel@lexlogic.demo", password_hash=prov_pass, role=UserRole.PROVIDER)
        db.add(user_wrt1)
        db.commit()
        db.refresh(user_wrt1)

        prov_wrt1 = Provider(
            user_id=user_wrt1.id,
            provider_type=ProviderType.DOCUMENT_WRITER,
            full_name="Writer Kirit Patel",
            phone="+919877788990",
            location="Ahmedabad",
            experience_years=14,
            bio="Specialized legal document writer for property deeds, contracts, and power of attorney.",
            verification_status=VerificationStatus.VERIFIED,
            availability_status=AvailabilityStatus.AVAILABLE,
            rating=4.7,
            completed_requests=28,
            total_requests=29,
            response_rate=97.0,
        )
        db.add(prov_wrt1)
        db.commit()
        db.refresh(prov_wrt1)

        update_provider_generic_fields(db, prov_wrt1, [
            {"field_name": "document_types", "value": "Property Sale Deeds, Partnership Contracts, Wills & POA"}
        ])
        calculate_profile_completion(prov_wrt1, db)
        award_points(db, prov_wrt1, PointAction.AVAILABILITY_ADDED)
        calculate_reliability_score(prov_wrt1)

        # 4. SAMPLE SERVICE REQUESTS
        print("Seeding sample citizen service requests...")
        req1 = ServiceRequest(
            citizen_id=cit_anita.id,
            service_category="Property dispute",
            description="Boundary wall encroachment dispute with adjacent commercial plot.",
            location="New Delhi",
            preferred_provider_type=ProviderType.ADVOCATE,
            urgency=RequestUrgency.HIGH,
            legal_aid_interest=True,
            status=RequestStatus.OPEN
        )

        req2 = ServiceRequest(
            citizen_id=cit_vikram.id,
            service_category="Commercial dispute",
            description="Shareholder deadlock contract dispute requiring expedited arbitration.",
            location="New Delhi",
            preferred_provider_type=ProviderType.ARBITRATOR,
            urgency=RequestUrgency.URGENT,
            legal_aid_interest=False,
            status=RequestStatus.OPEN
        )

        req3 = ServiceRequest(
            citizen_id=cit_anita.id,
            service_category="Document preparation",
            description="Drafting complex commercial lease agreement & General Power of Attorney.",
            location="Ahmedabad",
            preferred_provider_type=ProviderType.DOCUMENT_WRITER,
            urgency=RequestUrgency.NORMAL,
            legal_aid_interest=False,
            status=RequestStatus.OPEN
        )

        req4 = ServiceRequest(
            citizen_id=cit_vikram.id,
            service_category="Mediation requirement",
            description="Family asset distribution mediation between business partners.",
            location="Bangalore",
            preferred_provider_type=ProviderType.MEDIATOR,
            urgency=RequestUrgency.NORMAL,
            legal_aid_interest=False,
            status=RequestStatus.CONTACTED
        )

        req5 = ServiceRequest(
            citizen_id=cit_anita.id,
            service_category="Notary service",
            description="Affidavit notarization for property registration.",
            location="New Delhi",
            preferred_provider_type=ProviderType.NOTARY,
            urgency=RequestUrgency.NORMAL,
            legal_aid_interest=False,
            status=RequestStatus.OPEN
        )

        db.add_all([req1, req2, req3, req4, req5])
        db.commit()

        # Add sample provider interaction for req4
        interaction = RequestProvider(
            request_id=req4.id,
            provider_id=prov_med1.id,
            status=InteractionStatus.CONTACTED
        )
        db.add(interaction)
        db.commit()

        # 5. SAMPLE PRIVATE DOCUMENT & SHARE GRANT
        print("Seeding sample private document & share grant...")
        sample_pdf_bytes = b"%PDF-1.4 sample title deed content for Anita Desai demo..."
        
        # Create a UploadFile object
        upload_file = UploadFile(
            filename="Anita_Property_Deed.pdf",
            file=io.BytesIO(sample_pdf_bytes),
            headers=Headers({"content-type": "application/pdf"})
        )

        storage_path, sanitized_filename, file_size, mime_type = validate_and_save_upload_file(
            upload_file, sample_pdf_bytes
        )

        doc = Document(
            owner_id=cit_anita.id,
            title="Anita Property Title Deed",
            filename=sanitized_filename,
            file_path=storage_path,
            file_size_bytes=file_size,
            mime_type=mime_type,
            visibility=DocumentVisibility.SHARED
        )
        db.add(doc)
        db.commit()
        db.refresh(doc)

        # Share document with Advocate Rajesh Sharma
        share = DocumentShare(
            document_id=doc.id,
            shared_with_provider_id=prov_adv1.id,
            status=DocumentShareStatus.ACTIVE
        )
        db.add(share)
        db.commit()

        log_audit(db, user_id=cit_anita.id, action=ACTION_DOCUMENT_UPLOADED, resource_type="document", resource_id=doc.id)
        log_audit(db, user_id=cit_anita.id, action=ACTION_DOCUMENT_SHARED, resource_type="document", resource_id=doc.id, metadata_json={"provider_id": prov_adv1.id})

        print("\nSeed completed successfully!")
        print("==========================================================================")
        print("LEXLOGIC DEMO CREDENTIALS")
        print("==========================================================================")
        print("Admin:              admin@lexlogic.demo / Admin123!")
        print("Citizen Anita:      citizen.anita@lexlogic.demo / Citizen123!")
        print("Citizen Vikram:     citizen.vikram@lexlogic.demo / Citizen123!")
        print("Advocate Sharma:    advocate.sharma@lexlogic.demo / Provider123!")
        print("Advocate Verma:     advocate.verma@lexlogic.demo / Provider123!")
        print("Mediator Kapoor:    mediator.kapoor@lexlogic.demo / Provider123!")
        print("Arbitrator Iyer:    arbitrator.iyer@lexlogic.demo / Provider123!")
        print("Notary Gupta:       notary.gupta@lexlogic.demo / Provider123!")
        print("Document Writer:    writer.patel@lexlogic.demo / Provider123!")
        print("==========================================================================")

    finally:
        db.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Seed LexLogic demo database with realistic hackathon mock data.")
    parser.add_argument("--reset", action="store_true", help="Drop existing database tables before seeding.")
    args = parser.parse_args()
    run_seed(reset_db=args.reset)
