const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const { connectDB } = require('../config/db');
const logger = require('../config/logger');
const User = require('../models/User');
const Role = require('../models/Role');
const Plan = require('../models/Plan');
const ScoreConfig = require('../models/ScoreConfig');
const CMSPage = require('../models/CMSPage');
const Employer = require('../models/Employer');
const EmployerUser = require('../models/EmployerUser');
const EmployeeProfile = require('../models/EmployeeProfile');
const EmploymentRecord = require('../models/EmploymentRecord');
const Evaluation = require('../models/Evaluation');
const Job = require('../models/Job');
const { Coupon, Setting } = require('../models/misc');
const { ADMIN_ROLE_PRESETS } = require('../constants');
const { DEFAULT_CONFIG } = require('../services/scoreService');
const { encrypt } = require('../utils/crypto');
const { hashPan, maskPan } = require('../utils/panUtils');
const { eibilId } = require('../utils/generateToken');
const scoreEvents = require('../services/scoreEventService');
const employment = require('../services/employmentService');
const evaluation = require('../services/evaluationService');
const cmsContent = require('./cmsContent');

const DEMO_PASSWORD = 'Demo@12345';
const hash = (p) => bcrypt.hash(p, 10);

async function seedCore() {
  const roles = {};
  for (const [name, permissions] of Object.entries(ADMIN_ROLE_PRESETS)) {
    roles[name] = await Role.findOneAndUpdate({ name }, { name, permissions, system: true }, { upsert: true, new: true });
  }
  const adminEmail = process.env.SEED_ADMIN_EMAIL;
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;
  await User.findOneAndUpdate({ email: adminEmail }, { role: 'admin', name: 'Super Admin', email: adminEmail, emailVerified: true, adminRoleId: roles['Super Admin']._id, passwordHash: await hash(adminPassword), status: 'active' }, { upsert: true });
  await User.findOneAndUpdate({ email: 'checker@eibil.in' }, { role: 'admin', name: 'Verification Officer', email: 'checker@eibil.in', emailVerified: true, adminRoleId: roles['Verification Officer']._id, passwordHash: await hash(adminPassword), status: 'active' }, { upsert: true });

  const plans = [
    { code: 'starter', name: 'Starter', priceInr: 0, credits: 5, seats: 1, jobPosts: 1, sortOrder: 1, features: ['5 verification credits', '1 active job post', '1 seat', 'Email support'] },
    { code: 'growth', name: 'Growth', priceInr: 4999, credits: 100, seats: 5, jobPosts: 10, sortOrder: 2, highlighted: true, features: ['100 credits / month', '10 active job posts', '5 seats', 'Talent search', 'Reference checks'] },
    { code: 'enterprise', name: 'Enterprise', priceInr: 19999, credits: 600, seats: 25, jobPosts: 50, apiCalls: 10000, sortOrder: 3, features: ['600 credits / month', '50 job posts', '25 seats', 'Bulk verification', 'API access (Phase 3)', 'Dedicated manager'] },
    { code: 'credits-50', name: '50 Credit Pack', type: 'credit_pack', billingCycle: 'one_time', priceInr: 1999, credits: 50, jobPosts: 0, sortOrder: 4, features: ['50 verification credits', 'Never expire'] },
  ];
  for (const p of plans) await Plan.findOneAndUpdate({ code: p.code }, p, { upsert: true });
  await Coupon.findOneAndUpdate({ code: 'WELCOME20' }, { code: 'WELCOME20', percentOff: 20, maxUses: 500, active: true }, { upsert: true });

  if (!(await ScoreConfig.exists({}))) await ScoreConfig.create({ ...DEFAULT_CONFIG, version: 1, status: 'active', notes: 'Default v1 configuration from specification', activatedAt: new Date() });
  for (const [slug, page] of Object.entries(cmsContent)) {
    if (!(await CMSPage.exists({ slug }))) await CMSPage.create({ slug, title: page.title, type: page.type || 'page', content: page.content, seo: { title: `${page.title} | EIBIL`, description: page.content.subtitle || page.content.body?.slice(0, 150) } });
  }
}

