#!/usr/bin/env python3
"""
Live-server API integration test suite for the Plantation PMO backend.

Runs against the DEPLOYED server only — does not touch local code.

Contract (verified from backend routes/requests):
  - Base URL: {API_HOST}/api/v1
  - Login: POST /auth/login  body {email, password} -> {user, token}
  - Auth:  Bearer token in Authorization header
  - Roles: Project Manager, Direksi, Finance, Admin Proyek, Administrator Sistem

Usage:
  pip install -r requirements.txt
  API_HOST=http://8.219.106.148:8021 python3 api_test.py
  (defaults below if env not set)

Output:
  - Console report table
  - results_api.json  (machine-readable)
"""

import os
import sys
import json
import io
import datetime as dt

try:
    import requests
except ImportError:
    print("Missing dependency. Run: pip install -r requirements.txt")
    sys.exit(1)

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
# NOTE: The frontend (served at :8022) calls the API at :8021 by default
# (see src/services/api.ts VITE_API_URL fallback). Override with API_HOST.
API_HOST = os.environ.get("API_HOST", "http://8.219.106.148:8021").rstrip("/")
BASE = f"{API_HOST}/api/v1"
TIMEOUT = 20

ACCOUNTS = {
    "PM":      "pm@company.com",
    "DIREKSI": "direksi@company.com",
    "FINANCE": "finance@company.com",
    "ADMINPROYEK": "adminproyek@company.com",
    "ADMINSYS": "admin@company.com",
}
PASSWORD = "password123"

# ---------------------------------------------------------------------------
# Result tracking
# ---------------------------------------------------------------------------
RESULTS = []   # list of dicts


def record(module, test, method, url, role, expected, actual, ok, note=""):
    RESULTS.append({
        "module": module, "test": test, "method": method, "url": url,
        "role": role, "expected": expected, "actual": actual,
        "status": "PASS" if ok else "FAIL", "note": note,
    })
    flag = "PASS" if ok else "FAIL"
    print(f"[{flag}] {module:14s} | {test:42s} | exp={expected} act={actual} {('| '+note) if note else ''}")


# ---------------------------------------------------------------------------
# HTTP helpers
# ---------------------------------------------------------------------------
def url(path):
    return f"{BASE}{path}"


