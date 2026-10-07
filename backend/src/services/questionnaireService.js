const Question = require('../models/Question');
const AppError = require('../utils/AppError');

const DIMS = ['performance', 'professionalism', 'reliability', 'conduct'];
const RATING = [['1 - Poor', 10], ['2 - Below expectations', 45], ['3 - Meets expectations', 75], ['4 - Exceeds expectations', 88], ['5 - Outstanding', 100]];
const opts = (pairs) => pairs.map(([label, points]) => ({ label, points }));
const YES_GOOD = opts([['Yes', 100], ['No', 50]]);
const NO_GOOD = opts([['Yes', 0], ['No', 100]]);

const DEFAULT_OPTIONS = { rating: opts(RATING), yes_no: opts([['Yes', 100], ['No', 0]]), mcq: opts([['Option A', 100], ['Option B', 50], ['Option C', 0]]) };

const DEFAULTS = [
  ['performance', 'rating', 'How consistently did the employee meet agreed targets / KPIs this period?', 3],
  ['performance', 'rating', 'Quality and accuracy of work delivered', 2],
  ['performance', 'yes_no', 'Did the employee deliver a significant achievement or project this period?', 1, YES_GOOD],
  ['professionalism', 'rating', 'Communication with team members and stakeholders', 2],
  ['professionalism', 'rating', 'Adherence to company policies and code of conduct', 2],
  ['professionalism', 'mcq', 'How would you describe their ownership of responsibilities?', 2, opts([['Takes full ownership', 100], ['Usually owns tasks', 75], ['Needs frequent reminders', 40], ['Avoids responsibility', 0]])],
  ['reliability', 'rating', 'Attendance and punctuality', 2],
  ['reliability', 'rating', 'Meets deadlines without follow-up', 2],
  ['reliability', 'yes_no', 'Were there any unapproved absences this period?', 1, NO_GOOD],
  ['conduct', 'rating', 'Behaviour with colleagues and clients', 2],
  ['conduct', 'yes_no', 'Was any disciplinary action taken this period?', 3, NO_GOOD],
  ['conduct', 'rating', 'Integrity and honesty in dealings', 2],
];

async function ensureDefaults() {
  if (await Question.estimatedDocumentCount()) return;
  await Question.insertMany(DEFAULTS.map(([dimension, type, text, weight, options], i) => ({ dimension, type, text, weight, options: options || DEFAULT_OPTIONS[type], order: i })));
}

async function active() {
  await ensureDefaults();
  return Question.find({ active: true }).sort({ dimension: 1, order: 1 }).lean();
}

async function all() {
  await ensureDefaults();
  return Question.find().sort({ dimension: 1, order: 1 }).lean();
}

// answers: [{ questionId, optionIndex }] -> snapshot + per-dimension 0-100 scores
async function scoreAnswers(answers, { requireAll = true, fallback = 75 } = {}) {
  const questions = await active();
  const byId = new Map(questions.map((q) => [String(q._id), q]));
  const given = new Map((answers || []).map((a) => [String(a.questionId), a.optionIndex]));
  if (requireAll) {
    const missing = questions.filter((q) => !given.has(String(q._id)));
    if (missing.length) throw AppError.badRequest(`Please answer all questions (${missing.length} unanswered)`);
  }
  const snapshot = [];
  given.forEach((idx, qid) => {
    const q = byId.get(qid);
    if (!q) throw AppError.badRequest('Questionnaire changed. Please reload and answer again');
    const opt = q.options[idx];
    if (!opt) throw AppError.badRequest(`Invalid answer for "${q.text}"`);
    snapshot.push({ questionId: q._id, text: q.text, dimension: q.dimension, type: q.type, weight: q.weight, optionIndex: idx, answer: opt.label, points: opt.points });
  });
  return { answers: snapshot, dims: dimsFrom(snapshot, fallback) };
}

function dimsFrom(snapshot, fallback = 75) {
  return Object.fromEntries(DIMS.map((d) => {
    const rows = snapshot.filter((a) => a.dimension === d);
    const w = rows.reduce((s, a) => s + a.weight, 0);
    return [d, w ? Math.round(rows.reduce((s, a) => s + a.points * a.weight, 0) / w) : fallback];
  }));
}

module.exports = { DIMS, DEFAULT_OPTIONS, ensureDefaults, active, all, scoreAnswers, dimsFrom };
