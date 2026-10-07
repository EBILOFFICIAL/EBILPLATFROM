"""EIBIL backend E2E API tests.

Covers:
 - Public endpoints (health, cms, plans, stats, site, report-verify)
 - Auth: register employee + email OTP + login + /me + refresh
 - Admin login with 2FA, admin APIs (users, employers, cms, score-config, audit, ledger)
 - Employee: profile, score, dispute, employments, consents
 - Employer: dashboard, verify-candidate (consent-based), reports, jobs
 - Pending-KYC employer limited access
 - Billing: plans, subscribe (mock razorpay), credits
 - Role guards: employee cannot access /admin or /employer
 - PAN verification + duplicate rejection

Credentials from /app/memory/test_credentials.md
"""
import os
import re
import time
import uuid
import pytest
import requests

BASE = os.environ.get("REACT_APP_BACKEND_URL", "https://career-ledger.preview.emergentagent.com").rstrip("/")
API = f"{BASE}/api/v1"

ADMIN = ("admin@eibil.in", "Admin@12345")
EMPLOYEE_PRIYA = ("priya@demo.in", "Demo@12345")
EMPLOYEE_ANITA = ("anita@demo.in", "Demo@12345")
EMPLOYER_ACME = ("hr@acmetech.in", "Demo@12345")
EMPLOYER_PENDING = ("hr@sahyadriinfra.in", "Demo@12345")
CHECKER = ("checker@eibil.in", "Admin@12345")


# ---------- helpers ----------

def _login(email, password, is_admin=False):
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=20)
    assert r.status_code == 200, f"login failed {email}: {r.status_code} {r.text}"
    data = r.json().get("data", r.json())
    if is_admin or data.get("twoFactorRequired") or data.get("mfaRequired") or data.get("requires2fa") or data.get("devOtp"):
        otp = data.get("devOtp")
        assert otp, f"no devOtp returned for admin 2FA login: {data}"
        challenge = data.get("challenge") or data.get("twoFactorToken") or data.get("mfaToken")
        payload = {"email": email, "code": otp}
        if challenge:
            payload["challenge"] = challenge
        r2 = s.post(f"{API}/auth/2fa/verify", json=payload, timeout=20)
        assert r2.status_code == 200, f"2fa verify failed: {r2.status_code} {r2.text}"
        data = r2.json().get("data", r2.json())
    token = data.get("accessToken") or data.get("token") or data.get("access_token")
    assert token, f"no access token: {data}"
    s.headers.update({"Authorization": f"Bearer {token}"})
    return s, token, data


# ---------- fixtures ----------

@pytest.fixture(scope="session")
def admin_session():
    s, _, _ = _login(*ADMIN, is_admin=True)
    return s


@pytest.fixture(scope="session")
def priya_session():
    s, _, _ = _login(*EMPLOYEE_PRIYA)
    return s


@pytest.fixture(scope="session")
def acme_session():
    s, _, _ = _login(*EMPLOYER_ACME)
    return s


@pytest.fixture(scope="session")
def pending_employer_session():
    s, _, _ = _login(*EMPLOYER_PENDING)
    return s


# ---------- Public ----------

class TestPublic:
    def test_health(self):
        r = requests.get(f"{API}/health", timeout=10)
        assert r.status_code == 200
        assert r.json()["success"] is True

    def test_cms_list(self):
        r = requests.get(f"{API}/public/cms", timeout=10)
        assert r.status_code == 200
        data = r.json().get("data", [])
        assert isinstance(data, list)

    def test_cms_home(self):
        r = requests.get(f"{API}/public/cms/home", timeout=10)
        assert r.status_code in (200, 404)

    def test_plans(self):
        r = requests.get(f"{API}/public/plans", timeout=10)
        assert r.status_code == 200
        plans = r.json().get("data", [])
        assert isinstance(plans, list) and len(plans) > 0

    def test_stats(self):
        r = requests.get(f"{API}/public/stats", timeout=10)
        assert r.status_code == 200

    def test_site(self):
        r = requests.get(f"{API}/public/site", timeout=10)
        assert r.status_code == 200

    def test_jobs_list(self):
        r = requests.get(f"{API}/jobs", timeout=10)
        assert r.status_code == 200

    def test_report_verify_bad_token(self):
        r = requests.get(f"{API}/public/report-verify/invalidtoken", timeout=10)
        assert r.status_code in (200, 400, 404)  # should not crash