async function makeEmployer({ companyName, domain, gstin, cin, city, industry, kycStatus, trustTier, plan, credits, owner }) {
  const existing = await Employer.findOne({ domain });
  if (existing) return existing;
  const planDoc = await Plan.findOne({ code: plan });
  const employer = await Employer.create({ companyName, domain, gstin, cin, city, industry, kycStatus, trustTier, planId: planDoc?._id, creditBalance: credits, hrContactName: owner.name, phone: owner.mobile, kycNotes: 'Seeded demo employer' });
  const user = await User.create({ role: 'employer', name: owner.name, email: owner.email, mobile: owner.mobile, emailVerified: true, passwordHash: await hash(DEMO_PASSWORD) });
  await EmployerUser.create({ employerId: employer._id, userId: user._id, role: 'Owner' });
  return employer;
}

async function makeEmployee({ name, email, mobile, pan, dob, headline, location, skills, experienceYears, openToWork }) {
  if (await User.exists({ email })) return EmployeeProfile.findOne({ userId: (await User.findOne({ email }))._id });
  const user = await User.create({ role: 'employee', name, email, mobile, emailVerified: true, mobileVerified: true, passwordHash: await hash(DEMO_PASSWORD) });
  const profile = await EmployeeProfile.create({
    userId: user._id, eibilId: eibilId(), fullName: name, dob, headline, location, skills, experienceYears, openToWork,
    ...(pan ? { panEncrypted: encrypt(pan), panHash: hashPan(pan), panMasked: maskPan(pan), panVerified: true, panStatus: 'verified', panVerifiedAt: new Date(), panProviderRef: 'SEED', panNameScore: 1 } : {}),
  });
  if (pan) await scoreEvents.initBaseline(profile._id);
  return profile;
}

