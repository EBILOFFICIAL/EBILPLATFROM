const EmployeeProfile = require('../models/EmployeeProfile');
const EmploymentRecord = require('../models/EmploymentRecord');
const Evaluation = require('../models/Evaluation');
const Offer = require('../models/Offer');
const SeparationCase = require('../models/SeparationCase');
const ExitAssessment = require('../models/ExitAssessment');
const ExitRebuttal = require('../models/ExitRebuttal');
const FraudFlag = require('../models/FraudFlag');
const Employer = require('../models/Employer');
const User = require('../models/User');
const { VerificationCheck, CreditTransaction } = require('../models/misc');
const AppError = require('../utils/AppError');
const { randomToken } = require('../utils/crypto');
const env = require('../config/env');
const score = require('./scoreService');
const consent = require('./consentService');
const settings = require('./settingsService');
const audit = require('./auditService');
const ledger = require('./ledgerService');

const avg = (rows, k) => (rows.length ? Math.round(rows.reduce((a, r) => a + r[k], 0) / rows.length) : null);

async function exitsFor(profileId) {
  const cases = await SeparationCase.find({ employeeId: profileId, status: { $in: ['published', 'not_submitted'] } }).populate('employerId', 'companyName').lean();
  return Promise.all(cases.map(async (c) => {
    const a = c.status === 'published' ? await ExitAssessment.findOne({ separationCaseId: c._id }).lean() : null;
    const rebuttals = await ExitRebuttal.find({ separationCaseId: c._id }).lean();
    return {
      company: c.employerId?.companyName, separationType: c.separationType, reasonCategory: c.reasonCategory, lastWorkingDay: c.lastWorkingDay,
      status: c.status === 'not_submitted' ? 'Exit assessment not submitted' : 'Published',
      notice: a ? { required: a.noticeRequiredDays, served: a.noticeServedDays, shortfall: a.noticeShortfall, buyout: a.buyoutStatus } : null,
      rehireEligibility: a?.rehireEligibility, handover: a?.handoverStatus, comment: a?.comment,
      rebuttals: rebuttals.map((r) => ({ statement: r.statement, at: r.createdAt })),
    };
  }));
}

async function build(profileId, viewer = {}) {
  const profile = await EmployeeProfile.findById(profileId).lean();
  if (!profile) throw AppError.notFound('Profile not found');
  const user = profile.userId ? await User.findById(profile.userId).lean() : null;
  const cfg = await score.getActiveConfig();
  const employerId = viewer.employerId ? String(viewer.employerId) : null;
  const records = await EmploymentRecord.find({ employeeId: profileId, status: { $in: ['verified', 'disputed'] } }).populate('employerId', 'companyName').sort({ startDate: -1 }).lean();
  const currentEmployerIds = records.filter((r) => r.isCurrent && r.employerId).map((r) => String(r.employerId._id));
  const isCurrentEmployer = employerId && currentEmployerIds.includes(employerId);
  const evals = await Evaluation.find({ employeeId: profileId, status: 'accepted' }).populate('employerId', 'companyName').lean();
  const ownEvals = employerId ? evals.filter((e) => String(e.employerId._id) === employerId) : evals;

  const offers = await Offer.find({ employeeId: profileId, status: { $in: ['accepted', 'joined', 'no_show'] } }).populate('employerId', 'companyName').lean();
  const hiddenFor = (profile.visibility?.hideOfferStatusFromEmployerIds || []).map(String);
  const currentMaySee = profile.visibility?.allowCurrentEmployerOfferView || (await settings.get('currentEmployerSeesOffers'));
  const showOffers = !employerId || (!hiddenFor.includes(employerId) && (!isCurrentEmployer || currentMaySee));

  return {
    asOf: profile.scoreUpdatedAt || new Date(),
    generatedAt: new Date(),
    identity: { eibilId: profile.eibilId, fullName: profile.fullName, panMasked: profile.panMasked, panVerified: profile.panVerified, emailVerified: Boolean(user?.emailVerified), mobileVerified: Boolean(user?.mobileVerified), photo: profile.photo },
    score: { value: profile.currentScore, band: profile.band || score.bandFor(profile.currentScore, cfg.bands), range: [cfg.min, cfg.max], frozen: profile.scoreFrozen },
    employment: records.map((r) => ({ company: r.employerId?.companyName || r.companyName, designation: r.designation, department: r.department, startDate: r.startDate, endDate: r.endDate, isCurrent: r.isCurrent, status: r.status, signatureHash: r.signatureHash })),
    evaluationSummary: { count: evals.length, performance: avg(evals, 'performance'), professionalism: avg(evals, 'professionalism'), reliability: avg(evals, 'reliability'), conduct: avg(evals, 'conduct') },
    evaluations: (employerId ? ownEvals : evals).map((e) => ({ id: e._id, company: e.employerId?.companyName, period: e.period, performance: e.performance, professionalism: e.professionalism, reliability: e.reliability, conduct: e.conduct, composite: e.composite, comments: e.comments })),
    offers: showOffers ? offers.map((o) => ({ company: o.employerId?.companyName || o.companyName, designation: o.designation, status: o.status, expectedJoiningDate: o.expectedJoiningDate, verified: o.verified })) : 'hidden',
    exits: await exitsFor(profileId),
    fraudFlags: await FraudFlag.countDocuments({ employeeId: profileId, status: { $in: ['open', 'investigating'] }, severity: { $in: ['high', 'critical'] } }),
  };
}

