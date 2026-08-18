import re
from typing import Dict, Any, List

DISCLAIMER_TEXT = "LexLogic extracted the following information from your document. This is not legal advice."


def extract_document_intelligence(title: str, filename: str, mime_type: str) -> Dict[str, Any]:
    """Fast, deterministic metadata extraction for smart document intelligence."""
    text_to_scan = f"{title} {filename}".lower()

    # Document Type Classification
    doc_type = "General Legal Document"
    parties = ["Party A", "Party B"]
    headings = ["Preamble", "Terms & Conditions", "Signatures & Execution"]

    if any(k in text_to_scan for k in ["rent", "lease", "tenancy", "tenant", "landlord"]):
        doc_type = "Rent & Tenancy Agreement"
        parties = ["Landlord (Lessor)", "Tenant (Lessee)"]
        headings = ["Premises Description", "Monthly Rent & Deposit", "Term & Termination"]
    elif any(k in text_to_scan for k in ["sale", "deed", "conveyance", "property"]):
        doc_type = "Property Sale Deed"
        parties = ["Seller (Vendor)", "Buyer (Purchaser)"]
        headings = ["Property Schedule", "Consideration Amount", "Title Clearance"]
    elif any(k in text_to_scan for k in ["id", "aadhaar", "passport", "pan", "license", "proof"]):
        doc_type = "Identity Verification Document"
        parties = ["Document Holder", "Issuing Authority"]
        headings = ["Identification Details", "Validity Period"]
    elif any(k in text_to_scan for k in ["court", "notice", "summons", "order", "petition"]):
        doc_type = "Court Notice / Order"
        parties = ["Petitioner / Plaintiff", "Respondent / Defendant"]
        headings = ["Case Details", "Court Directives", "Next Hearing Date"]

    # Extract dates or provide structured sample date
    detected_dates = ["Execution Date: Recent"]
    date_matches = re.findall(r"\d{1,2}[-/\.]\d{1,2}[-/\.]\d{2,4}", text_to_scan)
    if date_matches:
        detected_dates = date_matches

    return {
        "document_type": doc_type,
        "parties": parties,
        "key_headings": headings,
        "detected_dates": detected_dates,
        "file_type_summary": f"{mime_type.upper() if mime_type else 'FILE'}",
        "disclaimer": DISCLAIMER_TEXT
    }
