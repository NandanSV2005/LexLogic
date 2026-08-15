# LexLogic API Integration Guide for Frontend Developers

Welcome to the LexLogic Backend API Reference. This document details all 21 REST endpoints, authentication protocols, role-based authorization requirements, request/response models, and realistic JSON payload examples for integrating the frontend interface.

---

## 1. Core Architecture & Authentication Protocol

### Base URL
- Local Development: `http://localhost:8000`
- API Prefix: `/api`
- Swagger UI / OpenAPI Docs: `http://localhost:8000/docs`
- ReDoc Docs: `http://localhost:8000/redoc`

### Authentication Scheme
- Scheme: Standard OAuth2 `HTTPBearer` JWT Token.
- Header: Include `Authorization: Bearer <JWT_TOKEN>` in all authenticated requests.
- Token Expiration: 30 minutes.

### Supported User Roles (`UserRole` Enum)
- `CITIZEN`: Citizen seeking legal services or legal-aid support.
- `PROVIDER`: Service provider (Advocate, Mediator, Arbitrator, Notary, Document Writer).
- `ADMIN`: Platform administrator managing provider verification and audit logs.

---

## 2. Authentication Endpoints

### 2.1 User Registration (`POST /api/auth/register`)
- **Method**: `POST`
- **URL**: `/api/auth/register`
- **Authentication**: None Required
- **Role Required**: Public
- **Request Body**:
```json
{
  "email": "new.citizen@example.com",
  "password": "SecurePassword123!",
  "role": "CITIZEN"
}
```
- **Response (`201 Created`)**:
```json
{
  "access_token": "eyJhbGciOiJIUzI1Ni...",
  "token_type": "bearer",
  "user": {
    "id": 10,
    "email": "new.citizen@example.com",
    "role": "CITIZEN",
    "is_active": true,
    "created_at": "2026-08-15T10:00:00Z"
  }
}
```
- **Common Error Statuses**:
  - `400 Bad Request`: Email already registered.
  - `422 Unprocessable Entity`: Password missing digits/special characters or email invalid.

---

### 2.2 User Login (`POST /api/auth/login`)
- **Method**: `POST`
- **URL**: `/api/auth/login`
- **Authentication**: None Required
- **Role Required**: Public
- **Request Body**:
```json
{
  "email": "citizen.anita@lexlogic.demo",
  "password": "Citizen123!"
}
```
- **Response (`200 OK`)**:
```json
{
  "access_token": "eyJhbGciOiJIUzI1Ni...",
  "token_type": "bearer",
  "user": {
    "id": 1,
    "email": "citizen.anita@lexlogic.demo",
    "role": "CITIZEN",
    "is_active": true,
    "created_at": "2026-08-15T08:00:00Z"
  }
}
```
- **Common Error Statuses**:
  - `401 Unauthorized`: Invalid email or password credentials.

---

### 2.3 Current Authenticated User (`GET /api/auth/me`)
- **Method**: `GET`
- **URL**: `/api/auth/me`
- **Authentication**: Required (`Bearer Token`)
- **Role Required**: Any (`CITIZEN`, `PROVIDER`, `ADMIN`)
- **Response (`200 OK`)**:
```json
{
  "id": 1,
  "email": "citizen.anita@lexlogic.demo",
  "role": "CITIZEN",
  "is_active": true,
  "created_at": "2026-08-15T08:00:00Z"
}
```
- **Common Error Statuses**:
  - `401 Unauthorized`: Token missing, invalid, or expired.

---

## 3. Provider Endpoints

