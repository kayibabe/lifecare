# LifeCare — HIMS

Full-stack Hospital Information Management System (HIMS) for LifeCare, Malawi.

## Apps in this repo

| Directory | Description |
|-----------|-------------|
| `src/` | Primary React frontend (Vite, JS). Connects to the FastAPI backend. |
| `backend/` | FastAPI + SQLAlchemy async backend — system of record. |
| `frontend/` | Secondary React 19 + TypeScript scaffold (early-stage). |
| `mobile/` | Flutter mobile app (`lifecare_mobile`). |
| `deploy/` | Railway configs, nginx, and local startup scripts. |

## Local development

**Prerequisites:** Node 20+, Python 3.11+, PostgreSQL 15+

### Frontend

```bash
npm install
cp .env.example .env.local   # set VITE_BACKEND_URL if needed
npm run dev                   # starts at http://localhost:5173
```

### Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\pip install -r requirements.txt
cp ../.env.example .env       # fill in DB_*, SECRET_KEY
alembic upgrade head
uvicorn app.main:app --reload  # starts at http://localhost:8000
```

### Tests

```bash
# Backend (from backend/):
.venv\Scripts\python -m pytest tests -q

# Frontend (from repo root):
npm test
```

## Deployment

Two Railway services, each built from this repo via Docker: `backend/` (FastAPI) and the repo root (frontend, served by nginx). Attach a Railway Postgres plugin to the backend service.

Deploy backend before frontend. Migrations run automatically via the backend's `preDeployCommand` (`backend/railway.json`). See `CLAUDE.md` for the full setup (env vars, service variable wiring).