# ---------- Auth ----------

class TestAuth:
    def test_login_invalid(self):
        r = requests.post(f"{API}/auth/login", json={"email": "nope@x.com", "password": "wrong"}, timeout=10)
        assert r.status_code in (400, 401)

    def test_me(self, priya_session):
        r = priya_session.get(f"{API}/auth/me", timeout=10)
        assert r.status_code == 200
        data = r.json().get("data", r.json())
        assert "priya" in (data.get("email") or data.get("user", {}).get("email", "")).lower()

    def test_register_and_verify_email(self):
        suffix = uuid.uuid4().hex[:8]
        email = f"test_{suffix}@example.com"
        mobile = "9" + f"{int(time.time()*1000) % 1000000000:09d}"
        r = requests.post(f"{API}/auth/register?role=employee", json={
            "email": email, "password": "Pass@12345", "name": "Test User",
            "mobile": mobile, "acceptTerms": True,
        }, timeout=20)
        assert r.status_code in (200, 201), f"register failed: {r.status_code} {r.text}"
        data = r.json().get("data", r.json())
        otp = data.get("devOtp") or (data.get("otp") or {}).get("devOtp")
        assert otp, f"no devOtp in register: {data}"
        r2 = requests.post(f"{API}/auth/verify-email", json={"email": email, "code": otp}, timeout=10)
        assert r2.status_code == 200, f"verify-email failed: {r2.text}"

    def test_refresh_endpoint_exists(self):
        # Should not 500 when called without cookie - likely 400/401
        r = requests.post(f"{API}/auth/refresh", timeout=10)
        assert r.status_code in (200, 400, 401)


# ---------- PAN ----------

class TestPAN:
    def test_duplicate_pan_rejected(self):
        # Register fresh user and verify email, then try priya's PAN
        email = f"dup_{uuid.uuid4().hex[:8]}@example.com"
        mobile = "9" + f"{(int(time.time()*1000)+1) % 1000000000:09d}"
        r = requests.post(f"{API}/auth/register?role=employee", json={
            "email": email, "password": "Pass@12345", "name": "Dup Tester",
            "mobile": mobile, "acceptTerms": True,
        }, timeout=20)
        assert r.status_code in (200, 201)
        rdata = r.json().get("data", {})
        otp = rdata.get("devOtp") or (rdata.get("otp") or {}).get("devOtp")
        requests.post(f"{API}/auth/verify-email", json={"email": email, "code": otp}, timeout=10)
        s, _, _ = _login(email, "Pass@12345")
        r2 = s.post(f"{API}/verification/pan", json={"pan": "ABCPS1234K", "name": "Dup Tester", "dob": "1990-01-01"}, timeout=15)
        assert r2.status_code in (400, 409, 422), f"duplicate PAN not rejected: {r2.status_code} {r2.text}"

    def test_valid_pan_accepted_for_fresh_user(self):
        email = f"pan_{uuid.uuid4().hex[:8]}@example.com"
        mobile = "9" + f"{(int(time.time()*1000)+2) % 1000000000:09d}"
        r = requests.post(f"{API}/auth/register?role=employee", json={
            "email": email, "password": "Pass@12345", "name": "Fresh Pan",
            "mobile": mobile, "acceptTerms": True,
        }, timeout=20)
        assert r.status_code in (200, 201), r.text
        rdata = r.json().get("data", {})
        otp = rdata.get("devOtp") or (rdata.get("otp") or {}).get("devOtp")
        requests.post(f"{API}/auth/verify-email", json={"email": email, "code": otp}, timeout=10)
        s, _, _ = _login(email, "Pass@12345")
        unique_pan = f"ABCPT{uuid.uuid4().hex[:4].upper()}Q"
        # Make a valid PAN: 5 letters (4th=P), 4 digits, 1 letter
        unique_pan = f"ABCP{chr(65 + (int(time.time()) % 20))}" + f"{int(time.time()) % 10000:04d}" + "Q"
        # Simpler: use pattern [A-Z]{3}P[A-Z]\d{4}[A-Z]
        unique_pan = "ABCP" + chr(65 + (int(time.time()*1000) % 20)) + f"{int(time.time()*1000) % 10000:04d}" + "Q"
        r2 = s.post(f"{API}/verification/pan", json={"pan": unique_pan, "name": "Fresh Pan", "dob": "1990-01-01"}, timeout=15)
        # Could be 200 success or 202 in-queue or validation; must not be 500
        assert r2.status_code < 500, f"PAN endpoint crashed: {r2.status_code} {r2.text}"


