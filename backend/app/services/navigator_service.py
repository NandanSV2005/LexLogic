from typing import Dict, Any
from app.models.provider import ProviderType
from app.schemas.navigator import NavigatorOutput

DISCLAIMER_TEXT = "LexLogic helps identify the type of service you may need. This is not legal advice."

# Lightweight deterministic classification rule map
RULES = [
    {
        "keywords": ["tenant", "rent", "landlord", "evict", "lease", "deposit", "flat", "house"],
        "service_category": "Property / Tenancy Dispute",
        "provider_type": ProviderType.ADVOCATE,
        "summary_context": "Landlord-tenant dispute concerning tenancy agreement, rent recovery, or property possession."
    },
    {
        "keywords": ["property", "deed", "boundary", "land", "encroachment", "title", "ancestral", "plot"],
        "service_category": "Property Law",
        "provider_type": ProviderType.ADVOCATE,
        "summary_context": "Property ownership, title deed verification, or boundary encroachment dispute."
    },
    {
        "keywords": ["agreement", "contract", "draft", "deed", "clause", "writing", "terms", "nda"],
        "service_category": "Document Drafting & Review",
        "provider_type": ProviderType.DOCUMENT_WRITER,
        "summary_context": "Drafting or reviewing legal agreements, contracts, or deeds."
    },
    {
        "keywords": ["notary", "stamp", "attest", "signature", "affidavit", "power of attorney", "poa", "verification"],
        "service_category": "Notary & Document Attestation",
        "provider_type": ProviderType.NOTARY,
        "summary_context": "Official document attestation, affidavit notarization, or execution verification."
    },
    {
        "keywords": ["business", "commercial", "partner", "shareholder", "company", "vendor", "dispute", "breach"],
        "service_category": "Commercial Dispute",
        "provider_type": ProviderType.ARBITRATOR,
        "summary_context": "Commercial contract breach or business partner dispute eligible for arbitration."
    },
    {
        "keywords": ["family", "divorce", "custody", "settlement", "mediation", "marital", "community", "reconciliation"],
        "service_category": "Family & Domestic Settlement",
        "provider_type": ProviderType.MEDIATOR,
        "summary_context": "Family, marital, or domestic matter appropriate for structured mediation settlement."
    },
]


def classify_legal_need(description: str) -> NavigatorOutput:
    """Classifies a natural language legal need description using a fast, deterministic rule engine."""
    desc_lower = description.lower()

    best_match = None
    max_score = 0

    for rule in RULES:
        score = sum(1 for kw in rule["keywords"] if kw in desc_lower)
        if score > max_score:
            max_score = score
            best_match = rule

    if best_match and max_score > 0:
        return NavigatorOutput(
            service_category=best_match["service_category"],
            preferred_provider_type=best_match["provider_type"],
            summary_context=best_match["summary_context"],
            disclaimer=DISCLAIMER_TEXT
        )

    # General Fallback
    return NavigatorOutput(
        service_category="General Legal Assistance",
        preferred_provider_type=ProviderType.ADVOCATE,
        summary_context="General legal inquiry requiring professional assessment and representation.",
        disclaimer=DISCLAIMER_TEXT
    )
