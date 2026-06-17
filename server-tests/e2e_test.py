#!/usr/bin/env python3
"""
Live-server E2E browser test suite for the Plantation PMO web app.

Drives a real Chromium browser against the DEPLOYED frontend.
Captures a screenshot for every failure into ./screenshots/.

Usage:
  pip install -r requirements.txt
  python3 -m playwright install chromium
  WEB_HOST=http://8.219.106.148:8022 python3 e2e_test.py
  HEADED=1 python3 e2e_test.py     # watch it run

Output:
  - Console report
  - results_e2e.json
  - screenshots/<test>.png on failures
"""

import os
import sys
import json
import datetime as dt

try:
    from playwright.sync_api import sync_playwright, TimeoutError as PWTimeout
except ImportError:
    print("Missing Playwright. Run:")
    print("  pip install -r requirements.txt")
    print("  python3 -m playwright install chromium")
    sys.exit(1)

WEB_HOST = os.environ.get("WEB_HOST", "http://8.219.106.148:8022").rstrip("/")
HEADED = os.environ.get("HEADED", "0") == "1"
SLOWMO = int(os.environ.get("SLOWMO", "0"))

ACCOUNTS = {
    "PM":         "pm@company.com",
    "DIREKSI":    "direksi@company.com",
    "FINANCE":    "finance@company.com",
    "ADMINPROYEK":"adminproyek@company.com",
    "ADMINSYS":   "admin@company.com",
}
PASSWORD = "password123"

SHOT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "screenshots")
os.makedirs(SHOT_DIR, exist_ok=True)

RESULTS = []


def record(module, test, role, expected, actual, ok, page=None, note=""):
    RESULTS.append({
        "module": module, "test": test, "role": role,
        "expected": expected, "actual": actual,
        "status": "PASS" if ok else "FAIL", "note": note,
    })
    flag = "PASS" if ok else "FAIL"
    print(f"[{flag}] {module:14s} | {test:48s} | {('| '+note) if note else ''}")
    if not ok and page is not None:
        fn = f"{module}_{test}".replace(" ", "_").replace("/", "-")[:80] + ".png"
        try:
            page.screenshot(path=os.path.join(SHOT_DIR, fn), full_page=True)
        except Exception:
            pass


def do_login(page, email, password):
    """Log in via the UI. Returns True if it lands off /login."""
    page.goto(f"{WEB_HOST}/login", wait_until="networkidle")
    # Fill email + password — try common selectors
    filled = False
    for sel in ['input[type="email"]', 'input[name="email"]', 'input[placeholder*="mail" i]']:
        if page.locator(sel).count():
            page.fill(sel, email)
            filled = True
            break
    for sel in ['input[type="password"]', 'input[name="password"]']:
        if page.locator(sel).count():
            page.fill(sel, password)
            break
    # Submit
    for sel in ['button[type="submit"]', 'button:has-text("Masuk")', 'button:has-text("Login")', 'button:has-text("Sign")']:
        if page.locator(sel).count():
            page.click(sel)
            break
    try:
        page.wait_for_url(lambda u: "/login" not in u, timeout=8000)
    except PWTimeout:
        pass
    return "/login" not in page.url, filled


def logout_clear(context):
    """Clear auth state between roles."""
    try:
        context.clear_cookies()
        for p in context.pages:
            p.evaluate("() => { try { localStorage.clear(); } catch(e){} }")
    except Exception:
        pass


def test_login_flows(context):
    print("\n=== E2E: LOGIN ===")
    page = context.new_page()

    # wrong password shows error / stays on login
    ok_land, filled = do_login(page, ACCOUNTS["PM"], "wrongpass")
    stayed = "/login" in page.url
    record("Login", "wrong password stays on /login", "PM",
           "stay on login", page.url, stayed and filled, page,
           "" if filled else "could not find login inputs")

    logout_clear(context)

    # valid login redirects to /projects
    ok_land, _ = do_login(page, ACCOUNTS["PM"], PASSWORD)
    to_projects = "/projects" in page.url or ok_land
    record("Login", "valid login (PM) leaves /login", "PM",
           "/projects", page.url, to_projects, page)
    page.close()


