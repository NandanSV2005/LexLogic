# LexLogic — Incentive Engine & Security Architecture

This document provides a comprehensive technical overview of **LexLogic's Common Incentive Engine** and **Security Controls Architecture**, addressing all key technical questions raised during judge presentation reviews.

---

## PART 1 — INCENTIVE ARCHITECTURE & POINT LEDGER MODEL

### 1. Common Incentive Engine Overview
LexLogic implements a **single, unified backend incentive engine** across all 5 legal provider professions (`ADVOCATE`, `MEDIATOR`, `ARBITRATOR`, `NOTARY`, `DOCUMENT_WRITER`). Rather than building fragmented point systems, LexLogic models incentive calculation through a deterministic transaction pipeline:

$$\text{Provider Type} \longrightarrow \text{Valid Activities} \longrightarrow \text{Incentive Event} \longrightarrow \text{Point Transaction} \longrightarrow \text{Provider Point Balance}$$

---

### 2. Provider-Type Activity Model
Professional eligibility rules determine which incentive actions are valid for a given provider category:

| Provider Type | Allowed Incentive Activities |
| :--- | :--- |
| **ADVOCATE** | Profile Completion (+20), Availability Update (+10), Request Response (+10), Service Completion (+20), Pro-Bono Legal Aid (+30) |
| **MEDIATOR** | Profile Completion (+20), Availability Update (+10), Mediation Request Response (+10), Mediation Completion (+20), Pro-Bono Legal Aid (+30) |
| **ARBITRATOR** | Profile Completion (+20), Availability Update (+10), Arbitration Request Response (+10), Arbitration Completion (+20) |
| **NOTARY** | Profile Completion (+20), Availability Update (+10), Notary Request Response (+10), Notary Service Completion (+20) |
| **DOCUMENT_WRITER** | Profile Completion (+20), Availability Update (+10), Document Request Response (+10), Document Completion (+20) |

Activities not professionally aligned with a provider type (e.g. non-pro-bono categories executing legal-aid claims) are rejected at the backend service boundary.

---

