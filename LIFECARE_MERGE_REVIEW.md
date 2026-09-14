# LifeCare merge and review record

Date: 2026-09-14

## Decision

LifeCare is based on the current `D:\WebApps\lifecare` working tree, with the
Windows-compatible backend launcher from `D:\WebApps\lifecare` added to
`backend/run_dev.py`.

## Comparison

| Area | LifeCare | LifeCare | LifeCare decision |
|---|---|---|---|
| Primary frontend | React/Vite JavaScript app with the latest staff-facing edit-form changes | Same application family, older commit line | Use LifeCare as the base |
| Backend | FastAPI, async SQLAlchemy, auth, audit, clinical, billing, pharmacy, theatre, mortuary, insurance and reporting modules | Same backend/module topology | Preserve the complete LifeCare backend |
| Secondary clients | TypeScript frontend scaffold and Flutter scaffold | Same scaffolds | Preserve both as non-deployed clients |
| Portability | LifeCare already contains absolute `.env` loading and Windows selector-loop support in the committed line | Working tree repeats those fixes and adds `backend/run_dev.py` | Keep both safeguards and the launcher |
| Branding/deployment | LifeCare identifiers and clinic branding | LifeCare identifiers and clinic branding | Rebrand product-facing/runtime identifiers to LifeCare; retain historical audit evidence |
| Working-tree changes | Staff-facing form edits and docs present | Windows config edits and launcher present | Include both sets where non-conflicting |

## Scope and safety

- The source folders were not modified.
- `.git`, `node_modules`, and `.env.local` were not copied.
- No database, migration, deployment, or external service was run.
- Historical audit documents remain source-labelled where they describe LifeCare/LifeCare findings.
- `fly.toml` and deployment settings are local configuration only; deployment is not authorized by this merge.

## Review status

- Completed: source comparison and base selection.
- Completed: LifeCare working tree assembled and product-facing rebrand applied.
- Completed: frontend unit tests on the selected LifeCare source before merge: 10 passed.
- Completed: LifeCare production build and lint pass; backend tests pass (75/75); offline Alembic SQL generation passes.
- Needs attention: the existing mixed JS/TS scaffold fails `npm run typecheck` with many baseline typing errors; database-backed runtime verification requires configured PostgreSQL/Redis and explicit environment values.
- Blocked: none for local code review; production deployment remains out of scope.