def test_dashboard_and_sidebar(context):
    print("\n=== E2E: DASHBOARD + SIDEBAR ===")
    page = context.new_page()
    do_login(page, ACCOUNTS["PM"], PASSWORD)
    page.wait_for_timeout(1500)

    # sidebar should list core nav labels (project-scoped appear after entering a project)
    body_txt = page.content().lower()
    has_dashboard = "dashboard" in body_txt or "projects" in body_txt
    record("Dashboard", "app shell renders after login", "PM",
           "shell visible", "yes" if has_dashboard else "no", has_dashboard, page)

    # try to open first project
    opened = False
    for sel in ['button:has-text("Buka")', 'a:has-text("Buka")', 'table tbody tr']:
        if page.locator(sel).count():
            try:
                page.locator(sel).first.click()
                page.wait_for_timeout(1500)
                opened = "/projects/" in page.url
                break
            except Exception:
                pass
    record("Dashboard", "open a project -> project scope", "PM",
           "/projects/{id}", page.url, opened, page,
           "" if opened else "no project rows or click failed")

    if opened:
        txt = page.content()
        nav_items = ["WBD", "Gantt", "Progress", "Document", "S-Curve", "Cost", "Report"]
        present = [n for n in nav_items if n.lower() in txt.lower()]
        record("Sidebar", "project nav items visible", "PM",
               ">=5 of 7", f"{len(present)}/7", len(present) >= 5, page,
               f"found: {present}")
    page.close()


def test_rbac_sidebar(context):
    print("\n=== E2E: RBAC SIDEBAR VISIBILITY ===")
    # Admin sees User Settings
    page = context.new_page()
    do_login(page, ACCOUNTS["ADMINSYS"], PASSWORD)
    page.wait_for_timeout(1500)
    admin_txt = page.content().lower()
    record("RBAC", "admin sees 'User Settings'", "ADMINSYS",
           "visible", "yes" if "user settings" in admin_txt or "pengaturan" in admin_txt else "no",
           ("user settings" in admin_txt or "pengaturan" in admin_txt), page)
    page.close()
    logout_clear(context)

    # PM does NOT see User Settings
    page = context.new_page()
    do_login(page, ACCOUNTS["PM"], PASSWORD)
    page.wait_for_timeout(1500)
    pm_txt = page.content().lower()
    record("RBAC", "PM does NOT see 'User Settings'", "PM",
           "hidden", "hidden" if "user settings" not in pm_txt else "VISIBLE",
           "user settings" not in pm_txt, page)
    page.close()
    logout_clear(context)

    # Direksi sees Persetujuan WBD
    page = context.new_page()
    do_login(page, ACCOUNTS["DIREKSI"], PASSWORD)
    page.wait_for_timeout(1500)
    dir_txt = page.content().lower()
    record("RBAC", "Direksi sees 'Persetujuan WBD'", "DIREKSI",
           "visible", "yes" if "persetujuan" in dir_txt else "no",
           "persetujuan" in dir_txt, page)
    page.close()


def test_admin_page(context):
    print("\n=== E2E: ADMIN PAGE ===")
    page = context.new_page()
    do_login(page, ACCOUNTS["ADMINSYS"], PASSWORD)
    page.wait_for_timeout(1000)
    # navigate to /admin
    page.goto(f"{WEB_HOST}/admin", wait_until="networkidle")
    page.wait_for_timeout(1500)
    txt = page.content().lower()
    has_user_table = "manajemen user" in txt or "email" in txt
    record("Admin", "admin can view user management", "ADMINSYS",
           "user table", "yes" if has_user_table else "no", has_user_table, page)
    page.close()


def run():
    print(f"Target Web: {WEB_HOST}  (headed={HEADED})")
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=not HEADED, slow_mo=SLOWMO)
        context = browser.new_context(viewport={"width": 1440, "height": 900},
                                      ignore_https_errors=True)
        try:
            test_login_flows(context)
            logout_clear(context)
            test_dashboard_and_sidebar(context)
            logout_clear(context)
            test_rbac_sidebar(context)
            logout_clear(context)
            test_admin_page(context)
        finally:
            context.close()
            browser.close()

    total = len(RESULTS)
    passed = sum(1 for r in RESULTS if r["status"] == "PASS")
    failed = total - passed
    print("\n" + "=" * 78)
    print(f"E2E SUMMARY:  {total} tests   ✅ {passed} passed   ❌ {failed} failed")
    print("=" * 78)
    if failed:
        print("\nFAILURES (screenshots in ./screenshots/):")
        for r in RESULTS:
            if r["status"] == "FAIL":
                print(f"  ❌ [{r['module']}] {r['test']}  (role={r['role']})  {r['note']}")

    out = {
        "web_host": WEB_HOST, "run_at": dt.datetime.now().isoformat(),
        "total": total, "passed": passed, "failed": failed, "results": RESULTS,
    }
    path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "results_e2e.json")
    with open(path, "w") as f:
        json.dump(out, f, indent=2)
    print(f"\nResults written to: {path}")
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    run()