### 3.1 Create Provider Profile (`POST /api/providers/profile`)
- **Method**: `POST`
- **URL**: `/api/providers/profile`
- **Authentication**: Required (`Bearer Token`)
- **Role Required**: `PROVIDER`
- **Request Body**:
```json
{
  "provider_type": "ADVOCATE",
  "full_name": "Advocate Ramesh Sharma",
  "phone": "+91-9876543210",
  "location": "Mumbai, Maharashtra",
  "experience_years": 12,
  "bio": "Senior Bar Council Advocate specializing in civil property disputes."
}
```
- **Response (`201 Created`)**:
```json
{
  "id": 1,
  "user_id": 3,
  "provider_type": "ADVOCATE",
  "full_name": "Advocate Ramesh Sharma",
  "phone": "+91-9876543210",
  "location": "Mumbai, Maharashtra",
  "experience_years": 12,
  "bio": "Senior Bar Council Advocate specializing in civil property disputes.",
  "verification_status": "PENDING",
  "profile_completion_percentage": 50.0,
  "is_profile_complete": false,
  "points": 0,
  "reliability_score": 100.0,
  "rating": 4.8,
  "availability_status": "AVAILABLE",
  "field_values": []
}
```

---

### 3.2 Get Current Provider Profile (`GET /api/providers/me`)
- **Method**: `GET`
- **URL**: `/api/providers/me`
- **Authentication**: Required (`Bearer Token`)
- **Role Required**: `PROVIDER`
- **Response (`200 OK`)**:
```json
{
  "id": 1,
  "user_id": 3,
  "provider_type": "ADVOCATE",
  "full_name": "Advocate Ramesh Sharma",
  "phone": "+91-9876543210",
  "location": "Mumbai, Maharashtra",
  "experience_years": 12,
  "bio": "Senior Bar Council Advocate specializing in civil property disputes.",
  "verification_status": "VERIFIED",
  "profile_completion_percentage": 100.0,
  "is_profile_complete": true,
  "points": 150,
  "reliability_score": 98.5,
  "rating": 4.9,
  "availability_status": "AVAILABLE",
  "field_values": [
    {
      "field_name": "practice_area",
      "field_label": "Practice Area(s)",
      "value": "Property & Real Estate Law"
    },
    {
      "field_name": "registration_details",
      "field_label": "Bar Council / Registration Details",
      "value": "MAH/1234/2012"
    }
  ]
}
```

---

### 3.3 Update Provider Profile (`PUT /api/providers/profile`)
- **Method**: `PUT`
- **URL**: `/api/providers/profile`
- **Authentication**: Required (`Bearer Token`)
- **Role Required**: `PROVIDER`
- **Request Body**:
```json
{
  "full_name": "Advocate Ramesh V. Sharma",
  "phone": "+91-9876543210",
  "location": "Mumbai, Maharashtra",
  "experience_years": 13,
  "bio": "Updated senior advocate biography."
}
```
- **Response (`200 OK`)**: Provider Profile JSON

---

### 3.4 Update Generic Dynamic Fields (`PUT /api/providers/fields`)
- **Method**: `PUT`
- **URL**: `/api/providers/fields`
- **Authentication**: Required (`Bearer Token`)
- **Role Required**: `PROVIDER`
- **Request Body**:
```json
{
  "fields": [
    {
      "field_name": "practice_area",
      "value": "Property Law, Commercial Litigation"
    },
    {
      "field_name": "registration_details",
      "value": "MAH/1234/2012"
    }
  ]
}
```
- **Response (`200 OK`)**: Provider Profile JSON with updated completion percentage.

---

### 3.5 Provider Dashboard (`GET /api/providers/dashboard`)
- **Method**: `GET`
- **URL**: `/api/providers/dashboard`
- **Authentication**: Required (`Bearer Token`)
- **Role Required**: `PROVIDER`
- **Response (`200 OK`)**:
```json
{
  "provider_id": 1,
  "full_name": "Advocate Ramesh Sharma",
  "provider_type": "ADVOCATE",
  "verification_status": "VERIFIED",
  "profile_completion_percentage": 100.0,
  "is_profile_complete": true,
  "points": 150,
  "reliability_score": 98.5,
  "rating": 4.9,
  "availability_status": "AVAILABLE",
  "total_requests": 15,
  "completed_requests": 14,
  "response_rate": 100.0,
  "pending_interactions": 1,
  "shared_documents_count": 2
}
```

---

### 3.6 Update Provider Availability (`PUT /api/providers/availability`)
- **Method**: `PUT`
- **URL**: `/api/providers/availability`
- **Authentication**: Required (`Bearer Token`)
- **Role Required**: `PROVIDER`
- **Request Body**:
```json
{
  "availability_status": "BUSY"
}
```
- **Response (`200 OK`)**: Provider Profile JSON

