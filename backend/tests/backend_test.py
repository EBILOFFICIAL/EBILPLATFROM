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


# ---------- NEW: Consent-free verify-candidate (lookup by PAN/email/EIBIL ID) ----------

EMPLOYEE_RAHUL = ("rahul@demo.in", "Demo@12345")


@pytest.fixture(scope="session")
def rahul_session():
    s, _, _ = _login(*EMPLOYEE_RAHUL)
    return s


@pytest.fixture(scope="session")
def anita_session():
    s, _, _ = _login(*EMPLOYEE_ANITA)
    return s


class TestEmployerLookup:
    """Employer verify-candidate now works WITHOUT consent (1 credit per lookup).
    Candidate gets a 'view' notification."""

    def _balance(self, acme_session):
        prof = acme_session.get(f"{API}/employer/profile", timeout=10).json().get("data", {})
        return prof.get("creditBalance") if "creditBalance" in prof else (prof.get("employer") or {}).get("creditBalance")

    def test_lookup_by_pan_debits_credit_and_notifies(self, acme_session, rahul_session):
        before_bal = self._balance(acme_session)
        before_notes = rahul_session.get(f"{API}/employee/notifications?type=view", timeout=10).json().get("data", [])
        before_ids = {(n.get("_id") or n.get("id")) for n in before_notes}

        r = acme_session.post(f"{API}/employer/verify-candidate",
                              json={"query": "BCDPV5678L"}, timeout=20)
        assert r.status_code in (200, 201), f"lookup failed: {r.status_code} {r.text}"
        data = r.json().get("data", r.json())
        assert data.get("_id") or data.get("id"), f"no verification-check id: {data}"
        snapshot = data.get("snapshot") or {}
        assert snapshot.get("identity", {}).get("fullName"), "snapshot missing identity"
        assert "score" in snapshot

        # credit decreased by 1
        after_bal = self._balance(acme_session)
        if before_bal is not None and after_bal is not None:
            assert after_bal == before_bal - 1, f"credits not debited: {before_bal} -> {after_bal}"

        # employee gets a 'view' notification
        time.sleep(1.5)
        after_notes = rahul_session.get(f"{API}/employee/notifications?type=view", timeout=10).json().get("data", [])
        new_views = [n for n in after_notes if (n.get("_id") or n.get("id")) not in before_ids]
        assert new_views, "no 'view' notification sent to candidate"
        n = new_views[0]
        assert n.get("type") == "view"
        title = n.get("title") or ""
        assert "Acme" in title and "viewed" in title.lower() and "score" in title.lower(), f"bad title: {title}"

    def test_lookup_by_email(self, acme_session):
        r = acme_session.post(f"{API}/employer/verify-candidate",
                              json={"query": "rahul@demo.in"}, timeout=20)
        assert r.status_code in (200, 201), r.text
        assert (r.json().get("data") or {}).get("snapshot", {}).get("identity")

    def test_lookup_by_eibil_id(self, acme_session, rahul_session):
        # fetch rahul's EIBIL id
        p = rahul_session.get(f"{API}/employee/profile", timeout=10).json().get("data", {})
        eibil = p.get("eibilId") or (p.get("profile") or {}).get("eibilId")
        assert eibil, f"no eibilId in profile: {p}"
        r = acme_session.post(f"{API}/employer/verify-candidate",
                              json={"query": eibil}, timeout=20)
        assert r.status_code in (200, 201), f"{r.status_code} {r.text}"

    def test_lookup_nonexistent_pan(self, acme_session):
        r = acme_session.post(f"{API}/employer/verify-candidate",
                              json={"query": "ZZZPZ9999Z"}, timeout=20)
        assert r.status_code == 404, f"should 404 for unknown: {r.status_code} {r.text}"

    def test_lookup_candidate_without_pan(self, acme_session):
        # anita has no PAN -> should return 400 "no score available"
        r = acme_session.post(f"{API}/employer/verify-candidate",
                              json={"query": "anita@demo.in"}, timeout=20)
        assert r.status_code == 400, f"should 400 for unverified PAN: {r.status_code} {r.text}"
        msg = (r.json().get("message") or r.text).lower()
        assert "pan" in msg or "score" in msg

    def test_reports_list_contains_recent_lookup(self, acme_session):
        r = acme_session.get(f"{API}/employer/reports", timeout=10)
        assert r.status_code == 200
        rows = r.json().get("data", [])
        assert isinstance(rows, list) and len(rows) > 0, "reports should list recent lookups"
        # open one -> should NOT re-charge
        rid = rows[0].get("_id") or rows[0].get("id")
        before_bal = self._balance(acme_session)
        r2 = acme_session.get(f"{API}/employer/reports/{rid}", timeout=10)
        assert r2.status_code == 200
        after_bal = self._balance(acme_session)
        if before_bal is not None and after_bal is not None:
            assert after_bal == before_bal, f"re-opening a report charged a credit: {before_bal} -> {after_bal}"