async function seedDemo() {
  const acme = await makeEmployer({ companyName: 'Acme Technologies Pvt Ltd', domain: 'acmetech.in', gstin: '29AABCA1234A1Z5', cin: 'U72200KA2015PTC012345', city: 'Bengaluru', industry: 'IT Services', kycStatus: 'approved', trustTier: 'enterprise', plan: 'growth', credits: 25, owner: { name: 'Meera Nair', email: 'hr@acmetech.in', mobile: '+919800000001' } });
  const nimbus = await makeEmployer({ companyName: 'Nimbus Fintech Pvt Ltd', domain: 'nimbusfin.in', gstin: '27AABCN5678B1Z2', cin: 'U65999MH2018PTC067890', city: 'Mumbai', industry: 'Fintech', kycStatus: 'approved', trustTier: 'verified', plan: 'starter', credits: 5, owner: { name: 'Arjun Shah', email: 'hr@nimbusfin.in', mobile: '+919800000002' } });
  await makeEmployer({ companyName: 'Sahyadri Infra Projects', domain: 'sahyadriinfra.in', gstin: '27AABCS9012C1Z9', city: 'Pune', industry: 'Infrastructure', kycStatus: 'pending', trustTier: 'standard', plan: 'starter', credits: 0, owner: { name: 'Kavita Rao', email: 'hr@sahyadriinfra.in', mobile: '+919800000003' } });

  const priya = await makeEmployee({ name: 'Priya Sharma', email: 'priya@demo.in', mobile: '+919900000001', pan: 'ABCPS1234K', dob: new Date('1994-05-12'), headline: 'Senior Software Engineer', location: 'Bengaluru', skills: ['React', 'Node.js', 'MongoDB'], experienceYears: 7, openToWork: true });
  const rahul = await makeEmployee({ name: 'Rahul Verma', email: 'rahul@demo.in', mobile: '+919900000002', pan: 'BCDPV5678L', dob: new Date('1991-11-03'), headline: 'Risk Analyst', location: 'Mumbai', skills: ['Risk', 'SQL', 'Python'], experienceYears: 9, openToWork: true });
  await makeEmployee({ name: 'Anita Desai', email: 'anita@demo.in', mobile: '+919900000003', headline: 'Marketing Associate', location: 'Pune', skills: ['SEO', 'Content'], experienceYears: 2 });

  const acmeOwner = await User.findOne({ email: 'hr@acmetech.in' });
  const nimbusOwner = await User.findOne({ email: 'hr@nimbusfin.in' });
  if (!(await EmploymentRecord.exists({ employeeId: priya._id }))) {
    const r1 = await EmploymentRecord.create({ employeeId: priya._id, employerId: acme._id, companyName: acme.companyName, designation: 'Senior Software Engineer', department: 'Engineering', startDate: new Date('2022-01-10'), isCurrent: true, source: 'employer' });
    await employment.seal(r1, acmeOwner);
    for (const [period, s] of [['2025-Q3', [86, 80, 84, 88]], ['2025-Q4', [90, 85, 88, 90]]]) {
      const ev = await Evaluation.create({ employmentRecordId: r1._id, employerId: acme._id, employeeId: priya._id, raterUserId: acmeOwner._id, period, performance: s[0], professionalism: s[1], reliability: s[2], conduct: s[3], comments: 'Consistently strong delivery.', composite: 0, status: 'submitted', submittedAt: new Date() });
      await evaluation.processSubmitted({ evaluationId: ev._id });
    }
  }
  if (!(await EmploymentRecord.exists({ employeeId: rahul._id }))) {
    const r2 = await EmploymentRecord.create({ employeeId: rahul._id, employerId: nimbus._id, companyName: nimbus.companyName, designation: 'Risk Analyst', department: 'Risk', startDate: new Date('2023-06-01'), isCurrent: true, source: 'employer' });
    await employment.seal(r2, nimbusOwner);
    const ev = await Evaluation.create({ employmentRecordId: r2._id, employerId: nimbus._id, employeeId: rahul._id, raterUserId: nimbusOwner._id, period: '2025-Q4', performance: 68, professionalism: 72, reliability: 70, conduct: 75, comments: 'Meets expectations; improve turnaround time.', composite: 0, status: 'submitted', submittedAt: new Date() });
    await evaluation.processSubmitted({ evaluationId: ev._id });
  }
  if (!(await Job.exists({}))) {
    await Job.create([
      { employerId: acme._id, postedBy: acmeOwner._id, title: 'Staff Frontend Engineer', description: 'Lead our React platform team building verification dashboards used by thousands of HR teams.', location: 'Bengaluru', type: 'full_time', role: 'Engineering', skills: ['React', 'TypeScript'], salaryMin: 3500000, salaryMax: 5000000, experienceMin: 6, minEibilScore: 850, screeningQuestions: ['Notice period (days)?'], status: 'active', featured: true },
      { employerId: acme._id, postedBy: acmeOwner._id, title: 'QA Automation Engineer', description: 'Own end-to-end automation for our hiring and verification products.', location: 'Remote', type: 'remote', role: 'Engineering', skills: ['Playwright', 'Node.js'], salaryMin: 1400000, salaryMax: 2200000, experienceMin: 3, minEibilScore: 750, status: 'active' },
      { employerId: nimbus._id, postedBy: nimbusOwner._id, title: 'Credit Risk Manager', description: 'Build credit models and lead a team of analysts in our lending business.', location: 'Mumbai', type: 'full_time', role: 'Risk', skills: ['Risk', 'Python'], salaryMin: 2500000, salaryMax: 3500000, experienceMin: 7, minEibilScore: 900, status: 'active' },
    ]);
  }
}

async function main() {
  require('../jobs').registerHandlers();
  await connectDB();
  if (process.argv.includes('--reset')) {
    await mongoose.connection.db.dropDatabase();
    logger.info('Database dropped');
  }
  await seedCore();
  await seedDemo();
  await Setting.findOneAndUpdate({ key: 'seededAt' }, { value: new Date(), group: 'system' }, { upsert: true });
  logger.info('Seed complete');
  await mongoose.disconnect();
}

main().catch((e) => { logger.error(e.stack); process.exit(1); });
