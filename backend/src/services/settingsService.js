const { Setting } = require('../models/misc');

const DEFAULTS = {
  adminTwoFactorRequired: { value: true, group: 'security', description: 'Require email OTP second factor for admin logins' },
  mobileOtpEnabled: { value: true, group: 'verification', description: 'Allow mobile OTP verification' },
  nameMatchThreshold: { value: 0.8, group: 'verification', description: 'Minimum PAN name similarity (0-1) for auto-approval' },
  panMaxAttempts: { value: 5, group: 'verification', description: 'PAN attempts before 1 hour lock' },
  panDailyLimit: { value: 1000, group: 'verification', description: 'Max PAN checks per day (cost control)' },
  consentMode: { value: 'both', group: 'consent', description: 'job_application | on_demand | both (pre-granted at apply + on-demand)' },
  consentValidityDays: { value: 30, group: 'consent', description: 'Days a granted report consent remains valid' },
  consentTextVersion: { value: 'v1.0', group: 'consent', description: 'Current consent text version' },
  currentEmployerSeesOffers: { value: false, group: 'privacy', description: 'Current employer sees accepted offers elsewhere (default no, unless employee allows)' },
  exitAssessmentMandatory: { value: false, group: 'exit', description: 'Require exit assessment for every separation' },
  evaluationCycle: { value: 'quarterly', group: 'evaluation', description: 'quarterly | half_yearly' },
  allowedRaters: { value: ['Owner', 'HR Manager'], group: 'evaluation', description: 'Employer roles allowed to submit evaluations' },
  jobsRequireApproval: { value: false, group: 'jobs', description: 'New job posts need admin approval' },
  creditPerReport: { value: 1, group: 'billing', description: 'Credits consumed per candidate report' },
  gstPercent: { value: 18, group: 'billing', description: 'GST percentage on invoices' },
  maintenanceMode: { value: false, group: 'system', description: 'Block non-admin API traffic' },
  announcement: { value: '', group: 'system', description: 'Announcement banner text' },
  featureFlags: { value: { jobs: true, talentSearch: true, references: true, pdfReports: true }, group: 'system', description: 'Feature flags' },
};

let cache = null;
let cachedAt = 0;

async function all() {
  if (cache && Date.now() - cachedAt < 15000) return cache;
  const rows = await Setting.find().lean();
  const map = Object.fromEntries(Object.entries(DEFAULTS).map(([k, v]) => [k, v.value]));
  rows.forEach((r) => { map[r.key] = r.value; });
  cache = map;
  cachedAt = Date.now();
  return map;
}

const get = async (key) => (await all())[key];

async function set(key, value) {
  const meta = DEFAULTS[key] || {};
  await Setting.findOneAndUpdate({ key }, { value, group: meta.group || 'custom', description: meta.description }, { upsert: true });
  cache = null;
  return value;
}

async function list() {
  const map = await all();
  return Object.entries(map).map(([key, value]) => ({ key, value, group: DEFAULTS[key]?.group || 'custom', description: DEFAULTS[key]?.description || '' }));
}

module.exports = { DEFAULTS, get, set, all, list, clearCache: () => { cache = null; } };
