# LEXLOGIC — PRODUCTION DEPLOYMENT GUIDE

This document provides exact, step-by-step production deployment instructions for the **LexLogic Legal Services Marketplace**.

---

## 1. Architecture Overview

- **Frontend Hosting**: Vercel (React + Vite Single-Page Application)
- **Backend Hosting**: Render (FastAPI + Uvicorn Web Service)
- **Database Engine**: SQLite mounted on Render Persistent Disk
- **Document Storage**: Private file storage mounted on Render Persistent Disk
- **Authentication**: JWT Bearer Tokens with role-based access control (RBAC)

---

## 2. Local Pre-Deployment Verification

Before committing or pushing to production, verify that local tests and builds succeed cleanly:

```bash
# 1. Run Backend Pytest Suite (56/56 must pass)
cd backend
py -m pytest

# 2. Run Frontend Typecheck & Production Build
cd ../frontend
npx tsc --noEmit
npm run build
```

---

## 3. Git Repository Preparation

Ensure your repository code is pushed to your Git provider (GitHub / GitLab / Bitbucket):

- Ensure `.env` files are NOT committed to Git (verifiable in `.gitignore`).
- Secrets and tokens must only be provided via environment variables in Render and Vercel dashboards.

---

## 4. Render Backend Deployment Setup

### Step A: Create Render Web Service
1. Log into your [Render Dashboard](https://dashboard.render.com/).
2. Click **New +** → **Web Service**.
3. Connect your Git repository and select the repository containing `LexLogic`.
4. Configure the Web Service settings:
   - **Name**: `lexlogic-backend` (or your preferred name)
   - **Region**: Choose the region closest to your users (e.g., Oregon, Frankfurt, Singapore)
   - **Root Directory**: `backend`
   - **Runtime**: `Python 3`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`

---

### Step B: Add Render Persistent Disk (CRITICAL)

To ensure SQLite database and private document uploads persist across deploys and server restarts:

1. Scroll down to **Disks** section in Render Web Service configuration.
2. Click **Add Disk**:
   - **Name**: `lexlogic-data`
   - **Mount Path**: `/var/data`
   - **Size**: `1 GB` (or larger depending on expected document volume)

---

### Step C: Configure Render Environment Variables

In the **Environment** tab of your Render Web Service, add the following environment variables:

| Variable Name | Required Value / Description | Example |
| :--- | :--- | :--- |
| `ENVIRONMENT` | Must be set to `production` | `production` |
| `JWT_SECRET_KEY` | A strong, randomly generated secret string | `c8f9b0e14a27d351...` |
| `DATABASE_PATH` | Path to SQLite database file on persistent disk | `/var/data/lexlogic.db` |
| `PRIVATE_UPLOAD_DIR` | Path to upload directory on persistent disk | `/var/data/private_uploads` |
| `CORS_ORIGINS` | Comma-separated list of allowed frontend origins | `https://<your-vercel-domain>.vercel.app` |
| `PYTHONUNBUFFERED` | Ensures stdout/stderr logs stream immediately | `1` |

> [!IMPORTANT]
> Do NOT set `JWT_SECRET_KEY` to the dev key in production mode. The backend enforces a non-default secret in production.

---

### Step D: Initialize & Seed Production Database

Once the Render service is deployed:

1. Open the **Shell** tab in the Render Dashboard for your Web Service.
2. Run the manual seed command to initialize tables and populate initial demo accounts:
   ```bash
   python -m app.seed
   ```
   *(Optional: Use `python -m app.seed --reset` only if you need to wipe and re-initialize data).*

---

### Step E: Verify Backend Health

Access the root health check endpoint of your deployed Render Web Service in a browser or curl:

```bash
curl -i https://<your-render-backend-domain>.onrender.com/health
```

**Expected Response**: `HTTP/1.1 200 OK`
```json
{"status": "ok"}
```

---

## 5. Vercel Frontend Deployment Setup

### Step A: Import Project to Vercel

1. Log into your [Vercel Dashboard](https://vercel.com/dashboard).
2. Click **Add New...** → **Project**.
3. Import your Git repository.
4. Configure project settings:
   - **Framework Preset**: `Vite`
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build` (`tsc -b && vite build`)
   - **Output Directory**: `dist`

---

### Step B: Configure Vercel Environment Variables

In Vercel Project Settings → **Environment Variables**, set:

| Variable Name | Value |
| :--- | :--- |
| `VITE_API_URL` | `https://<your-render-backend-domain>.onrender.com` |

---

### Step C: SPA Rewrite Verification (`vercel.json`)

Ensure `frontend/vercel.json` exists in your repository to handle single-page application (SPA) routing:

```json
{
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

This prevents direct browser navigations (e.g. `/login`, `/citizen/dashboard`, `/admin/audit`) from throwing 404 errors.

---

## 6. Post-Deployment CORS Update

1. Once Vercel assigns your live domain (e.g., `https://lexlogic-app.vercel.app`), copy it.
2. Go back to **Render Dashboard** → **Environment Variables**.
3. Update `CORS_ORIGINS` to include your Vercel production domain:
   ```env
   CORS_ORIGINS=https://lexlogic-app.vercel.app,http://localhost:5173
   ```
4. Save changes. Render will automatically perform a zero-downtime redeploy.

---

## 7. Production Testing Walkthrough

1. **Landing Page**: Navigate to `https://<your-vercel-domain>.vercel.app`. Verify page renders and components load smoothly.
2. **Citizen Auth & Dashboard**:
   - Log in with `citizen.anita@lexlogic.demo` / `Citizen123!`.
   - Verify request list and matching engine functionality.
3. **Private Document Storage & Security**:
   - Upload a new document PDF in Citizen Portal.
   - Share document with `Advocate Sharma`.
   - Log out and log in as `advocate.sharma@lexlogic.demo` / `Provider123!`.
   - Verify document download succeeds via authenticated token stream.
   - Revoke document share from Citizen account and verify provider download returns `403 Forbidden`.
4. **Admin Portal**:
   - Log in with `admin@lexlogic.demo` / `Admin123!`.
   - Verify audit logs and provider verification management.

---

## 8. Troubleshooting

- **CORS Error in Browser Console**: Verify `CORS_ORIGINS` in Render environment variables exactly matches the protocol and domain in browser address bar (including `https://` and without trailing slashes).
- **404 on Page Refresh on Vercel**: Ensure `frontend/vercel.json` exists with the `/index.html` rewrite rule.
- **500 Internal Server Error on Database Actions**: Verify Render persistent disk is mounted at `/var/data` and `DATABASE_PATH=/var/data/lexlogic.db` is set.
- **Documents Disappear After Deploy**: Ensure `PRIVATE_UPLOAD_DIR=/var/data/private_uploads` is mounted on persistent storage.