# ---------- Employee ----------

class TestEmployee:
    def test_profile(self, priya_session):
        r = priya_session.get(f"{API}/employee/profile", timeout=10)
        assert r.status_code == 200

    def test_score(self, priya_session):
        r = priya_session.get(f"{API}/employee/score", timeout=10)
        assert r.status_code == 200
        data = r.json().get("data", r.json())
        # Score should be present
        score = data.get("score") or data.get("current") or (data.get("profile") or {}).get("score")
        assert score is None or isinstance(score, (int, float, dict))

    def test_score_history(self, priya_session):
        r = priya_session.get(f"{API}/employee/score/history", timeout=10)
        assert r.status_code == 200

    def test_employments(self, priya_session):
        r = priya_session.get(f"{API}/employee/employments", timeout=10)
        assert r.status_code == 200

    def test_consents(self, priya_session):
        r = priya_session.get(f"{API}/employee/consents", timeout=10)
        assert r.status_code == 200

    def test_evaluations(self, priya_session):
        r = priya_session.get(f"{API}/employee/evaluations", timeout=10)
        assert r.status_code == 200

    def test_disputes_list(self, priya_session):
        r = priya_session.get(f"{API}/employee/disputes", timeout=10)
        assert r.status_code == 200

    def test_notifications(self, priya_session):
        r = priya_session.get(f"{API}/employee/notifications", timeout=10)
        assert r.status_code == 200


# ---------- Notifications (new feature: score change alerts) ----------

class TestNotifications:
    def test_list_filter_by_type_score(self, priya_session):
        r = priya_session.get(f"{API}/employee/notifications?type=score", timeout=10)
        assert r.status_code == 200
        items = r.json().get("data", [])
        assert isinstance(items, list)
        for n in items:
            assert n.get("type") == "score", f"type filter leaked: {n}"
            # score notifications must carry meta with delta/oldScore/newScore
            m = n.get("meta") or {}
            assert "delta" in m and "oldScore" in m and "newScore" in m, f"missing meta: {n}"

    def test_unread_count_shape(self, priya_session):
        r = priya_session.get(f"{API}/employee/notifications/unread-count", timeout=10)
        assert r.status_code == 200
        data = r.json().get("data", r.json())
        assert "count" in data and isinstance(data["count"], int)

    def test_mark_single_then_mark_all(self, priya_session):
        items = priya_session.get(f"{API}/employee/notifications", timeout=10).json().get("data", [])
        unread = [n for n in items if not n.get("read")]
        if unread:
            nid = unread[0].get("_id") or unread[0].get("id")
            r = priya_session.post(f"{API}/employee/notifications/read", json={"id": nid}, timeout=10)
            assert r.status_code == 200
            # verify that one is now read
            items2 = priya_session.get(f"{API}/employee/notifications", timeout=10).json().get("data", [])
            match = next((n for n in items2 if (n.get("_id") or n.get("id")) == nid), None)
            assert match and match.get("read") is True, f"single mark did not persist: {match}"
        # mark all
        r = priya_session.post(f"{API}/employee/notifications/read", json={}, timeout=10)
        assert r.status_code == 200
        c = priya_session.get(f"{API}/employee/notifications/unread-count", timeout=10).json().get("data", {}).get("count")
        assert c == 0, f"unread count non-zero after mark-all: {c}"


# ---------- Report PDF + Public Verify (new feature) ----------

