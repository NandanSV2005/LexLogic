# LexLogic — Provider Experience & Advanced Document Security Architecture

This document details the implementation of **Profession-Specific Provider Experiences** and **Advanced Citizen-Controlled Document Security** for LexLogic.

---

## 1. Executive Summary

LexLogic now customizes provider portals across all 5 registered legal provider categories (`ADVOCATE`, `MEDIATOR`, `ARBITRATOR`, `NOTARY`, `DOCUMENT_WRITER`) using a centralized taxonomy configuration. Additionally, legal documents are strictly **Private by Default**, requiring explicit citizen consent to share with fine-grained access levels (`VIEW` vs `VIEW_AND_DOWNLOAD`) and instant access revocation.

---

## 2. Part 1 — Profession-Specific Provider Experience

### 2.1 Centralized Provider Taxonomy Configuration
Implemented in [`frontend/src/config/providerConfig.ts`](file:///c:/Users/Nandan%20SV/Desktop/LexLogic/frontend/src/config/providerConfig.ts):

| Provider Type | Label | Profession Title | Active Work Feed Title | Request Category Label | Relevant Services |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `ADVOCATE` | Advocate | Advocate / Legal Counsel | Active Cases | Legal Requests | Civil, Criminal, Corporate, Property Litigation, Legal Aid |
| `MEDIATOR` | Mediator | Dispute Mediator | Active Mediations | Mediation Requests | Commercial Mediation, Family Settlement, Workplace Mediation |
| `ARBITRATOR` | Arbitrator | Neutral Arbitrator | Active Arbitrations | Arbitration Requests | Commercial, Construction, Contractual Arbitration |
| `NOTARY` | Notary Public | Notary Public | Active Notary Requests | Notary Requests | Affidavits, Oaths, Document Verification, Power of Attorney |
| `DOCUMENT_WRITER` | Document Writer | Legal Document Specialist | Active Documents | Document Requests | Sale Deed, Contract Drafting, Will & Trust Writing |

### 2.2 Express Interest Confirmation Modal
When a provider clicks **Express Interest** on an eligible request, an explicit confirmation modal appears displaying:
- Service category & urgency badge
- Citizen legal need summary & location
- Legal Aid flag (+30 incentive points badge)
- Explicit `[Cancel]` and `[Confirm Express Interest]` buttons.

Backend duplicate-interest protection prevents multiple interest declarations on the same request.

### 2.3 Active Cases Feed
The provider dashboard features a profession-specific feed displaying active engagements with status badges (`INTEREST EXPRESSED`, `ASSIGNED`, `COMPLETED`), action drawer for case details, and a **Request Documents** modal to request specific documents from the citizen.

---

## 3. Part 2 — Advanced Document Security & Permissions

### 3.1 Document Privacy & Permission Hierarchy

1. **PRIVATE (Default)**: Documents uploaded by citizens are accessible ONLY to the owner and Admin users.
2. **SHARED (`VIEW`)**: Citizen explicitly shares document with View-Only permission.
   - Provider can stream and view document in-browser (`Content-Disposition: inline`).
   - Download endpoint (`?download=true`) returns `HTTP 403 Forbidden: Download access permission required`.
3. **SHARED (`VIEW_AND_DOWNLOAD`)**: Citizen explicitly grants View + Download permission.
   - Provider can view in-browser AND download original file (`Content-Disposition: attachment`).
4. **REVOKED**: Citizen revokes access from provider.
   - All subsequent view or download requests return `HTTP 403 Forbidden`.

### 3.2 Backend Permission Enforcement Matrix

| Endpoint | Owner | Admin | Provider (No Share) | Provider (`VIEW`) | Provider (`VIEW_AND_DOWNLOAD`) | Provider (`REVOKED`) |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| `GET /api/documents/{id}?download=false` | 200 | 200 | 403 | 200 (Inline) | 200 (Inline) | 403 |
| `GET /api/documents/{id}?download=true` | 200 | 200 | 403 | **403 Forbidden** | 200 (Attachment) | 403 |
| `POST /api/documents/{id}/share` | 200 | 403 | 403 | N/A | N/A | N/A |
| `POST /api/documents/{id}/revoke` | 200 | 403 | 403 | N/A | N/A | N/A |

### 3.3 Citizen Access Control & Manage Access UI
- **Permission Selection Modal**: Citizen selects between `👁 View Only (Default)` and `⬇ View + Download Allowed`.
- **Status Badges**:
  - `🔒 Private`
  - `🟢 Shared — View Only`
  - `🟢 Shared — View + Download`
  - `🔴 Access Revoked`
- **Manage Access Modal**: Allows citizens to review active provider shares, view permission levels, and click **Revoke Access** to instantly terminate provider access.

---

## 4. Verification & Testing Matrix

Automated security test suite in [`backend/tests/test_document_permissions.py`](file:///c:/Users/Nandan%20SV/Desktop/LexLogic/backend/tests/test_document_permissions.py) verifies:
- Test 1: Provider cannot access private document.
- Test 2: Provider with VIEW permission can view inline, download is blocked with 403.
- Test 3: Provider with VIEW_AND_DOWNLOAD can download attachment.
- Test 4: Citizen revocation immediately blocks provider access.
- Test 5: Provider cannot create self-share grants.
