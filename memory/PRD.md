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

## Backlog
- P1: replace dummy Razorpay keys with real test keys and verify the checkout and webhook flows
- P1: configure real PAN, email, SMS and storage providers; turn off EXPOSE_DEV_OTP for production
- P2: limit or revoke old self-report codes per employee
- P2: deeper E2E checks of scheduled jobs in in-process fallback mode