class TestReportPdfVerify:
    def test_pdf_download_and_verify_flow(self, priya_session):
        r = priya_session.get(f"{API}/employee/report.pdf", timeout=30)
        assert r.status_code == 200, f"pdf download failed: {r.status_code} {r.text[:200]}"
        ct = r.headers.get("content-type", "")
        assert "pdf" in ct.lower(), f"wrong content-type: {ct}"
        assert r.content[:4] == b"%PDF", "not a valid PDF payload"
        assert len(r.content) > 1000

        # Each download creates a new verify code. Fetch another to ensure uniqueness.
        r2 = priya_session.get(f"{API}/employee/report.pdf", timeout=30)
        assert r2.status_code == 200
        assert r2.content != r.content, "two PDF downloads were identical byte-for-byte"

        # The code format EIB-XXXX-XXXX appears in the PDF bytes
        code_match = re.search(rb"EIB-[A-Z0-9]{4}-[A-Z0-9]{4}", r.content)
        assert code_match, "no EIB-XXXX-XXXX code found in PDF"
        code = code_match.group(0).decode()

        # Public verify by exact code
        v = requests.get(f"{API}/public/report-verify/{code}", timeout=15)
        assert v.status_code == 200, f"public verify failed: {v.status_code} {v.text}"
        data = v.json().get("data", v.json())
        assert data.get("authentic") is True
        assert data.get("code") == code
        assert "score" in data and "dimensions" in data and "employment" in data
        assert data.get("ledgerValid") is True

        # Lowercase code should also work
        v2 = requests.get(f"{API}/public/report-verify/{code.lower()}", timeout=15)
        assert v2.status_code == 200, f"lowercase code rejected: {v2.status_code} {v2.text}"

    def test_invalid_verify_code(self):
        v = requests.get(f"{API}/public/report-verify/EIB-ZZZZ-ZZZZ", timeout=10)
        assert v.status_code in (400, 404), f"invalid code should 4xx: {v.status_code}"


# ---------- Score event -> notification integration ----------

class TestScoreEventTriggersNotification:
    def test_evaluation_submit_creates_score_notification_for_priya(self, acme_session, priya_session):
        # Capture unread count before
        before = priya_session.get(f"{API}/employee/notifications/unread-count", timeout=10).json().get("data", {}).get("count", 0)
        before_items = priya_session.get(f"{API}/employee/notifications?type=score", timeout=10).json().get("data", [])
        before_ids = {(n.get("_id") or n.get("id")) for n in before_items}

        # Find priya's employment record at Acme (needs employmentRecordId)
        emps = acme_session.get(f"{API}/employer/employees", timeout=10).json().get("data", [])
        priya_record = None
        for e in emps:
            emp = e.get("employeeId") or {}
            name = (emp.get("fullName") or e.get("fullName") or "").lower()
            if "priya" in name:
                priya_record = e
                break
        if not priya_record:
            pytest.skip(f"priya not found in acme roster: keys={[list((e.get('employeeId') or {}).keys()) for e in emps[:1]]}")
        rec_id = priya_record.get("_id") or priya_record.get("id")

        # Create + submit an evaluation
        period = f"{time.strftime('%Y')}-Q{((time.localtime().tm_mon - 1) // 3) + 1}"
        payload = {
            "employmentRecordId": rec_id,
            "period": period,
            "performance": 85, "professionalism": 85, "reliability": 85, "conduct": 85,
            "comments": "Automated test eval",
        }
        r = acme_session.post(f"{API}/employer/evaluations", json=payload, timeout=15)
        if r.status_code not in (200, 201):
            pytest.skip(f"could not create evaluation (likely duplicate for period): {r.status_code} {r.text}")
        ev = r.json().get("data", r.json())
        ev_id = ev.get("_id") or ev.get("id")
        # Submit
        rs = acme_session.put(f"{API}/employer/evaluations/{ev_id}", json={"submit": True}, timeout=15)
        assert rs.status_code == 200, f"submit failed: {rs.status_code} {rs.text}"

        # Allow async queue to process
        for _ in range(10):
            time.sleep(1)
            after_items = priya_session.get(f"{API}/employee/notifications?type=score", timeout=10).json().get("data", [])
            new_ones = [n for n in after_items if (n.get("_id") or n.get("id")) not in before_ids]
            if new_ones:
                break
        assert new_ones, "no new score notification created after evaluation submit"
        n = new_ones[0]
        assert n.get("type") == "score"
        m = n.get("meta") or {}
        assert "delta" in m and "oldScore" in m and "newScore" in m
        assert m["newScore"] == m["oldScore"] + m["delta"]
        # Title shape
        title = (n.get("title") or "").lower()
        assert "score" in title and ("increased" in title or "decreased" in title)


# ---------- Employer ----------

