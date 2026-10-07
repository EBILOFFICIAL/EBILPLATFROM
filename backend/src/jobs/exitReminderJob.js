const SeparationCase = require('../models/SeparationCase');
const ExitAssessment = require('../models/ExitAssessment');
const ledger = require('../services/ledgerService');
const notify = require('../services/notificationService');
const exits = require('../services/exitAssessmentService');
const references = require('../services/referenceService');

module.exports = async () => {
  const now = new Date();
  const log = [];
  await SeparationCase.updateMany({ status: 'notice_running', lastWorkingDay: { $lte: now } }, { status: 'assessment_pending' });
  const pending = await SeparationCase.find({ status: { $in: ['notice_running', 'assessment_pending'] }, assessmentDueAt: { $ne: null } });
  let changes = 0;
  for (const sc of pending) {
    const submitted = await ExitAssessment.exists({ separationCaseId: sc._id, submittedAt: { $ne: null } });
    if (submitted) continue;
    if (sc.assessmentDueAt < now) {
      sc.status = 'not_submitted';
      await sc.save();
      await ledger.append({ entityType: 'separation', entityId: sc._id, action: 'not_submitted', subjectId: sc.employeeId, payload: { dueAt: sc.assessmentDueAt } });
      log.push(`${sc._id}: marked not_submitted`);
      changes += 1;
    } else if (sc.status === 'assessment_pending' && sc.remindersSent < 3) {
      await notify.notifyEmployer(sc.employerId, { title: 'Exit assessment due', body: `Submit by ${sc.assessmentDueAt.toDateString()}`, link: '/employer/separations' });
      sc.remindersSent += 1;
      await sc.save();
    }
  }
  const published = await exits.publishDue();
  await references.markOverdue();
  return { processed: pending.length + published.processed, changes: changes + published.changes, log };
};