---

### 3.7 Admin Provider Verification (`PUT /api/providers/{provider_id}/verify`)
- **Method**: `PUT`
- **URL**: `/api/providers/1/verify`
- **Authentication**: Required (`Bearer Token`)
- **Role Required**: `ADMIN`
- **Request Body**:
```json
{
  "verification_status": "VERIFIED"
}
```
- **Response (`200 OK`)**:
```json
{
  "id": 1,
  "full_name": "Advocate Ramesh Sharma",
  "verification_status": "VERIFIED",
  "points": 100
}
```

---

## 4. Citizen & Service Request Endpoints

### 4.1 Create Service Request (`POST /api/requests`)
- **Method**: `POST`
- **URL**: `/api/requests`
- **Authentication**: Required (`Bearer Token`)
- **Role Required**: `CITIZEN`
- **Request Body**:
```json
{
  "service_category": "Property Law",
  "description": "I need urgent assistance to verify title deeds for ancestral plot sale in Mumbai.",
  "location": "Mumbai, Maharashtra",
  "preferred_provider_type": "ADVOCATE",
  "urgency": "HIGH",
  "legal_aid_interest": false
}
```
- **Response (`201 Created`)**:
```json
{
  "id": 1,
  "citizen_id": 1,
  "service_category": "Property Law",
  "description": "I need urgent assistance to verify title deeds for ancestral plot sale in Mumbai.",
  "location": "Mumbai, Maharashtra",
  "preferred_provider_type": "ADVOCATE",
  "urgency": "HIGH",
  "legal_aid_interest": false,
  "status": "OPEN",
  "created_at": "2026-08-15T11:00:00Z",
  "updated_at": "2026-08-15T11:00:00Z"
}
```

---

### 4.2 List Citizen Service Requests (`GET /api/requests`)
- **Method**: `GET`
- **URL**: `/api/requests`
- **Authentication**: Required (`Bearer Token`)
- **Role Required**: `CITIZEN` or `ADMIN`
- **Response (`200 OK`)**: Array of ServiceRequest items.

---

### 4.3 Get Service Request Details (`GET /api/requests/{request_id}`)
- **Method**: `GET`
- **URL**: `/api/requests/1`
- **Authentication**: Required (`Bearer Token`)
- **Role Required**: `CITIZEN` (Owner), matched `PROVIDER`, or `ADMIN`
- **Response (`200 OK`)**: ServiceRequest JSON with interaction history.

---

### 4.4 Provider Response to Request (`POST /api/requests/{request_id}/respond`)
- **Method**: `POST`
- **URL**: `/api/requests/1/respond`
- **Authentication**: Required (`Bearer Token`)
- **Role Required**: `PROVIDER`
- **Request Body**:
```json
{
  "action": "ACCEPT"
}
```
- **Response (`200 OK`)**:
```json
{
  "request_id": 1,
  "provider_id": 1,
  "status": "ACCEPTED",
  "response_time_seconds": 45.2
}
```

---

## 5. Matching Engine Endpoint (`POST /api/matching/find-providers`)

- **Method**: `POST`
- **URL**: `/api/matching/find-providers`
- **Authentication**: Required (`Bearer Token`)
- **Role Required**: Any (`CITIZEN`, `PROVIDER`, `ADMIN`)
- **Request Body**:
```json
{
  "service_category": "Property Law",
  "location": "Mumbai, Maharashtra",
  "preferred_provider_type": "ADVOCATE",
  "limit": 10
}
```
- **Response (`200 OK`)**:
```json
{
  "request": {
    "service_category": "Property Law",
    "location": "Mumbai, Maharashtra",
    "preferred_provider_type": "ADVOCATE"
  },
  "total_matches": 2,
  "matches": [
    {
      "provider_id": 1,
      "full_name": "Advocate Ramesh Sharma",
      "provider_type": "ADVOCATE",
      "location": "Mumbai, Maharashtra",
      "experience_years": 12,
      "match_score": 96.5,
      "breakdown": {
        "service_match": 100.0,
        "location_match": 100.0,
        "verification_score": 100.0,
        "reliability_score": 98.5,
        "experience_score": 100.0
      },
      "verification_status": "VERIFIED",
      "reliability_score": 98.5,
      "rating": 4.9,
      "availability_status": "AVAILABLE"
    }
  ]
}
```

