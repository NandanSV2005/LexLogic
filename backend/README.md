# LexLogic Backend API ⚖️

> **LexLogic Backend Core** — Intelligent Legal Services Marketplace Engine. Built with Python 3.14, FastAPI, SQLite, Pydantic V2, and direct `bcrypt` security.

---

## 🚀 Quickstart & Local Setup

### 1. Environment & Dependencies

Activate Python virtual environment and install dependencies:
```bash
cd backend
.\venv\Scripts\activate
pip install -r requirements.txt
```

### 2. Reset & Seed Demo Database

Run the deterministic seed script to reset `lexlogic.db` and populate realistic hackathon demo data:
```bash
python -m app.seed --reset
```

### 3. Run Local Server

Start Uvicorn dev server:
```bash
uvicorn app.main:app --reload --port 8000
```
* **API Root**: `http://127.0.0.1:8000/`
* **Interactive Swagger UI**: `http://127.0.0.1:8000/docs`
* **Health Check**: `http://127.0.0.1:8000/health`

---

## 🔑 Hackathon Demo Credentials

Use these pre-populated demo credentials for testing and evaluation:

| User Type | Name / Role | Demo Email | Password | Details |
| :--- | :--- | :--- | :--- | :--- |
| **Admin** | System Admin | `admin@lexlogic.demo` | `Admin123!` | Audit logs & Verification management |
| **Citizen** | Anita Desai | `citizen.anita@lexlogic.demo` | `Citizen123!` | Land dispute & Document owner |
| **Citizen** | Vikram Malhotra | `citizen.vikram@lexlogic.demo` | `Citizen123!` | Commercial arbitration client |
| **Provider** | Advocate Rajesh Sharma | `advocate.sharma@lexlogic.demo` | `Provider123!` | High Court Advocate, New Delhi (`VERIFIED`) |
| **Provider** | Advocate Meera Verma | `advocate.verma@lexlogic.demo` | `Provider123!` | Litigation Advocate, Mumbai (`SUBMITTED`) |
| **Provider** | Mediator Suresh Kapoor | `mediator.kapoor@lexlogic.demo` | `Provider123!` | Corporate Mediator, Bangalore (`VERIFIED`) |
| **Provider** | Mediator Priya Singh | `mediator.singh@lexlogic.demo` | `Provider123!` | Community Mediator, Delhi (`PENDING`) |
| **Provider** | Arbitrator Justice V. Iyer | `arbitrator.iyer@lexlogic.demo` | `Provider123!` | Senior Arbitrator, New Delhi (`VERIFIED`) |
| **Provider** | Notary Amit Gupta | `notary.gupta@lexlogic.demo` | `Provider123!` | Licensed Notary, New Delhi (`VERIFIED`) |
| **Provider** | Writer Kirit Patel | `writer.patel@lexlogic.demo` | `Provider123!` | Document Writer, Ahmedabad (`VERIFIED`) |

---

## 🛡️ Key System Architecture

1. **Role-Based Access Control (RBAC)**: Enforces `CITIZEN`, `PROVIDER`, and `ADMIN` boundaries across endpoints.
2. **Deterministic Matching Engine**: Weighted scoring algorithm (35% Service, 25% Location, 15% Verification, 15% Reliability, 10% Experience).
   * *Advocate Regulatory Rule*: Omits promotional rankings and returns factual non-promotional summaries (`match_score = None`, `is_advocate_factual_match = True`).
   * *Zero Commercial Influence*: Payment/subscription status has **0 weight and 0 impact**.
3. **Incentive Points & Reliability**: Points awarded for completing profile (+20), setting availability (+10), responding (+10), completing service (+20), and pro bono work (+30). Calculates dynamic 0–100 reliability score.
4. **Private Document Storage**: Storage outside web root (`backend/storage/documents/`) with magic header validation, explicit share grants, and revocation.
5. **Centralized Security Audit Trail**: Records immutable audit logs for all security-critical operations with metadata PII/password sanitization.

---

## 🧪 Running Automated Tests

Run the complete 56-case Pytest test suite:
```bash
pytest
```
