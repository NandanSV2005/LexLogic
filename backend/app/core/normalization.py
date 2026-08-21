from typing import Optional, Set

# Centralized Location Aliases Map (canonical_city -> set of aliases)
CITY_ALIASES = {
    "bengaluru": {"bengaluru", "bangalore", "bengaluru urban", "bengaluru rural", "bangalore city"},
    "delhi": {"delhi", "new delhi", "ncr", "delhi ncr", "national capital territory"},
    "mumbai": {"mumbai", "bombay", "navi mumbai", "mumbai suburban"},
    "kolkata": {"kolkata", "calcutta"},
    "chennai": {"chennai", "madras"},
    "hyderabad": {"hyderabad", "secunderabad"},
    "ahmedabad": {"ahmedabad", "amdavad"},
    "pune": {"pune", "poona"},
}

def normalize_location(location: Optional[str]) -> str:
    """Centralized canonical location normalization.
    
    Resolves known city aliases (e.g. 'Bengaluru' <-> 'Bangalore') to a standard canonical key.
    If no alias mapping is found, returns lowercase stripped string.
    """
    if not location:
        return ""
    
    loc_clean = location.lower().strip()
    
    for canonical_city, aliases in CITY_ALIASES.items():
        if loc_clean in aliases or any(alias in loc_clean for alias in aliases):
            return canonical_city
            
    return loc_clean


# Centralized Category Definitions & Canonical Keys
CANONICAL_CATEGORIES = {
    "PROPERTY_DISPUTE": {
        "canonical": "Property Dispute",
        "exact_matches": {"property dispute", "property disputes", "title dispute", "land dispute"},
        "related_matches": {"property law", "real estate", "property litigation", "land law", "tenancy dispute", "property"},
    },
    "COMMERCIAL_DISPUTE": {
        "canonical": "Commercial Dispute",
        "exact_matches": {"commercial dispute", "commercial disputes", "business dispute", "contract dispute"},
        "related_matches": {"commercial law", "corporate law", "business litigation", "contract law", "shareholder dispute"},
    },
    "DOCUMENT_PREPARATION": {
        "canonical": "Document Preparation",
        "exact_matches": {"document preparation", "document drafting", "legal drafting", "deed drafting"},
        "related_matches": {"contract drafting", "affidavit drafting", "agreement drafting", "wills and poa"},
    },
    "MEDIATION": {
        "canonical": "Mediation",
        "exact_matches": {"mediation", "family mediation", "commercial mediation", "dispute resolution"},
        "related_matches": {"out of court settlement", "conciliation", "negotiation"},
    },
    "ARBITRATION": {
        "canonical": "Arbitration",
        "exact_matches": {"arbitration", "commercial arbitration", "tribunal arbitration"},
        "related_matches": {"arbitral tribunal", "dispute resolution", "arbitrator"},
    },
    "NOTARIZATION": {
        "canonical": "Notarization",
        "exact_matches": {"notarization", "notary service", "attestation"},
        "related_matches": {"affidavit notarization", "document authentication", "notary"},
    },
}


def calculate_service_match_score(
    request_category: str,
    request_description: str,
    combined_provider_text: str
) -> float:
    """Calculates tiered service/category match score:
    - 100.0: Exact category / practice area match
    - 60.0:  Related practice area match or description match
    - 40.0:  Baseline provider type eligibility match
    """
    cat_lower = request_category.lower().strip()
    desc_lower = request_description.lower().strip() if request_description else ""
    provider_text_lower = combined_provider_text.lower().strip()

    if not provider_text_lower:
        return 40.0

    # Look up canonical category definition
    matched_cat_def = None
    for key, cat_info in CANONICAL_CATEGORIES.items():
        if cat_lower == cat_info["canonical"].lower() or cat_lower in cat_info["exact_matches"]:
            matched_cat_def = cat_info
            break

    if matched_cat_def:
        # Check exact practice area match first
        if any(exact in provider_text_lower for exact in matched_cat_def["exact_matches"]):
            return 100.0
        # Check related practice area match next
        if any(related in provider_text_lower for related in matched_cat_def["related_matches"]):
            return 60.0
    else:
        # Generic exact match check if not in predefined map
        if cat_lower in provider_text_lower or any(w in provider_text_lower for w in cat_lower.split() if len(w) > 3):
            return 100.0

    # Description partial match check
    if desc_lower and any(w in provider_text_lower for w in desc_lower.split() if len(w) > 4):
        return 60.0

    # Baseline match score for same provider type
    return 40.0