### 3. Centralized Incentive Point Values
Point values are defined in a centralized backend rule map in [`points_service.py`](file:///c:/Users/Nandan%20SV/Desktop/LexLogic/backend/app/services/points_service.py) rather than scattered as hardcoded values across UI components:

```python
INCENTIVE_RULES = {
    PointAction.PROFILE_COMPLETED: 20,   # +20 points for 100% profile completion
    PointAction.AVAILABILITY_ADDED: 10,  # +10 points for setting/updating availability
    PointAction.REQUEST_RESPONDED: 10,   # +10 points for responding to eligible requests
    PointAction.SERVICE_COMPLETED: 20,   # +20 points for completing a service request
    PointAction.PRO_BONO_COMPLETED: 30,  # +30 points for completing pro-bono / legal-aid cases
}
```

---

### 4. Point Transaction Ledger Model
Every point addition creates an immutable audit record in the `point_transactions` database table:

```sql
CREATE TABLE point_transactions (
    id INTEGER PRIMARY KEY,
    provider_id INTEGER NOT NULL REFERENCES providers(id),
    action VARCHAR NOT NULL,
    points INTEGER NOT NULL,
    reference_id INTEGER NULL, -- Links to ServiceRequest ID where applicable
    description VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL
);
```

Provider `points` balance is transactionally derived from the ledger history, ensuring 100% auditability and zero balance fabrication.

---

### 5. Backend Duplicate Reward Protection
To prevent gamification and abuse, duplicate reward rules are strictly enforced server-side:

1. **Profile Completion (+20)**: Granted exactly **once** per provider lifecycle.
2. **Availability Update (+10)**: Subject to a **24-hour cooldown** window to prevent rapid toggle spamming.
3. **Request Response (+10)**: Uniquely enforced per `(provider_id, request_id)` reference.
4. **Service / Pro-Bono Completion (+20 / +30)**: Uniquely enforced per `(provider_id, request_id, action)` reference.

---

### 6. Separation of Points vs. Reliability Score
LexLogic strictly distinguishes **Activity (Points)** from **Performance (Reliability)**:

- **Points (Activity Meter)**: Measures cumulative platform participation, responsiveness, and pro-bono contribution.
- **Reliability Score (0 – 100)**: Evaluates quality, verification, and performance:
  $$\text{Reliability} = f(\text{Profile Completeness}, \text{Bar/License Verification}, \text{Response Rate}, \text{Completed Requests}, \text{Availability})$$

Points do **NOT** directly divide into reliability, ensuring high activity alone cannot mask poor performance or unverified status.

---

### 7. Matching Engine vs. Incentives & Non-Paid Placement
LexLogic explicitly separates matching placement from incentive points:
- **No Paid Visibility / Ranking**: Points, fees, or subscriptions can **NEVER** purchase higher match scores, priority placement, or preferential citizen access.
- **Suitability Matching**: Matching is citizen-initiated and calculated purely using factual criteria:
  - Exact/Related Legal Domain Fit
  - Geographic Location Proximity
  - Provider Experience Years & Bar/License Verification Status

---

### 8. Bar Council & Advocate Compliance
In strict adherence to Bar Council of India regulations prohibiting legal advertising and promotional solicitation:
- LexLogic **NEVER** uses promotional language such as *"Top Lawyer"*, *"Rank #1"*, *"Best Advocate"*, or *"Sponsored Lawyer"*.
- Discovery displays only verified factual information: practice area, experience, location, and verified status.

---

## PART 2 — SECURITY HARDENING ARCHITECTURE

### 9. Technical Security Claim
> *"LexLogic uses layered security controls including authentication, RBAC, resource-level authorization (IDOR protection), private document storage with explicit share/revocation lifecycle, server-side validation, secure password hashing, sanitized audit logging, sliding-window rate limiting, security headers, and HTTPS in production."*

---

### 10. Security Controls Summary

| Security Layer | Implementation Mechanism | Status |
| :--- | :--- | :--- |
| **Authentication** | Passlib `bcrypt` hashing + PyJWT signed tokens loaded from environment `SECRET_KEY` | Verified |
| **Role-Based Access (RBAC)** | FastAPI dependencies (`require_provider`, `require_admin`) restricting role boundaries | Verified |
| **IDOR Protection** | Resource ownership & explicit relationship checks on all `/{id}` endpoints | Verified |
| **Document Security** | Non-public private disk storage (`PRIVATE_UPLOAD_DIR`), explicit share grants, instant revocation (403) | Verified |
| **File Upload Hardening** | MIME check, 10MB size limit, binary magic bytes header validation, safe UUID filenames, path traversal sanitization | Verified |
| **Rate Limiting** | In-memory sliding window rate limiter on `/auth/login`, `/auth/register`, and `/documents/upload` | Verified |
| **Security Headers** | Middleware setting `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`, `X-XSS-Protection` | Verified |
| **CORS Configuration** | Explicit allowed origins parsed from environment configuration (no production wildcard `*`) | Verified |
| **Audit Logging** | Append-only security audit log (`audit_logs` table) stripping passwords, hashes, and JWT tokens | Verified |
| **Secret Management** | Environment variable configuration via Pydantic `BaseSettings` (`.env` ignored in `.gitignore`) | Verified |

---

### 11. Document Lifecycle & RBAC State Machine

```
   [ Upload File ] ──> Server-side Magic Bytes & Size Check
                            │
                            ▼
                   [ PRIVATE Storage ] (Owner Access Only)
                            │
                            ▼ (Owner explicitly calls POST /share)
                    [ ACTIVE Share ] (Owner + Shared Provider Access)
                            │
                            ▼ (Owner calls POST /revoke)
                    [ REVOKED Share ] (403 Forbidden Access Rejected)
```

---

### 12. Security Test Matrix Summary
Automated backend pytest suite ([`test_security_matrix.py`](file:///c:/Users/Nandan%20SV/Desktop/LexLogic/backend/tests/test_security_matrix.py)) validates **71 passed tests (100%)** covering:
1. Citizen A cannot access Citizen B document (403 Forbidden).
2. Provider cannot access unshared document (403 Forbidden).
3. Provider loses access immediately upon revocation (403 Forbidden).
4. Non-admin user cannot access admin endpoints (403 Forbidden).
5. Provider cannot modify another provider's profile (403 Forbidden).
6. Provider cannot manipulate another provider's request relationship (403 Forbidden).
7. Incomplete provider cannot express interest (403 Forbidden).
8. Duplicate Express Interest is rejected (400 Bad Request).
9. Duplicate incentive events cannot award duplicate points.
10. Invalid JWT access token is rejected (401 Unauthorized).
11. Missing JWT access token is rejected (401 Unauthorized).
12. Malformed file upload lacking binary magic bytes header is rejected (400 Bad Request).
13. Oversized file upload (>10MB) is rejected (400 Bad Request).
14. Path traversal filenames (`../../../etc/passwd`) are safely neutralized.
15. Sensitive credentials (passwords, hashes, tokens) are completely absent from audit log metadata.

---

### 13. Production Deployment Architecture
- **Frontend**: Deployed on Vercel with automatic SSL/TLS termination (HTTPS).
- **Backend**: Deployed on Render/Docker with SSL/TLS reverse proxy termination (HTTPS).
- **HTTP/HTTPS Policy**: Production traffic is strictly HTTPS; unencrypted HTTP requests are automatically redirected by edge proxies.
