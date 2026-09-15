# LifeCare — LifeCare

Full-stack clinic management system for a Malawi client. This repo holds **four apps**:

| Path | What it is |
|------|------------|
| `src/` (repo root app) | **Primary React frontend** (Vite, JS, 48 pages). Connects to the FastAPI backend via `src/api/customClient.js`. Entry point: `src/api/apiClient.js`. |
| `backend/` | **FastAPI + SQLAlchemy (async) backend — the system of record.** Routers in `backend/app/routers/`, models in `backend/app/models/`, Alembic chain `001` → `009` in `backend/migrations/versions/`. |
| `frontend/` | Secondary React 19 + TypeScript Vite app (TanStack Query, axios, Dexie offline store). Early scaffold — not the deployed frontend. |
| `mobile/` | Flutter mobile app (`lifecare_mobile`). |
| *(deleted)* `base44/` | Removed — original platform-sourced entity schemas. Gaps documented in `PATIENT_FLOW_AUDIT.md` (second pass) and `AUDIT_WORKING_DOCUMENT.md`. The app was originally scaffolded on the Base44 platform, then migrated to a self-hosted React + FastAPI stack; `src/api/customClient.js` is the FastAPI adapter that lets the original page components run unmodified. |
| `deploy/`, `.github/workflows/` | Railway deploy assets and CI (backend Docker + frontend build). |
| `docs/` + root `.docx`/`.pdf` | Client-facing system documentation and audit reports. |

## Commands

```powershell
# Backend tests (from backend/):
.\.venv\Scripts\python.exe -m pytest tests -q
# Backend migrations (offline SQL check):
.\.venv\Scripts\python.exe -m alembic upgrade head --sql
# Backend dev server (from backend/, against real Postgres — see Windows note below):
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --loop app.core.event_loop:selector_loop_factory
# Root frontend (from repo root):
npm test          # vitest (includes src/api/customClient.test.js adapter regressions)
npm run build     # vite build
npm run dev       # vite dev server, proxies /api to localhost:8000 (see vite.config.js)
```

**Windows dev server note:** `uvicorn`'s default "asyncio" loop hardcodes `ProactorEventLoop` on win32 (unless run with `--reload`/multiple workers), which psycopg's async driver cannot use — the backend fails at startup with `psycopg.InterfaceError`. The `--loop app.core.event_loop:selector_loop_factory` flag above works around it; standalone scripts (`seed_admin.py`, `seed_users.py`) already set `WindowsSelectorEventLoopPolicy` themselves and don't need it. Not an issue on Linux (CI, tests, Railway).

Tests use in-memory SQLite via `backend/tests/conftest.py` (httpx ASGITransport, no server needed). Sequences (MRN/INV/RCT/CLM/…) are Postgres sequences with a COUNT+1 SQLite fallback.

## Deployment

Two Railway services from this repo, each with its own `railway.json`: `backend/` (FastAPI, Dockerfile-built, Root Directory = `backend` in the Railway dashboard) and the repo root (frontend, Dockerfile-built nginx static serve). Attach a Railway Postgres plugin to the backend service — it injects `DATABASE_URL` automatically. **Deploy backend before frontend.** Migrations run via `preDeployCommand` (`backend/scripts/db_migrate.py`, configured in `backend/railway.json`). Set the frontend service's `VITE_BACKEND_URL` build variable to the backend service's public Railway URL + `/api/v1` (e.g. `https://lifecare-api.up.railway.app/api/v1`) — the frontend calls the backend cross-origin, so also set the backend's `ALLOWED_ORIGINS` to the frontend's public Railway URL. Do not deploy or push without explicit instruction from the operator.

## Sources of truth (do not re-derive)

- `AUDIT_WORKING_DOCUMENT.md` — all 66 security/audit findings with status and evidence.
- `PATIENT_FLOW_AUDIT.md` — patient-flow coverage: pass 1 (19 scenarios) + handover pass 2 (10 end-to-end scenarios, one test each in `backend/tests/test_patient_flows.py`).
- `PATIENT_FLOW_AUDIT.md` and `AUDIT_WORKING_DOCUMENT.md` — the `base44/` directory has been deleted; these two documents are the remaining implementation backlog.
