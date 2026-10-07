# EIBIL Platform — Employment Integrity & Background Intelligence League

India's employment score bureau ("CIBIL for careers"). Score range 300–950, baseline 890.

## Stack
- **Backend**: Node.js + Express, MongoDB (Mongoose), Redis + BullMQ (automatic in-process fallback), JWT access (15m) + rotating refresh token (httpOnly cookie), Razorpay.
- **Frontend**: React 19 (Vite) + Tailwind CSS, React Router, Recharts, light mode only.

## Folder structure
```
backend/
  server.py                # preview-only launcher: starts Redis + Node and forwards /api -> :8002
  src/config/              env, db, redis, queue (BullMQ/inline), cloudinary, razorpay, logger
  src/constants/           roles, statuses, bands, permissions
  src/models/              User, EmployeeProfile, Employer, EmployerUser, EmploymentRecord, Evaluation, ScoreEvent,
                           LedgerEntry, Dispute, Consent, Job, Application, Plan, Subscription, Payment, FraudFlag,
                           AuditLog, ScoreConfig, CMSPage, Role, Ticket, OtpToken, Offer, SeparationCase,
                           ExitAssessment, ExitRebuttal, ReferenceRequest, EmployerTrustMetric, ScoreJobRun, misc
  src/controllers/         auth, verification, employee, employer, job, billing, public, offer, separation, reference
  src/controllers/admin/   userAdmin, employerAdmin, scoreAdmin, disputeAdmin, cmsAdmin, roleAdmin, auditAdmin,
                           analyticsAdmin, verificationAdmin, oversightAdmin, systemAdmin
  src/routes/              index + one file per domain, admin/index.js
  src/services/            business logic (auth, otp, email, sms, pan, duplicate, score, scoreEvent, scoreConfig,
                           evaluation, ledger, consent, report, job, billing, fraud, audit, upload, notification,
                           offer, separation, exitAssessment, reference, employerTrust, dispute, ...)
  src/services/providers/  PAN / KYC / email / SMS / storage adapters (mock + real)
  src/middleware/          auth, role, permission (DB-driven RBAC), validate (Joi), rateLimiter, upload, audit, error
  src/validators/          Joi schemas per domain
  src/jobs/                scoreRecalc, ledgerIntegrity, penaltyDecay, tenureScore, identityRecheck, exitReminder,
                           offerExpiry, evaluationReminder (+ jobRunner, index scheduler)
  src/templates/email/     otp, welcome, consentRequest, evaluationDue, generic
  src/seeds/               seed.js, cmsContent.js
  tests/                   scoreEngine, panDedup, ledger (node:test)
frontend/
  src/services/            api.js (axios + refresh interceptor) and per-domain services (only place with API calls)
  src/components/          common/, layout/, admin/, jobs/, charts/
  src/layouts/             Public, Auth, Employee, Employer, Admin
  src/pages/               public/, auth/, employee/(offers, exit), employer/(offers, separations, references), admin/(offers, separations)
  src/routes/              AppRoutes, ProtectedRoute, RoleRoute
  src/context, hooks, utils, constants
```

## Setup
```bash
# backend
cd backend && cp .env.example .env   # fill secrets (openssl rand -hex 32)
yarn install
node src/seeds/seed.js --reset       # super admin, roles, plans, score config v1, CMS, demo data
node src/server.js                   # API on NODE_PORT (default 8002), base path /api/v1
yarn test                            # score engine, PAN de-dup, ledger integrity
# frontend
cd frontend && cp .env.example .env  # REACT_APP_BACKEND_URL=<api host>
yarn install && yarn start           # Vite on :3000
```
Redis: set `REDIS_URL` to enable BullMQ. If Redis is unreachable, queues and schedules run in-process automatically.

## Provider adapters (env)
| Concern | Env | Values |
|---|---|---|
| PAN | `PAN_PROVIDER`, `PAN_PROVIDER_KEY`, `PAN_PROVIDER_URL` | `mock` (default), `surepass` |
| Company KYC | `KYC_PROVIDER` | `mock` (format check of GSTIN/CIN) |
| Email | `EMAIL_PROVIDER` + SMTP/SendGrid/Resend keys | `mock`, `smtp`, `ses` (SMTP), `sendgrid`, `resend` |
| SMS | `SMS_PROVIDER` + Twilio/MSG91 keys | `mock`, `twilio`, `msg91` |
| Files | `STORAGE_PROVIDER` + `CLOUDINARY_*` | `local`, `cloudinary` (signed, expiring URLs) |
| Payments | `RAZORPAY_MODE`, `RAZORPAY_KEY_ID/SECRET`, `RAZORPAY_WEBHOOK_SECRET` | `mock`, `live` |
| Dev | `EXPOSE_DEV_OTP=true` | returns OTPs in responses (disable in production) |

Mock PAN: PAN starting `XXXXX` is invalid; 5th character `Z` returns a mismatched name (goes to the admin queue).

## Key guarantees
- PAN stored as AES-256-GCM ciphertext + unique HMAC-SHA256 hash; only `ABCDE****F` is ever returned.
- Ledger: append-only, SHA-256 chained (`entryHash = H(seq|type|id|action|payloadHash|prevHash|ts)`); update/delete blocked in the model; admin verifier + nightly job.
- Every score change = ScoreEvent + ledger entry; `recalculate` replays the ledger deterministically.
- Salary/CTC never appear in employer reports; every report view is audit-logged and visible to the employee.
- Section 16 decisions use the recommended defaults and can be changed in Admin → System settings and in the Score Engine.