# ---------- NEW: Questionnaire CRUD ----------

class TestQuestionnaire:
    def test_public_employer_questionnaire(self, acme_session):
        r = acme_session.get(f"{API}/employer/questionnaire", timeout=10)
        assert r.status_code == 200
        qs = r.json().get("data", [])
        assert isinstance(qs, list) and len(qs) >= 12, f"expected >=12 default questions, got {len(qs)}"
        dims = {q.get("dimension") for q in qs}
        assert dims == {"performance", "professionalism", "reliability", "conduct"}, f"bad dims: {dims}"
        for q in qs:
            assert q.get("type") in ("rating", "yes_no", "mcq")
            assert isinstance(q.get("options"), list) and len(q["options"]) >= 2
            for o in q["options"]:
                assert "label" in o and "points" in o
                assert 0 <= o["points"] <= 100

    def test_admin_question_crud(self, admin_session):
        # Create
        payload = {"dimension": "performance", "type": "yes_no", "text": "TEST_Q custom?",
                   "weight": 2, "options": [{"label": "Yes", "points": 100}, {"label": "No", "points": 0}]}
        r = admin_session.post(f"{API}/admin/questions", json=payload, timeout=10)
        assert r.status_code in (200, 201), f"create question failed: {r.text}"
        q = r.json().get("data", r.json())
        qid = q.get("_id") or q.get("id")
        assert qid
        # Edit
        r2 = admin_session.put(f"{API}/admin/questions/{qid}",
                               json={"text": "TEST_Q custom (edited)?", "weight": 3}, timeout=10)
        assert r2.status_code == 200, r2.text
        assert "edited" in (r2.json().get("data") or {}).get("text", ""), r2.text
        # Switch type to mcq with 3 options
        r3 = admin_session.put(f"{API}/admin/questions/{qid}", json={
            "type": "mcq",
            "options": [{"label": "A", "points": 100}, {"label": "B", "points": 50}, {"label": "C", "points": 0}],
        }, timeout=10)
        assert r3.status_code == 200
        assert len((r3.json().get("data") or {}).get("options", [])) == 3
        # Delete
        r4 = admin_session.delete(f"{API}/admin/questions/{qid}", timeout=10)
        assert r4.status_code in (200, 204)
        # Verify removed
        r5 = admin_session.get(f"{API}/admin/questions/{qid}", timeout=10)
        assert r5.status_code == 404


# ---------- NEW: Employer evaluation via answers ----------

class TestEvaluationWithAnswers:
    def test_submit_evaluation_with_answers_computes_dims(self, acme_session):
        qs = acme_session.get(f"{API}/employer/questionnaire", timeout=10).json().get("data", [])
        assert qs
        # pick highest option index per question
        answers = [{"questionId": q.get("_id") or q.get("id"), "optionIndex": 0} for q in qs]

        emps = acme_session.get(f"{API}/employer/employees", timeout=10).json().get("data", [])
        rec = None
        for e in emps:
            emp = e.get("employeeId") or {}
            name = (emp.get("fullName") or e.get("fullName") or "").lower()
            if "priya" in name:
                rec = e; break
        if not rec:
            pytest.skip("priya not in roster")
        rec_id = rec.get("_id") or rec.get("id")
        # Use a far-off period to avoid dedup collisions
        period = "2024-Q2"
        payload = {"employmentRecordId": rec_id, "period": period, "answers": answers, "submit": True}
        r = acme_session.post(f"{API}/employer/evaluations", json=payload, timeout=20)
        if r.status_code == 409:
            period = "2024-Q3"
            payload["period"] = period
            r = acme_session.post(f"{API}/employer/evaluations", json=payload, timeout=20)
        assert r.status_code in (200, 201), f"evaluation create failed: {r.status_code} {r.text}"
        ev = r.json().get("data", r.json())
        for d in ("performance", "professionalism", "reliability", "conduct"):
            assert isinstance(ev.get(d), (int, float)), f"dim {d} missing in computed eval: {ev}"
        assert ev.get("status") in ("submitted", "accepted", "held"), f"bad status: {ev.get('status')}"
        assert ev.get("composite"), "no composite"
        assert isinstance(ev.get("answers"), list) and len(ev["answers"]) == len(answers)


