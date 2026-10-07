# EIBIL Platform — PRD

## Original problem
Build EIBIL (Employment Integrity & Background Intelligence League) per the 482-line developer spec: Node/Express + MongoDB/Mongoose + Redis/BullMQ (in-process fallback), Vite React + Tailwind, light premium fintech UI, JWT + refresh tokens, mandatory email OTP, PAN encryption + HMAC de-duplication (shown masked only), append-only hash-chained ledger, score engine, employee/employer/admin portals, CMS, billing (Razorpay), Phase 1 + Phase 2 features. Follow the modular structure in spec Section 13.

## Architecture
- Python gateway (/app/backend/server.py, port 8001) proxies /api to Node Express (port 8002, /app/backend/src)
- Frontend: Vite React (/app/frontend/src); roles employee / employer / admin
- Providers MOCKED: PAN, KYC, email, SMS, storage (local), Razorpay (mock mode, dummy keys). Dev OTP shown on screen (EXPOSE_DEV_OTP=true)

## Implemented
- 2026-06: full backend (models, services, routes, jobs, seeds), frontend portals, unit tests (9 pass), README, .env.example files
- 2026-06: E2E testing agent run iteration_1 — backend 46/46 pass, frontend pages load cleanly; rate limiter now keys on the real client IP (cf-connecting-ip)

- 2026-06: Score Change Alerts: in-app bell with unread badge and dropdown, a dashboard alerts panel, and a MOCKED email when the score moves by at least the threshold (default 3). Notification type 'score' with meta
- 2026-06: Downloadable branded PDF score report: score, as-of date, 4 dimensions, verified employment, QR code and a unique EIB-XXXX-XXXX code; public /verify page accepts the code (any case, spaces or dashes). Tests: iteration_2 (51 pass)
- Note: the Node backend does NOT hot reload; run `sudo supervisorctl restart backend` after backend edits

- 2026-06: Consent removed. Employers search by PAN, email or EIBIL ID and view the score instantly (1 credit), with a 'Reports viewed' history. The candidate is notified '<Company> viewed your EIBIL score' (in-app + MOCKED email); the employee 'Privacy & views' page lists the viewers
- 2026-06: Evaluation questionnaire. The admin master bank (Question model) holds rating 1-5, yes/no and MCQ questions; each answer maps to 0-100 points, and each question has a dimension and a weight. Dimension = weighted average of points. The employer evaluation form uses the questionnaire; 12 default questions are created automatically
- 2026-06: Admin full control. Score algorithm console (/admin/algorithm) with 6 formula steps, all values editable and a simulator; changes go live instantly, versioned, with audit log and ledger entries (no second-admin approval). Instant manual adjustments; 'Make live' on any version. Clicking any admin row opens a record drawer (all fields, edit/save/delete, linked records, history). Data explorer (/admin/data) covers every collection. Admin activity feed (/admin/activity + dashboard). Every admin write is audited (trackAdmin middleware). Admin re-rating an evaluation or overriding a score posts a ledger score event of the difference. Tests: iteration_3 (70/70)

- 2026-06: Candidate contact details (email, phone, city) shown in employer score reports and in the employer job pipeline. Resumes: optional PDF/DOC/DOCX up to 5 MB on job apply, stored in MongoDB (Resume collection), saved to the candidate profile and reused; manage (replace/download/delete) from employee Settings 'My resume' panel. Employers download resumes for their applicants or candidates whose report they viewed (403 otherwise). Replaced resumes are kept while old applications reference them. Tests: iteration_5 (78/78)

- 2026-06: Employer applicant CSV export (contact details, score, status, resume name; audit-logged) and in-browser resume preview (inline PDF, falls back to download for DOC/DOCX) in the pipeline and the candidate report. Tests: iteration_6 (6/6 new)

## Backlog
- P1: replace dummy Razorpay keys with real test keys and verify the checkout and webhook flows
- P1: configure real PAN, email, SMS and storage providers; turn off EXPOSE_DEV_OTP for production
- P2: limit or revoke old self-report codes per employee
- P2: deeper E2E checks of scheduled jobs in in-process fallback mode