> [!NOTE]
> Matching weights: Service Category (40%), Location (20%), Verification (15%), Reliability (15%), Experience (10%). Payment / subscription status has ZERO influence on scores.

---

## 6. Document Vault & Access Control Endpoints

### 6.1 Upload Private Document (`POST /api/documents/upload`)
- **Method**: `POST`
- **URL**: `/api/documents/upload`
- **Authentication**: Required (`Bearer Token`)
- **Role Required**: `CITIZEN`
- **Content-Type**: `multipart/form-data`
- **Form Data**:
  - `title`: "Title Deed Document"
  - `file`: `<Binary PDF/PNG/JPG file, max 10MB>`
- **Response (`201 Created`)**:
```json
{
  "id": 1,
  "owner_id": 1,
  "title": "Title Deed Document",
  "filename": "Title_Deed_Document.pdf",
  "file_size_bytes": 1048576,
  "mime_type": "application/pdf",
  "visibility": "PRIVATE",
  "created_at": "2026-08-15T11:15:00Z"
}
```

---

### 6.2 Share Document with Provider (`POST /api/documents/{document_id}/share`)
- **Method**: `POST`
- **URL**: `/api/documents/1/share`
- **Authentication**: Required (`Bearer Token`)
- **Role Required**: `CITIZEN` (Owner)
- **Request Body**:
```json
{
  "provider_id": 1
}
```
- **Response (`201 Created`)**:
```json
{
  "id": 1,
  "document_id": 1,
  "shared_with_provider_id": 1,
  "status": "ACTIVE",
  "created_at": "2026-08-15T11:20:00Z"
}
```

---

### 6.3 Revoke Document Access (`POST /api/documents/{document_id}/revoke`)
- **Method**: `POST`
- **URL**: `/api/documents/1/revoke`
- **Authentication**: Required (`Bearer Token`)
- **Role Required**: `CITIZEN` (Owner)
- **Request Body**:
```json
{
  "provider_id": 1
}
```
- **Response (`200 OK`)**:
```json
{
  "id": 1,
  "document_id": 1,
  "shared_with_provider_id": 1,
  "status": "REVOKED",
  "created_at": "2026-08-15T11:20:00Z"
}
```

---

### 6.4 Download Document (`GET /api/documents/{document_id}/download`)
- **Method**: `GET`
- **URL**: `/api/documents/1/download`
- **Authentication**: Required (`Bearer Token`)
- **Role Required**: Owner `CITIZEN`, Authorized `PROVIDER` (Active Share), or `ADMIN`
- **Response (`200 OK`)**: Binary File Stream (`application/pdf`, etc.)
- **Error Responses**:
  - `403 Forbidden`: Access denied (Unshared provider or Citizen B attempting access).
  - `404 Not Found`: Document ID does not exist.

---

## 7. Security Audit Log Endpoint (`GET /api/audit/logs`)

- **Method**: `GET`
- **URL**: `/api/audit/logs`
- **Authentication**: Required (`Bearer Token`)
- **Role Required**: `ADMIN`
- **Query Parameters**: `action` (optional), `user_id` (optional), `limit` (default 50)
- **Response (`200 OK`)**:
```json
{
  "total": 1,
  "logs": [
    {
      "id": 1,
      "user_id": 1,
      "action": "DOCUMENT_SHARED",
      "metadata_json": {
        "document_id": 1,
        "provider_id": 1,
        "share_status": "ACTIVE"
      },
      "ip_address": "127.0.0.1",
      "created_at": "2026-08-15T11:20:00Z"
    }
  ]
}
```

---

## 8. Summary of Common Error Payload Structure

All API validation and HTTP errors return structured JSON:
```json
{
  "detail": "Validation error in request body or parameters",
  "errors": [
    {
      "field": "body -> email",
      "message": "value is not a valid email address"
    }
  ]
}
```