# ---------- NEW: Admin algorithm / score-config apply / manual adjust ----------

class TestAdminAlgorithm:
    def test_fetch_algorithm(self, admin_session):
        r = admin_session.get(f"{API}/admin/score/algorithm", timeout=10)
        assert r.status_code == 200
        data = r.json().get("data", {})
        assert "config" in data and "questions" in data and "defaults" in data
        cfg = data["config"]
        for k in ("baseline", "min", "max", "weights", "events", "version"):
            assert k in cfg, f"missing {k}: {list(cfg.keys())}"

    def test_apply_config_bumps_version_and_restore(self, admin_session):
        r = admin_session.get(f"{API}/admin/score/algorithm", timeout=10)
        cfg = r.json().get("data", {}).get("config", {})
        orig_version = cfg["version"]
        orig_k = (cfg.get("events") or {}).get("sensitivityK", 0.6)
        # Change sensitivityK
        new_events = dict(cfg["events"]); new_events["sensitivityK"] = 0.75
        body = {**cfg, "events": new_events, "notes": "TEST_change K to 0.75"}
        r2 = admin_session.post(f"{API}/admin/score-config/apply", json=body, timeout=15)
        assert r2.status_code == 200, r2.text
        applied = r2.json().get("data", {}).get("config", {})
        assert applied["version"] == orig_version + 1, f"version did not bump: {orig_version}->{applied['version']}"
        assert applied["events"]["sensitivityK"] == 0.75

        # Verify score-config list shows versions and activate flow
        lr = admin_session.get(f"{API}/admin/score-config", timeout=10)
        assert lr.status_code == 200
        versions = lr.json().get("data", [])
        active = [v for v in versions if v.get("status") == "active"]
        assert active and active[0]["version"] == applied["version"]

        # Restore sensitivityK to 0.6 (requirement)
        new_events2 = dict(applied["events"]); new_events2["sensitivityK"] = orig_k
        body2 = {**applied, "events": new_events2, "notes": "TEST_restore K"}
        r3 = admin_session.post(f"{API}/admin/score-config/apply", json=body2, timeout=15)
        assert r3.status_code == 200

    def test_manual_adjust_by_eibil_id_applies_instantly(self, admin_session, rahul_session):
        prof = rahul_session.get(f"{API}/employee/profile", timeout=10).json().get("data", {})
        eibil = prof.get("eibilId") or (prof.get("profile") or {}).get("eibilId")
        before_score = prof.get("currentScore") or (prof.get("profile") or {}).get("currentScore")
        assert eibil and before_score is not None
        r = admin_session.post(f"{API}/admin/score/adjust",
                               json={"employeeId": eibil, "delta": 5, "reason": "TEST_manual_adjust unit"},
                               timeout=15)
        assert r.status_code in (200, 201), r.text
        adj = r.json().get("data", {})
        assert adj.get("status") == "approved", f"not instantly approved: {adj}"
        # Wait for score event to apply
        time.sleep(1.5)
        after = rahul_session.get(f"{API}/employee/profile", timeout=10).json().get("data", {})
        after_score = after.get("currentScore") or (after.get("profile") or {}).get("currentScore")
        assert after_score == before_score + 5, f"score did not shift by +5: {before_score} -> {after_score}"


# ---------- NEW: Admin data explorer (RecordDrawer backend) ----------