def req(method, path, token=None, json_body=None, files=None, data=None, params=None):
    headers = {"Accept": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    try:
        r = requests.request(
            method, url(path), headers=headers, json=json_body,
            files=files, data=data, params=params, timeout=TIMEOUT,
        )
        return r
    except requests.RequestException as e:
        # synthesize a fake response-like object
        class _Err:
            status_code = 0
            text = str(e)
            def json(self_inner):
                return {"error": str(e)}
        return _Err()


def body(r):
    try:
        return r.json()
    except Exception:
        return {}


# ---------------------------------------------------------------------------
# Login all roles
# ---------------------------------------------------------------------------
def login(email, password):
    r = req("POST", "/auth/login", json_body={"email": email, "password": password})
    if r.status_code == 200:
        return body(r).get("token"), r
    return None, r


def authenticate_all():
    tokens = {}
    print("\n=== AUTH: logging in all roles ===")
    for role, email in ACCOUNTS.items():
        tok, r = login(email, PASSWORD)
        ok = tok is not None and r.status_code == 200
        record("Auth", f"login {role} ({email})", "POST", "/auth/login",
               role, 200, r.status_code, ok,
               "" if ok else f"no token / {body(r)}")
        if ok:
            tokens[role] = tok
    return tokens


# ---------------------------------------------------------------------------
# Test sections
# ---------------------------------------------------------------------------
def test_auth_negatives(tokens):
    print("\n=== AUTH: negative + me/logout ===")
    # wrong password
    _, r = login(ACCOUNTS["PM"], "wrongpass")
    record("Auth", "login wrong password -> 401", "POST", "/auth/login",
           "PM", 401, r.status_code, r.status_code == 401)
    # unknown email
    _, r = login("nobody@company.com", PASSWORD)
    record("Auth", "login unknown email -> 401", "POST", "/auth/login",
           "-", 401, r.status_code, r.status_code == 401)
    # me with token
    if "PM" in tokens:
        r = req("GET", "/auth/me", token=tokens["PM"])
        record("Auth", "me with token -> 200", "GET", "/auth/me",
               "PM", 200, r.status_code, r.status_code == 200)
    # me without token
    r = req("GET", "/auth/me")
    record("Auth", "me without token -> 401", "GET", "/auth/me",
           "-", 401, r.status_code, r.status_code == 401)


def test_projects(tokens):
    print("\n=== PROJECTS ===")
    state = {"project_id": None}
    pm = tokens.get("PM")
    if not pm:
        return state

    # list
    r = req("GET", "/projects", token=pm)
    ok = r.status_code == 200
    record("Projects", "list projects -> 200", "GET", "/projects", "PM", 200, r.status_code, ok)
    data = body(r).get("data", []) if ok else []
    if data:
        state["project_id"] = data[0].get("id")

    # create (PM allowed)
    code = "TEST-" + dt.datetime.now().strftime("%y%m%d%H%M%S")
    payload = {
        "project_code": code,
        "project_name": "API Test Project " + code,
        "client_name": "Test Client",
        "location": "Test Estate",
        "start_date": "2026-06-01",
        "end_date": "2026-12-31",
        "status": "PLANNING",
        "description": "Created by automated API test",
    }
    r = req("POST", "/projects", token=pm, json_body=payload)
    ok = r.status_code in (200, 201)
    new_id = body(r).get("data", {}).get("id") if ok else None
    record("Projects", "create project (PM) -> 201", "POST", "/projects",
           "PM", "200/201", r.status_code, ok, "" if ok else str(body(r)))
    if new_id:
        state["project_id"] = new_id

    # update via PATCH (backend uses PATCH, not PUT!)
    if state["project_id"]:
        r = req("PATCH", f"/projects/{state['project_id']}", token=pm,
                json_body={"project_name": "API Test Project (updated)"})
        record("Projects", "update project PATCH -> 200", "PATCH",
               f"/projects/{{id}}", "PM", 200, r.status_code, r.status_code == 200,
               "" if r.status_code == 200 else str(body(r)))

    # finance create -> expect 403 (read-only role)
    fin = tokens.get("FINANCE")
    if fin:
        r = req("POST", "/projects", token=fin, json_body={**payload, "project_code": code + "F"})
        record("Projects", "create as Finance -> 403", "POST", "/projects",
               "FINANCE", 403, r.status_code, r.status_code == 403,
               "" if r.status_code == 403 else "RBAC not enforced")
    return state


def test_wbd(tokens, state):
    print("\n=== WBD ===")
    pm = tokens.get("PM")
    pid = state.get("project_id")
    if not (pm and pid):
        record("WBD", "skipped (no project/PM)", "-", "-", "-", "-", "-", False, "prereq missing")
        return state

    # list versions
    r = req("GET", f"/projects/{pid}/wbd-versions", token=pm)
    record("WBD", "list versions -> 200", "GET", "/projects/{id}/wbd-versions",
           "PM", 200, r.status_code, r.status_code == 200)

    # create version
    r = req("POST", f"/projects/{pid}/wbd-versions", token=pm, json_body={})
    ok = r.status_code in (200, 201)
    vid = body(r).get("data", {}).get("id") if ok else None
    record("WBD", "create version (PM) -> 201", "POST", "/projects/{id}/wbd-versions",
           "PM", "200/201", r.status_code, ok, "" if ok else str(body(r)))
    state["version_id"] = vid
    if not vid:
        return state

    # add GROUP node
    r = req("POST", f"/wbd-versions/{vid}/nodes", token=pm, json_body={
        "node_type": "GROUP", "code": "A", "name": "Grup A Test",
    })
    ok = r.status_code in (200, 201)
    gid = body(r).get("data", {}).get("id") if ok else None
    record("WBD", "add GROUP node -> 201", "POST", "/wbd-versions/{vid}/nodes",
           "PM", "200/201", r.status_code, ok, "" if ok else str(body(r)))

    # add ITEM node with volume*rate -> verify planned_cost auto-calc
    r = req("POST", f"/wbd-versions/{vid}/nodes", token=pm, json_body={
        "parent_node_id": gid, "node_type": "ITEM", "code": "A.1",
        "name": "Item Test", "unit": "Ha", "volume": 10, "rate": 1000000,
        "start_date": "2026-06-01", "duration_days": 30,
    })
    ok = r.status_code in (200, 201)
    item = body(r).get("data", {}) if ok else {}
    nid = item.get("id")
    planned = item.get("planned_cost")
    calc_ok = ok and planned is not None and abs(float(planned) - 10_000_000) < 1
    record("WBD", "add ITEM node -> 201", "POST", "/wbd-versions/{vid}/nodes",
           "PM", "200/201", r.status_code, ok, "" if ok else str(body(r)))
    record("WBD", "planned_cost = volume*rate (10*1jt=10jt)", "POST",
           "/wbd-versions/{vid}/nodes", "PM", "10000000", planned, calc_ok,
           "" if calc_ok else "auto-calc wrong/missing")

    # update volume -> recalc
    if nid:
        r = req("PATCH", f"/wbd-nodes/{nid}", token=pm, json_body={"volume": 20})
        item = body(r).get("data", {})
        planned = item.get("planned_cost")
        recalc_ok = r.status_code == 200 and planned is not None and abs(float(planned) - 20_000_000) < 1
        record("WBD", "update volume -> planned_cost recalc (20jt)", "PATCH",
               "/wbd-nodes/{id}", "PM", "20000000", planned, recalc_ok,
               "" if recalc_ok else str(body(r)))

    # submit
    r = req("POST", f"/wbd-versions/{vid}/submit", token=pm)
    record("WBD", "submit version (PM) -> 200", "POST", "/wbd-versions/{vid}/submit",
           "PM", 200, r.status_code, r.status_code == 200, "" if r.status_code == 200 else str(body(r)))

    # PM approve -> expect 403
    r = req("POST", f"/wbd-versions/{vid}/approve", token=pm)
    record("WBD", "approve as PM -> 403", "POST", "/wbd-versions/{vid}/approve",
           "PM", 403, r.status_code, r.status_code == 403,
           "" if r.status_code == 403 else "RBAC not enforced")

    # Direksi approve -> 200
    direksi = tokens.get("DIREKSI")
    if direksi:
        r = req("POST", f"/wbd-versions/{vid}/approve", token=direksi)
        record("WBD", "approve as Direksi -> 200", "POST", "/wbd-versions/{vid}/approve",
               "DIREKSI", 200, r.status_code, r.status_code == 200,
               "" if r.status_code == 200 else str(body(r)))

    # Direksi pending list
    if direksi:
        r = req("GET", "/wbd-versions/pending", token=direksi)
        record("WBD", "pending approvals list -> 200", "GET", "/wbd-versions/pending",
               "DIREKSI", 200, r.status_code, r.status_code == 200)
    return state


def test_progress(tokens, state):
    print("\n=== PROGRESS ===")
    pid = state.get("project_id")
    ap = tokens.get("ADMINPROYEK")
    pm = tokens.get("PM")
    fin = tokens.get("FINANCE")
    if not pid:
        record("Progress", "skipped (no project)", "-", "-", "-", "-", "-", False, "prereq missing")
        return

    # need an ITEM node id from active baseline; fetch via active version nodes
    node_id = None
    if pm and state.get("version_id"):
        r = req("GET", f"/wbd-versions/{state['version_id']}/nodes", token=pm)
        for n in body(r).get("data", []):
            if n.get("node_type") == "ITEM":
                node_id = n.get("id")
                break

    # list (any role)
    if pm:
        r = req("GET", f"/projects/{pid}/progress-entries", token=pm)
        record("Progress", "list entries -> 200", "GET", "/projects/{id}/progress-entries",
               "PM", 200, r.status_code, r.status_code == 200)

    # Admin Proyek create -> PENDING_PM_APPROVAL
    entry_id = None
    if ap and node_id:
        r = req("POST", f"/projects/{pid}/progress-entries", token=ap, json_body={
            "wbd_node_id": node_id, "progress_date": "2026-06-15",
            "progress_volume": 1, "note": "API test entry",
        })
        ok = r.status_code in (200, 201)
        d = body(r).get("data", {})
        entry_id = d.get("id")
        record("Progress", "create (Admin Proyek) -> 201", "POST",
               "/projects/{id}/progress-entries", "ADMINPROYEK", "200/201",
               r.status_code, ok, "" if ok else str(body(r)))
        if ok:
            st = d.get("status")
            record("Progress", "new entry status PENDING_PM_APPROVAL", "POST",
                   "/projects/{id}/progress-entries", "ADMINPROYEK",
                   "PENDING_PM_APPROVAL", st, st == "PENDING_PM_APPROVAL")
    elif ap:
        record("Progress", "create (Admin Proyek) SKIPPED", "POST",
               "/projects/{id}/progress-entries", "ADMINPROYEK", "-", "-", False,
               "no ITEM node / baseline available")

    # Finance create -> 403
    if fin and node_id:
        r = req("POST", f"/projects/{pid}/progress-entries", token=fin, json_body={
            "wbd_node_id": node_id, "progress_date": "2026-06-15", "progress_volume": 1,
        })
        record("Progress", "create as Finance -> 403", "POST",
               "/projects/{id}/progress-entries", "FINANCE", 403, r.status_code,
               r.status_code == 403, "" if r.status_code == 403 else "RBAC not enforced")

    # PM approve
    if pm and entry_id:
        r = req("POST", f"/progress-entries/{entry_id}/approve", token=pm)
        ok = r.status_code == 200
        st = body(r).get("data", {}).get("status")
        record("Progress", "PM approve -> 200 APPROVED", "POST",
               "/progress-entries/{id}/approve", "PM", "200/APPROVED",
               f"{r.status_code}/{st}", ok, "" if ok else str(body(r)))

    # Admin Proyek approve -> 403
    if ap and entry_id:
        r = req("POST", f"/progress-entries/{entry_id}/approve", token=ap)
        record("Progress", "approve as Admin Proyek -> 403", "POST",
               "/progress-entries/{id}/approve", "ADMINPROYEK", 403, r.status_code,
               r.status_code == 403, "" if r.status_code == 403 else "RBAC not enforced")


def test_files(tokens, state):
    print("\n=== FILES ===")
    pid = state.get("project_id")
    pm = tokens.get("PM")
    if not (pid and pm):
        record("Files", "skipped (no project/PM)", "-", "-", "-", "-", "-", False, "prereq missing")
        return

    # need a file_category_id
    r = req("GET", "/file-categories", token=pm)
    cats = body(r).get("data", []) if r.status_code == 200 else []
    record("Files", "list file-categories -> 200", "GET", "/file-categories",
           "PM", 200, r.status_code, r.status_code == 200)
    cat_id = cats[0].get("id") if cats else None

    # list files
    r = req("GET", f"/projects/{pid}/files", token=pm)
    record("Files", "list files -> 200", "GET", "/projects/{id}/files",
           "PM", 200, r.status_code, r.status_code == 200)

    # upload (multipart) — backend requires file_category_id + file_type
    if cat_id:
        fake = io.BytesIO(b"test document content")
        files = {"file": ("test.txt", fake, "text/plain")}
        data = {"file_category_id": cat_id, "file_type": "DOCUMENT",
                "caption": "API test upload"}
        r = req("POST", f"/projects/{pid}/files", token=pm, files=files, data=data)
        ok = r.status_code in (200, 201)
        fid = body(r).get("data", {}).get("id") if ok else None
        record("Files", "upload file -> 201", "POST", "/projects/{id}/files",
               "PM", "200/201", r.status_code, ok, "" if ok else str(body(r)))
        if fid:
            r = req("DELETE", f"/files/{fid}", token=pm)
            record("Files", "archive/delete file -> 200", "DELETE", "/files/{id}",
                   "PM", "200/204", r.status_code, r.status_code in (200, 204),
                   "" if r.status_code in (200, 204) else str(body(r)))
    else:
        record("Files", "upload SKIPPED (no category)", "POST", "/projects/{id}/files",
               "PM", "-", "-", False, "no file_category_id available")


def test_analytics(tokens, state):
    print("\n=== ANALYTICS ===")
    pid = state.get("project_id")
    pm = tokens.get("PM")
    if not (pid and pm):
        record("Analytics", "skipped (no project/PM)", "-", "-", "-", "-", "-", False, "prereq missing")
        return
    for name, path in [
        ("dashboard", f"/projects/{pid}/dashboard"),
        ("gantt", f"/projects/{pid}/gantt"),
        ("s-curve", f"/projects/{pid}/s-curve"),
        ("cost-analysis", f"/projects/{pid}/cost-analysis"),
    ]:
        r = req("GET", path, token=pm)
        record("Analytics", f"{name} -> 200", "GET", path.replace(pid, "{id}"),
               "PM", 200, r.status_code, r.status_code == 200,
               "" if r.status_code == 200 else str(body(r))[:120])


def test_reports(tokens, state):
    print("\n=== REPORTS ===")
    pid = state.get("project_id")
    pm = tokens.get("PM")
    if not (pid and pm):
        record("Reports", "skipped (no project/PM)", "-", "-", "-", "-", "-", False, "prereq missing")
        return

    # list
    r = req("GET", f"/projects/{pid}/reports", token=pm)
    record("Reports", "list reports -> 200", "GET", "/projects/{id}/reports",
           "PM", 200, r.status_code, r.status_code == 200)

    # generate — backend expects report_type in [WEEKLY,MONTHLY,PROGRESS,COST,SUMMARY]
    # and period_start/period_end. (Frontend currently sends different values — watch for 422.)
    r = req("POST", f"/projects/{pid}/reports/generate", token=pm, json_body={
        "report_type": "PROGRESS", "period_start": "2026-06-01", "period_end": "2026-06-30",
    })
    ok = r.status_code in (200, 201)
    record("Reports", "generate (valid contract) -> 201", "POST",
           "/projects/{id}/reports/generate", "PM", "200/201", r.status_code, ok,
           "" if ok else str(body(r)))

    # also test the payload the FRONTEND sends, to prove/disprove the mismatch
    r = req("POST", f"/projects/{pid}/reports/generate", token=pm, json_body={
        "type": "WEEKLY_PROGRESS", "date_from": "2026-06-01", "date_to": "2026-06-30",
    })
    record("Reports", "generate (frontend payload) -> expect 422 mismatch", "POST",
           "/projects/{id}/reports/generate", "PM", 422, r.status_code,
           r.status_code == 422,
           "confirms FE/BE contract mismatch" if r.status_code == 422 else "unexpected")


def test_users_profile(tokens):
    print("\n=== USERS & PROFILE ===")
    admin = tokens.get("ADMINSYS")
    pm = tokens.get("PM")

    # admin list users
    if admin:
        r = req("GET", "/users", token=admin)
        record("Users", "list users (admin) -> 200", "GET", "/users",
               "ADMINSYS", 200, r.status_code, r.status_code == 200)
        # total by role
        r = req("GET", "/users/total-by-role", token=admin)
        record("Users", "total-by-role (admin) -> 200", "GET", "/users/total-by-role",
               "ADMINSYS", 200, r.status_code, r.status_code == 200)

    # PM list users -> expect 403
    if pm:
        r = req("GET", "/users", token=pm)
        record("Users", "list users (PM) -> 403", "GET", "/users",
               "PM", 403, r.status_code, r.status_code == 403,
               "" if r.status_code == 403 else "RBAC not enforced")

    # create user (admin) — endpoint is POST /v1/user (singular)
    new_uid = None
    if admin:
        email = "autotest_" + dt.datetime.now().strftime("%y%m%d%H%M%S") + "@company.com"
        r = req("POST", "/user", token=admin, json_body={
            "full_name": "Auto Test User", "email": email,
            "password": "password123", "role": "ADMIN_PROYEK",
        })
        ok = r.status_code in (200, 201)
        new_uid = body(r).get("data", {}).get("id") if ok else None
        record("Users", "create user (admin) POST /user -> 201", "POST", "/user",
               "ADMINSYS", "200/201", r.status_code, ok, "" if ok else str(body(r)))
        if new_uid:
            r = req("PATCH", f"/user/{new_uid}/toggle-active", token=admin,
                    json_body={"is_active": False})
            record("Users", "toggle-active (admin) -> 200", "PATCH",
                   "/user/{id}/toggle-active", "ADMINSYS", 200, r.status_code,
                   r.status_code == 200, "" if r.status_code == 200 else str(body(r)))

    # profile update (PM updates own)
    if pm:
        r = req("PUT", "/profile", token=pm, json_body={"full_name": "Project Manager (test)"})
        record("Profile", "update profile -> 200", "PUT", "/profile",
               "PM", 200, r.status_code, r.status_code == 200,
               "" if r.status_code == 200 else str(body(r)))
        # wrong current password
        r = req("PUT", "/profile/password", token=pm, json_body={
            "current_password": "definitely_wrong",
            "password": "newpassword123", "password_confirmation": "newpassword123",
        })
        record("Profile", "change password wrong current -> 422", "PUT", "/profile/password",
               "PM", 422, r.status_code, r.status_code == 422,
               "" if r.status_code == 422 else "validation not enforced")


# ---------------------------------------------------------------------------
# Report writer
# ---------------------------------------------------------------------------
def write_report():
    total = len(RESULTS)
    passed = sum(1 for r in RESULTS if r["status"] == "PASS")
    failed = total - passed

    print("\n" + "=" * 78)
    print(f"SUMMARY:  {total} tests   ✅ {passed} passed   ❌ {failed} failed")
    print("=" * 78)

    if failed:
        print("\nFAILURES:")
        for r in RESULTS:
            if r["status"] == "FAIL":
                print(f"  ❌ [{r['module']}] {r['test']}")
                print(f"     {r['method']} {r['url']}  (role={r['role']})")
                print(f"     expected={r['expected']} actual={r['actual']}  {r['note']}")

    out = {
        "api_host": API_HOST,
        "base_url": BASE,
        "run_at": dt.datetime.now().isoformat(),
        "total": total, "passed": passed, "failed": failed,
        "results": RESULTS,
    }
    path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "results_api.json")
    with open(path, "w") as f:
        json.dump(out, f, indent=2)
    print(f"\nMachine-readable results written to: {path}")
    return failed


def main():
    print(f"Target API: {BASE}")
    tokens = authenticate_all()
    if not tokens:
        print("\nFATAL: could not authenticate ANY account. Check API_HOST / server.")
        write_report()
        sys.exit(2)

    test_auth_negatives(tokens)
    state = test_projects(tokens)
    state = test_wbd(tokens, state)
    test_progress(tokens, state)
    test_files(tokens, state)
    test_analytics(tokens, state)
    test_reports(tokens, state)
    test_users_profile(tokens)

    failed = write_report()
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
