# Server Tests — Plantation PMO (live deployment)

These tests run against the **deployed server**, not the local laptop codebase.
They are read-mostly but DO create a few test records (a throwaway project, WBD
nodes, one progress entry, one user) to exercise write flows end-to-end.

- **Frontend (web UI):** http://8.219.106.148:8022
- **Backend (API):** http://8.219.106.148:8021  *(the web app calls the API on
  port 8021 by default — see `src/services/api.ts`). If your API is on a
  different host/port, override with `API_HOST`.*

## Test accounts (password `password123` for all)

| Role                 | Email                   |
|----------------------|-------------------------|
| Project Manager      | pm@company.com          |
| Direksi              | direksi@company.com     |
| Finance              | finance@company.com     |
| Admin Proyek         | adminproyek@company.com |
| Administrator Sistem | admin@company.com       |

## Setup

```bash
cd server-tests
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python3 -m playwright install chromium      # only needed for e2e_test.py
```

## Run the API integration tests

```bash
# default API_HOST is http://8.219.106.148:8021
API_HOST=http://8.219.106.148:8021 python3 api_test.py
```

Outputs a console report + `results_api.json`.

Covers: auth (+negatives), projects CRUD, WBD lifecycle (create→nodes→submit→
approve/reject) incl. **planned_cost = volume × rate** auto-calc check, progress
workflow + RBAC, files upload, analytics endpoints, reports generate, users &
profile. RBAC is asserted by calling each guarded endpoint with the *wrong* role
and expecting `403`.

## Run the E2E browser tests

```bash
WEB_HOST=http://8.219.106.148:8022 python3 e2e_test.py
# watch it: HEADED=1 SLOWMO=200 python3 e2e_test.py
```

Outputs console report + `results_e2e.json` + `screenshots/*.png` on failures.

Covers: login (valid/invalid), dashboard + sidebar render, entering a project,
RBAC sidebar visibility per role, admin user-management page.

## Verified API contract (used by these tests)

Base: `{API_HOST}/api/v1`

| Area | Method | Path |
|------|--------|------|
| Login | POST | `/auth/login` → `{user, token}` (Bearer) |
| Me / Logout | GET/POST | `/auth/me`, `/auth/logout` |
| Projects | GET/POST | `/projects` ; detail GET/**PATCH** `/projects/{id}` |
| WBD versions | GET/POST | `/projects/{id}/wbd-versions` ; `/wbd-versions/{id}/submit\|approve\|reject` ; `/wbd-versions/pending` |
| WBD nodes | GET/POST | `/wbd-versions/{id}/nodes` ; PATCH/DELETE `/wbd-nodes/{id}` |
| Progress | GET/POST | `/projects/{id}/progress-entries` ; `/progress-entries/{id}/approve\|reject` |
| Actual cost | GET/POST | `/projects/{id}/actual-cost-transactions` ; `/actual-cost-transactions/{id}/approve\|reject` |
| Files | GET/POST | `/projects/{id}/files` (multipart: `file`,`file_category_id`,`file_type`) ; DELETE `/files/{id}` |
| File categories | GET/POST/PATCH | `/file-categories` |
| Analytics | GET | `/projects/{id}/dashboard\|gantt\|s-curve\|cost-analysis` |
| Reports | GET/POST | `/projects/{id}/reports` ; `/projects/{id}/reports/generate` |
| Users | GET/POST/PATCH | `/users`, POST `/user`, PATCH `/user/{id}`, `/user/{id}/toggle-active`, `/users/total-by-role` |
| Profile | PUT | `/profile`, `/profile/password` |

## ⚠️ Known frontend/backend contract mismatches to watch

The API tests explicitly probe these because they are likely causes of "broken
features" after deployment:

1. **Reports** — backend `generate` expects `report_type ∈
   {WEEKLY,MONTHLY,PROGRESS,COST,SUMMARY}` with `period_start`/`period_end`.
   The frontend ReportsPage sends `type=WEEKLY_PROGRESS…` with `date_from`/
   `date_to`. → expect `422`. (test: "generate (frontend payload)")
2. **Files** — backend requires `file_category_id` + `file_type`; older frontend
   code sent `category`. Confirm the deployed FE matches.
3. **Projects update** — backend uses **PATCH** `/projects/{id}` (not PUT).
4. **Users** — create is **POST `/user`** (singular); list is `/users`.

A failing test here points directly at the file to fix in the frontend/backend.
```