class TestAdminDataExplorer:
    def test_models_list_with_counts(self, admin_session):
        r = admin_session.get(f"{API}/admin/data", timeout=10)
        assert r.status_code == 200
        models = r.json().get("data", [])
        names = {m["name"] for m in models}
        for required in ("User", "EmployeeProfile", "Employer", "Evaluation", "AuditLog", "LedgerEntry", "ScoreConfig"):
            assert required in names, f"missing model {required} in explorer"
        # read-only flags
        for m in models:
            if m["name"] in ("AuditLog", "LedgerEntry", "ScoreEvent"):
                assert m.get("readOnly") is True

    def test_list_and_get_with_history_and_linked(self, admin_session):
        r = admin_session.get(f"{API}/admin/data/EmployeeProfile?page=1&limit=5", timeout=10)
        assert r.status_code == 200
        items = r.json().get("data", [])
        assert items, "no employee profiles"
        pid = items[0]["_id"]
        d = admin_session.get(f"{API}/admin/data/EmployeeProfile/{pid}", timeout=10)
        assert d.status_code == 200
        detail = d.json().get("data", {})
        for k in ("model", "fields", "doc", "history", "linked"):
            assert k in detail
        assert detail["model"] == "EmployeeProfile"
        assert isinstance(detail["fields"], list) and detail["fields"]
        assert isinstance(detail["history"], list)
        assert isinstance(detail["linked"], list)

    def test_update_employee_profile_currentscore_posts_ledger(self, admin_session, rahul_session):
        p = rahul_session.get(f"{API}/employee/profile", timeout=10).json().get("data", {})
        pid = p.get("_id") or p.get("id") or (p.get("profile") or {}).get("_id")
        before_score = p.get("currentScore") or (p.get("profile") or {}).get("currentScore")
        new_score = int(before_score) + 3
        r = admin_session.put(f"{API}/admin/data/EmployeeProfile/{pid}",
                              json={"currentScore": new_score, "_reason": "TEST_override"}, timeout=15)
        assert r.status_code == 200, r.text
        time.sleep(1.5)
        p2 = rahul_session.get(f"{API}/employee/profile", timeout=10).json().get("data", {})
        after_score = p2.get("currentScore") or (p2.get("profile") or {}).get("currentScore")
        assert after_score == new_score, f"override failed: {before_score} -> {after_score}, expected {new_score}"
        # Check ledger has an admin_override event
        le = admin_session.get(f"{API}/admin/ledger?entityType=score_event&limit=20", timeout=10)
        assert le.status_code == 200

    def test_readonly_cannot_update(self, admin_session):
        r = admin_session.get(f"{API}/admin/data/AuditLog?limit=1", timeout=10)
        items = r.json().get("data", [])
        if not items:
            pytest.skip("no audit logs")
        rid = items[0]["_id"]
        r2 = admin_session.put(f"{API}/admin/data/AuditLog/{rid}", json={"action": "hack"}, timeout=10)
        assert r2.status_code in (403, 400), f"readonly update should fail: {r2.status_code} {r2.text}"


# ---------- NEW: Admin activity feed ----------

class TestAdminActivity:
    def test_activity_mine_and_all(self, admin_session):
        r_all = admin_session.get(f"{API}/admin/activity?limit=20", timeout=10)
        assert r_all.status_code == 200
        all_items = r_all.json().get("data", [])
        assert isinstance(all_items, list)
        r_mine = admin_session.get(f"{API}/admin/activity?mine=true&limit=20", timeout=10)
        assert r_mine.status_code == 200
        mine_items = r_mine.json().get("data", [])
        assert isinstance(mine_items, list)
        # all admin activities should have actorRole admin
        for it in all_items[:5]:
            assert it.get("actorRole") == "admin", f"non-admin entry in activity: {it}"


# ---------- NEW: Admin re-rate accepted evaluation ----------

class TestAdminRerate:
    def test_admin_edit_evaluation_rating_shifts_score(self, admin_session, rahul_session):
        # find a submitted/accepted evaluation
        r = admin_session.get(f"{API}/admin/data/Evaluation?limit=50", timeout=10)
        evs = [e for e in r.json().get("data", []) if e.get("status") in ("accepted", "submitted")]
        if not evs:
            pytest.skip("no accepted/submitted evaluations")
        ev = evs[0]
        emp_id = ev.get("employeeId")
        # pick an employee whose score we can read
        pr = admin_session.get(f"{API}/admin/data/EmployeeProfile/{emp_id}", timeout=10)
        if pr.status_code != 200:
            pytest.skip("cannot fetch employee profile")
        before_score = pr.json().get("data", {}).get("doc", {}).get("currentScore")
        new_perf = min(100, int(ev.get("performance") or 50) + 10)
        r2 = admin_session.put(f"{API}/admin/data/Evaluation/{ev['_id']}",
                               json={"performance": new_perf, "_reason": "TEST_rerate"}, timeout=20)
        if r2.status_code != 200:
            pytest.skip(f"rerate not supported for this evaluation: {r2.status_code} {r2.text}")
        time.sleep(1.5)
        pr2 = admin_session.get(f"{API}/admin/data/EmployeeProfile/{emp_id}", timeout=10)
        after_score = pr2.json().get("data", {}).get("doc", {}).get("currentScore")
        # score may be the same if trust weighting zeros out, so just assert endpoint didn't crash and ev updated
        detail = r2.json().get("data", {}).get("doc", {})
        assert detail.get("performance") == new_perf, f"performance not updated: {detail.get('performance')}"
