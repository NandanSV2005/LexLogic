# LexLogic Security Architecture & Hardening Guide

## 1. Overview
LexLogic enforces defense-in-depth security across the backend API, database, and web frontend. The system handles sensitive legal needs, citizen requests, provider accounts, and confidential legal documents with strict server-side authorization controls.

---

## 2. Security Architecture Principles

### Authentication & Token Management
- **Password Protection**: Passwords are hashed using `bcrypt` with salt rounds. Raw passwords and password hashes are never returned by APIs or logged in audit trails.
- **JWT Architecture**: Access tokens are signed using `HS256` with a server-side `JWT_SECRET` loaded from environment configuration (`.env`). Token expiration (`exp`) and UTC issue timestamps (`iat`) are validated strictly on every authenticated endpoint.
- **Generic Auth Failures**: Authentication failures return generic `401 Unauthorized` responses without revealing whether an email exists.

### Authorization & Server-Side Enforcements
- **Role-Based Access Control (RBAC)**: Enforced server-side via FastAPI dependencies (`require_citizen`, `require_provider`, `require_admin`).
- **IDOR Protection**: Every resource query (service requests, documents, provider profiles, appointments) verifies that `current_user` is authorized for that specific resource.
- **Untrusted Frontend**: Frontend route guards enhance UX, but the backend independently validates every API request.

---

## 3. Document Security & Access Control Model

### Confidential Document Vault
- **Default Privacy**: Citizen uploads default to `PRIVATE` visibility. Files are stored outside the public web root using unique UUID filenames.
- **Fine-Grained Permissions**: Citizens explicitly grant access to specific providers:
  - `VIEW`: Provider can view/stream document inline via authenticated backend endpoint (`GET /api/documents/{id}`). Downloading (`download=true`) returns `403 Forbidden`.
  - `VIEW_AND_DOWNLOAD`: Provider can both view inline and download the document file.
- **Instant Revocation**: When a citizen revokes access (`POST /api/documents/{id}/revoke`), share status is updated to `REVOKED`. Subsequent provider access attempts immediately fail with `403 Forbidden`.
- **Magic Header Byte Verification**: Uploads are validated against binary magic bytes (`%PDF-`, `\x89PNG`, `\xff\xd8\xff`) to prevent MIME and extension spoofing.

---

## 4. Audit Logging & Anti-Abuse Controls

### Immutable Audit Stream
- **Security Audit Logs**: High-value events (`USER_REGISTER`, `USER_LOGIN`, `DOCUMENT_UPLOAD`, `DOCUMENT_SHARE`, `DOCUMENT_REVOKE`, `ADMIN_VERIFICATION`) are logged to the database.
- **Sanitized Payloads**: Passwords, hashes, JWT tokens, and document content are stripped from audit log metadata.
- **Admin Access Only**: Audit logs are accessible strictly via `GET /api/audit` by `ADMIN` role users.

### Incentive & State Machine Integrity
- **Server-Controlled Points**: Points are awarded server-side with idempotency checks to prevent duplicate point transactions.
- **State Transition Guardrails**: Request status transitions follow valid workflow state graphs.

---

## 5. Network, Headers & Session Strategy

- **Security Headers**: Middleware enforces `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-XSS-Protection: 1; mode=block`.
- **CORS Policy**: Configured via `CORS_ORIGINS` environment settings without wildcard credentials in production.
- **Per-Tab Session Isolation**: Frontend uses per-tab `sessionStorage` for tokens to prevent cross-tab session overwrites.

---

## 6. Honest Limitations & Non-Claims

> [!NOTE]
> - **Provider Identity Verification**: Explicitly OUT OF SCOPE. Provider account verification remains a demonstration workflow and does not integrate with external government registries (e.g. Bar Council/Aadhaar).
> - **Screen Content Capture**: View-only mode prevents standard application-level downloading, but cannot prevent physical screen photography or external screen recording.