async function generateForEmployer(employer, user, employeeId, req) {
  const grant = await consent.activeConsent(employer._id, employeeId);
  if (!grant) throw AppError.forbidden('Candidate consent is required before viewing this report');
  const cost = await settings.get('creditPerReport');
  const fresh = await Employer.findOneAndUpdate({ _id: employer._id, creditBalance: { $gte: cost } }, { $inc: { creditBalance: -cost } }, { new: true });
  if (!fresh) throw new AppError('Insufficient verification credits. Please purchase credits', 402);
  await CreditTransaction.create({ employerId: employer._id, amount: -cost, balanceAfter: fresh.creditBalance, reason: 'Candidate report', refId: String(employeeId), by: user._id });
  const snapshot = await build(employeeId, { employerId: employer._id });
  const check = await VerificationCheck.create({ employerId: employer._id, employeeId, viewerUserId: user._id, consentId: grant._id, creditsUsed: cost, snapshot, verifyToken: randomToken(12) });
  await audit.log({ req, action: 'report.viewed', entityType: 'VerificationCheck', entityId: check._id, subjectEmployeeId: employeeId });
  return check;
}

async function getForEmployer(employer, checkId, req) {
  const check = await VerificationCheck.findOne({ _id: checkId, employerId: employer._id }).lean();
  if (!check) throw AppError.notFound('Report not found');
  await audit.log({ req, action: 'report.reopened', entityType: 'VerificationCheck', entityId: check._id, subjectEmployeeId: check.employeeId });
  return check;
}

const viewers = (profileId) => VerificationCheck.find({ employeeId: profileId, employerId: { $ne: null } }).populate('employerId', 'companyName').select('-snapshot').sort({ createdAt: -1 }).lean();

async function selfReport(profileId) {
  const snapshot = await build(profileId, {});
  return VerificationCheck.create({ employeeId: profileId, creditsUsed: 0, snapshot, verifyToken: randomToken(12) });
}

async function pdf(profileId) {
  const PDFDocument = require('pdfkit');
  const QRCode = require('qrcode');
  const check = await selfReport(profileId);
  const s = check.snapshot;
  const url = `${env.clientUrl}/verify/${check.verifyToken}`;
  const qr = await QRCode.toBuffer(url, { width: 120, margin: 1 });
  const doc = new PDFDocument({ margin: 48, size: 'A4' });
  const chunks = [];
  doc.on('data', (c) => chunks.push(c));
  const done = new Promise((r) => doc.on('end', () => r(Buffer.concat(chunks))));
  doc.rect(0, 0, doc.page.width, 70).fill('#D7141A');
  doc.fillColor('#fff').fontSize(24).font('Helvetica-Bold').text('EIBIL', 48, 22).fontSize(9).font('Helvetica').text('Employee Information Base of India - Employment Report', 130, 32);
  doc.fillColor('#0F172A').moveDown(3).fontSize(16).font('Helvetica-Bold').text(s.identity.fullName, 48, 95);
  doc.fontSize(10).font('Helvetica').fillColor('#475569').text(`EIBIL ID: ${s.identity.eibilId}   PAN: ${s.identity.panMasked || '-'}   PAN verified: ${s.identity.panVerified ? 'Yes' : 'No'}`);
  doc.text(`Score as of: ${new Date(s.asOf).toISOString()}   Generated: ${new Date(s.generatedAt).toISOString()}`);
  doc.image(qr, doc.page.width - 168, 85, { width: 110 });
  doc.moveDown().fillColor('#D7141A').fontSize(36).font('Helvetica-Bold').text(String(s.score.value ?? 'N/A'), 48, 150);
  doc.fillColor('#0F172A').fontSize(12).text(`Band: ${s.score.band || '-'}  (range ${s.score.range.join('-')})`);
  const section = (t) => { doc.moveDown().fillColor('#0F172A').fontSize(13).font('Helvetica-Bold').text(t); doc.font('Helvetica').fontSize(10).fillColor('#334155'); };
  section('Verified employment');
  s.employment.forEach((e) => doc.text(`- ${e.company} | ${e.designation} | ${new Date(e.startDate).toDateString()} - ${e.endDate ? new Date(e.endDate).toDateString() : 'Present'} | ${e.status}`));
  section('Evaluation summary');
  const es = s.evaluationSummary;
  doc.text(`${es.count} evaluations. Performance ${es.performance ?? '-'}, Professionalism ${es.professionalism ?? '-'}, Reliability ${es.reliability ?? '-'}, Conduct ${es.conduct ?? '-'}`);
  section('Exit records');
  if (!s.exits.length) doc.text('No published separations.');
  s.exits.forEach((x) => doc.text(`- ${x.company}: ${x.separationType} | ${x.status} | rehire: ${x.rehireEligibility || '-'}${x.rebuttals.length ? ` | Employee rebuttal: "${x.rebuttals[0].statement}"` : ''}`));
  doc.moveDown(2).fontSize(8).fillColor('#64748B').text(`Verify authenticity: ${url}. Records are sealed in a SHA-256 hash-chained ledger. Salary/CTC is never included.`);
  doc.end();
  return done;
}

async function publicVerify(token) {
  const check = await VerificationCheck.findOne({ verifyToken: token }).lean();
  if (!check) throw AppError.notFound('Report token not found or invalid');
  const integrity = await ledger.verifyIntegrity();
  const s = check.snapshot;
  return { authentic: true, eibilId: s.identity.eibilId, fullName: s.identity.fullName, panMasked: s.identity.panMasked, score: s.score.value, band: s.score.band, asOf: s.asOf, generatedAt: check.createdAt, ledgerValid: integrity.valid };
}

module.exports = { build, generateForEmployer, getForEmployer, viewers, pdf, publicVerify, selfReport };
