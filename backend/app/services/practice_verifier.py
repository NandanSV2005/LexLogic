from abc import ABC, abstractmethod
from typing import Dict, Any, Optional
from datetime import datetime, timezone
from app.models.verification import AdvocateCaseReference, PracticeEvidenceStatus


class PracticeEvidenceVerifier(ABC):
    """Abstract interface for Advocate Practice Evidence Verification.
    
    Future external court database/API integrations (e.g. eCourts India, High Court Portals)
    can implement this interface without modifying core application business logic.
    """

    @abstractmethod
    def verify_case_reference(self, case_ref: AdvocateCaseReference) -> Dict[str, Any]:
        """Performs verification check on case reference metadata.
        
        Returns a dictionary containing:
        - status: Target PracticeEvidenceStatus (or string value)
        - source_reference: Audit trail source identifier
        - notes: Verification notes or summary explanation
        """
        pass


class ManualPracticeEvidenceVerifier(PracticeEvidenceVerifier):
    """Default platform verifier supporting manual and admin-driven verification review queues.
    
    CRITICAL PRINCIPLE:
    Does NOT construct fake external API calls or fabricate false court verification results.
    Marks newly submitted practice evidence as PENDING_REVIEW for manual Admin inspection.
    """

    def verify_case_reference(self, case_ref: AdvocateCaseReference) -> Dict[str, Any]:
        return {
            "status": PracticeEvidenceStatus.PENDING_REVIEW.value,
            "source_reference": "LEXLOGIC_MANUAL_REVIEW_QUEUE",
            "notes": "Case evidence submitted. Queued for platform administrator verification review.",
            "timestamp": datetime.now(timezone.utc),
        }
