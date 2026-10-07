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

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const newVerifyCode = () => {
  const b = require('crypto').randomBytes(8);
  const c = [...b].map((x) => CODE_CHARS[x % CODE_CHARS.length]).join('');
  return `EIB-${c.slice(0, 4)}-${c.slice(4)}`;
};

async function selfReport(profileId) {
  const snapshot = await build(profileId, {});
  return VerificationCheck.create({ employeeId: profileId, creditsUsed: 0, snapshot, verifyToken: newVerifyCode() });
}

const BRAND = '#D7141A';
const INK = '#0F172A';
const MUTED = '#64748B';
const fmtD = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Present');

async function pdf(profileId) {
  const PDFDocument = require('pdfkit');
  const QRCode = require('qrcode');
  const check = await selfReport(profileId);
  const s = check.snapshot;
  const code = check.verifyToken;
  const url = `${env.clientUrl}/verify/${code}`;
  const qr = await QRCode.toBuffer(url, { width: 220, margin: 1, color: { dark: INK } });
  const doc = new PDFDocument({ margin: 48, size: 'A4', info: { Title: `EIBIL Score Report - ${s.identity.fullName}`, Author: 'EIBIL' } });
  const chunks = [];
  doc.on('data', (c) => chunks.push(c));
  const done = new Promise((r) => doc.on('end', () => r(Buffer.concat(chunks))));
  const W = doc.page.width;
  const L = 48;
  const CW = W - 96;

  doc.rect(0, 0, W, 84).fill(BRAND);
  doc.fillColor('#fff').font('Helvetica-Bold').fontSize(26).text('EIBIL', L, 24);
  doc.font('Helvetica').fontSize(8.5).text('Employment Integrity & Background Intelligence League', L, 54);
  doc.font('Helvetica-Bold').fontSize(11).text('VERIFIED SCORE REPORT', W - 260, 30, { width: 212, align: 'right' });
  doc.font('Helvetica').fontSize(8.5).text(`Generated ${new Date(s.generatedAt).toLocaleString('en-IN')}`, W - 260, 48, { width: 212, align: 'right' });

  doc.fillColor(INK).font('Helvetica-Bold').fontSize(18).text(s.identity.fullName, L, 108);
  doc.font('Helvetica').fontSize(9.5).fillColor(MUTED)
    .text(`EIBIL ID  ${s.identity.eibilId}     PAN  ${s.identity.panMasked || '-'}  ${s.identity.panVerified ? '(verified)' : '(unverified)'}`, L, 132);

  doc.roundedRect(L, 160, 250, 120, 10).fill('#F8FAFC');
  doc.fillColor(MUTED).fontSize(8).font('Helvetica-Bold').text('EIBIL SCORE', L + 18, 174, { characterSpacing: 1 });
  doc.fillColor(BRAND).font('Helvetica-Bold').fontSize(46).text(String(s.score.value ?? 'N/A'), L + 18, 188);
  doc.fillColor(INK).fontSize(11).text(`${s.score.band || '-'}`, L + 18, 240);
  doc.fillColor(MUTED).font('Helvetica').fontSize(8).text(`Range ${s.score.range.join(' - ')}   |   As of ${new Date(s.asOf).toLocaleString('en-IN')}`, L + 18, 258);

  const dims = ['performance', 'professionalism', 'reliability', 'conduct'];
  const es = s.evaluationSummary;
  const dx = L + 270;
  doc.fillColor(MUTED).font('Helvetica-Bold').fontSize(8).text(`DIMENSIONS  (${es.count} accepted evaluations)`, dx, 166, { characterSpacing: 1 });
  dims.forEach((d, i) => {
    const y = 186 + i * 24;
    const v = es[d];
    doc.fillColor(INK).font('Helvetica').fontSize(9.5).text(d[0].toUpperCase() + d.slice(1), dx, y);
    doc.font('Helvetica-Bold').text(v ?? '-', dx + 180, y, { width: 46, align: 'right' });
    doc.roundedRect(dx, y + 13, 226, 4, 2).fill('#E2E8F0');
    if (v) doc.roundedRect(dx, y + 13, (226 * Math.min(v, 100)) / 100, 4, 2).fill(BRAND);
  });

  let y = 304;
  const heading = (t) => {
    doc.fillColor(INK).font('Helvetica-Bold').fontSize(12).text(t, L, y);
    doc.moveTo(L, y + 18).lineTo(L + CW, y + 18).lineWidth(0.5).strokeColor('#E2E8F0').stroke();
    y += 28;
  };
  heading('Verified employment history');
  const jobs = s.employment.filter((e) => e.status === 'verified');
  if (!jobs.length) { doc.fillColor(MUTED).font('Helvetica').fontSize(9.5).text('No employer-verified records yet.', L, y); y += 18; }
  jobs.forEach((e) => {
    doc.fillColor(INK).font('Helvetica-Bold').fontSize(10).text(e.company, L, y, { width: 300 });
    doc.fillColor(MUTED).font('Helvetica').fontSize(9).text(`${e.designation || '-'}${e.department ? ` · ${e.department}` : ''}`, L, y + 13, { width: 300 });
    doc.fillColor(INK).fontSize(9).text(`${fmtD(e.startDate)} - ${e.isCurrent ? 'Present' : fmtD(e.endDate)}`, L + 310, y, { width: 140 });
    doc.fillColor('#059669').font('Helvetica-Bold').fontSize(8).text('VERIFIED', L + CW - 60, y, { width: 60, align: 'right' });
    y += 34;
  });

  y = Math.max(y + 10, 560);
  doc.roundedRect(L, y, CW, 150, 10).lineWidth(1).strokeColor(BRAND).stroke();
  doc.image(qr, L + 14, y + 14, { width: 122 });
  doc.fillColor(MUTED).font('Helvetica-Bold').fontSize(8).text('VERIFICATION CODE', L + 156, y + 22, { characterSpacing: 1 });
  doc.fillColor(INK).font('Courier-Bold').fontSize(22).text(code, L + 156, y + 36);
  doc.fillColor(INK).font('Helvetica').fontSize(9).text('Recruiters: scan the QR code or enter this code at', L + 156, y + 70, { width: CW - 170 });
  doc.fillColor(BRAND).font('Helvetica-Bold').text(`${env.clientUrl}/verify`, L + 156, y + 84, { width: CW - 170, link: url, underline: true });
  doc.fillColor(MUTED).font('Helvetica').fontSize(8).text('to confirm this report is authentic and unaltered.', L + 156, y + 100, { width: CW - 170 });

  doc.fillColor(MUTED).fontSize(7.5).text('Records are sealed in a SHA-256 hash-chained, append-only ledger. Salary/CTC is never included. The employee can view, rebut and dispute every record. This report reflects the score as of the timestamp above.', L, 770, { width: CW, align: 'center' });
  doc.end();
  return done;
}

async function publicVerify(token) {
  const raw = String(token || '').trim();
  const check = await VerificationCheck.findOne({ verifyToken: { $in: [raw, raw.toUpperCase()] } }).lean();
  if (!check) throw AppError.notFound('Report code not found or invalid');
  const integrity = await ledger.verifyIntegrity();
  const s = check.snapshot;
  return {
    authentic: true, code: check.verifyToken, eibilId: s.identity.eibilId, fullName: s.identity.fullName, panMasked: s.identity.panMasked,
    score: s.score.value, band: s.score.band, asOf: s.asOf, generatedAt: check.createdAt, ledgerValid: integrity.valid,
    dimensions: s.evaluationSummary,
    employment: (s.employment || []).filter((e) => e.status === 'verified').map((e) => ({ company: e.company, designation: e.designation, startDate: e.startDate, endDate: e.endDate, isCurrent: e.isCurrent })),
  };
}

module.exports = { build, generateForEmployer, getForEmployer, viewers, pdf, publicVerify, selfReport };