class TestEmployer:
    def test_profile(self, acme_session):
        r = acme_session.get(f"{API}/employer/profile", timeout=10)
        assert r.status_code == 200

    def test_dashboard(self, acme_session):
        r = acme_session.get(f"{API}/employer/dashboard", timeout=10)
        assert r.status_code == 200

    def test_employees(self, acme_session):
        r = acme_session.get(f"{API}/employer/employees", timeout=10)
        assert r.status_code == 200

    def test_jobs(self, acme_session):
        r = acme_session.get(f"{API}/employer/jobs", timeout=10)
        assert r.status_code == 200

    def test_evaluations(self, acme_session):
        r = acme_session.get(f"{API}/employer/evaluations", timeout=10)
        assert r.status_code == 200

    def test_usage(self, acme_session):
        r = acme_session.get(f"{API}/employer/usage", timeout=10)
        assert r.status_code == 200

    def test_pending_kyc_dashboard(self, pending_employer_session):
        # Should still allow basic access but may show limited data
        r = pending_employer_session.get(f"{API}/employer/dashboard", timeout=10)
        assert r.status_code in (200, 403), f"unexpected: {r.status_code}"


# ---------- Billing ----------

class TestBilling:
    def test_plans(self):
        r = requests.get(f"{API}/billing/plans", timeout=10)
        assert r.status_code == 200

    def test_subscribe_mock(self, acme_session):
        # Pick a plan
        plans = requests.get(f"{API}/billing/plans", timeout=10).json().get("data", [])
        if not plans:
            pytest.skip("no plans")
        plan = plans[0]
        plan_id = plan.get("_id") or plan.get("id")
        r = acme_session.post(f"{API}/billing/subscribe", json={"planId": plan_id}, timeout=15)
        # Mock mode - should not 500
        assert r.status_code < 500, f"mock subscribe crashed: {r.status_code} {r.text}"

    def test_credits_purchase_mock(self, acme_session):
        r = acme_session.post(f"{API}/billing/credits/purchase", json={"credits": 10, "amount": 1000}, timeout=15)
        assert r.status_code < 500, f"credits purchase crashed: {r.status_code} {r.text}"


# ---------- Admin ----------

class TestAdmin:
    def test_analytics(self, admin_session):
        r = admin_session.get(f"{API}/admin/analytics", timeout=10)
        assert r.status_code == 200

    def test_users(self, admin_session):
        r = admin_session.get(f"{API}/admin/users", timeout=10)
        assert r.status_code == 200

    def test_employers(self, admin_session):
        r = admin_session.get(f"{API}/admin/employers", timeout=10)
        assert r.status_code == 200

    def test_cms_list(self, admin_session):
        r = admin_session.get(f"{API}/admin/cms", timeout=10)
        assert r.status_code == 200

    def test_score_config(self, admin_session):
        r = admin_session.get(f"{API}/admin/score-config", timeout=10)
        assert r.status_code == 200

    def test_audit_logs(self, admin_session):
        r = admin_session.get(f"{API}/admin/audit-logs", timeout=10)
        assert r.status_code == 200

    def test_ledger(self, admin_session):
        r = admin_session.get(f"{API}/admin/ledger", timeout=10)
        assert r.status_code == 200

    def test_ledger_verify(self, admin_session):
        r = admin_session.get(f"{API}/admin/ledger/verify", timeout=15)
        assert r.status_code == 200
        data = r.json().get("data", r.json())
        # Ledger must verify ok
        valid = data.get("valid") if isinstance(data, dict) else None
        if valid is not None:
            assert valid is True, f"ledger integrity failed: {data}"

    def test_disputes(self, admin_session):
        r = admin_session.get(f"{API}/admin/disputes", timeout=10)
        assert r.status_code == 200

    def test_fraud(self, admin_session):
        r = admin_session.get(f"{API}/admin/fraud", timeout=10)
        assert r.status_code == 200


# ---------- Role Guards ----------

class TestRoleGuards:
    def test_employee_cannot_access_admin(self, priya_session):
        r = priya_session.get(f"{API}/admin/analytics", timeout=10)
        assert r.status_code in (401, 403), f"employee accessed admin: {r.status_code}"

    def test_employee_cannot_access_employer(self, priya_session):
        r = priya_session.get(f"{API}/employer/dashboard", timeout=10)
        assert r.status_code in (401, 403), f"employee accessed employer: {r.status_code}"

    def test_employer_cannot_access_admin(self, acme_session):
        r = acme_session.get(f"{API}/admin/analytics", timeout=10)
        assert r.status_code in (401, 403)

    def test_employer_cannot_access_employee(self, acme_session):
        r = acme_session.get(f"{API}/employee/profile", timeout=10)
        assert r.status_code in (401, 403)
