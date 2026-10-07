const ROLES = { EMPLOYEE: 'employee', EMPLOYER: 'employer', ADMIN: 'admin' };
const USER_STATUS = ['active', 'suspended', 'banned'];
const EMPLOYER_USER_ROLES = ['Owner', 'HR Manager', 'Recruiter', 'Viewer'];
const KYC_STATUS = ['pending', 'approved', 'rejected', 'suspended'];
const TRUST_TIERS = { standard: 1, verified: 1.1, enterprise: 1.25, flagged: 0.5 };
const EMPLOYMENT_STATUS = ['declared', 'verified', 'rejected', 'disputed'];
const EVALUATION_STATUS = ['draft', 'submitted', 'held', 'accepted', 'disputed', 'removed'];
const OFFER_STATUS = ['issued', 'accepted', 'joined', 'declined', 'expired', 'no_show', 'withdrawn', 'unverified'];
const SEPARATION_TYPES = ['resignation', 'termination_performance', 'termination_misconduct', 'absconded', 'end_of_contract', 'layoff', 'retirement', 'mutual_separation'];
const SEPARATION_STATUS = ['awaiting_confirmation', 'date_conflict', 'notice_running', 'assessment_pending', 'review_window', 'admin_review', 'published', 'not_submitted'];
const REASON_CATEGORIES = ['better_opportunity', 'relocation', 'higher_studies', 'personal', 'performance', 'misconduct', 'restructuring', 'contract_completed', 'health', 'other'];
const PIPELINE = ['applied', 'shortlisted', 'interview', 'offer', 'hired', 'rejected'];
const DISPUTE_STATUS = ['open', 'under_review', 'resolved_employee', 'resolved_employer', 'modified', 'rejected'];
const FRAUD_TYPES = ['duplicate_pan', 'duplicate_email', 'duplicate_mobile', 'near_duplicate', 'tenure_discrepancy', 'overlapping_employment', 'rating_outlier', 'offer_overlap', 'repeated_withdrawals', 'document_forensics', 'watchlist_hit'];
const FREE_EMAIL_DOMAINS = ['gmail.com', 'yahoo.com', 'yahoo.in', 'hotmail.com', 'outlook.com', 'live.com', 'rediffmail.com', 'icloud.com', 'aol.com', 'protonmail.com', 'zoho.com', 'gmx.com', 'mail.com'];
const DEFAULT_BANDS = [
  { name: 'Prime Executive', min: 900, max: 950 },
  { name: 'Excellent', min: 850, max: 899 },
  { name: 'Good', min: 750, max: 849 },
  { name: 'Fair', min: 600, max: 749 },
  { name: 'Poor', min: 300, max: 599 },
];
const PERMISSIONS = [
  'dashboard.view', 'users.view', 'users.manage', 'employers.view', 'employers.manage', 'verification.manage',
  'fraud.manage', 'score.view', 'score.configure', 'score.approve', 'score.adjust', 'disputes.manage',
  'evaluations.manage', 'offers.manage', 'separations.manage', 'references.manage', 'jobs.manage',
  'billing.view', 'billing.manage', 'cms.manage', 'roles.manage', 'audit.view', 'ledger.verify',
  'settings.manage', 'tickets.manage', 'broadcasts.manage', 'jobs.run',
];
const ADMIN_ROLE_PRESETS = {
  'Super Admin': ['*'],
  'Verification Officer': ['dashboard.view', 'users.view', 'verification.manage', 'fraud.manage', 'employers.view', 'score.view', 'score.approve'],
  Support: ['dashboard.view', 'users.view', 'employers.view', 'tickets.manage', 'disputes.manage'],
  Finance: ['dashboard.view', 'billing.view', 'billing.manage', 'employers.view'],
  'Content Manager': ['dashboard.view', 'cms.manage', 'broadcasts.manage'],
  Auditor: ['dashboard.view', 'audit.view', 'ledger.verify', 'score.view', 'users.view', 'score.approve'],
};

module.exports = {
  ROLES, USER_STATUS, EMPLOYER_USER_ROLES, KYC_STATUS, TRUST_TIERS, EMPLOYMENT_STATUS, EVALUATION_STATUS,
  OFFER_STATUS, SEPARATION_TYPES, SEPARATION_STATUS, REASON_CATEGORIES, PIPELINE, DISPUTE_STATUS, FRAUD_TYPES,
  FREE_EMAIL_DOMAINS, DEFAULT_BANDS, PERMISSIONS, ADMIN_ROLE_PRESETS,
};
