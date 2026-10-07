const Resume = require('../models/Resume');
const Application = require('../models/Application');
const EmployeeProfile = require('../models/EmployeeProfile');
const { VerificationCheck } = require('../models/misc');
const AppError = require('../utils/AppError');
const { sha256 } = require('../utils/crypto');

const TYPES = {
  'application/pdf': '.pdf',
  'application/msword': '.doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
};

function assertFile(file) {
  if (!file) throw AppError.badRequest('No file received');
  const ok = TYPES[file.mimetype] || (file.mimetype === 'application/octet-stream' && /\.(pdf|doc|docx)$/i.test(file.originalname));
  if (!ok) throw AppError.badRequest('Only PDF, DOC or DOCX resumes are allowed');
  if (file.size > 5 * 1024 * 1024) throw AppError.badRequest('Resume must be under 5 MB');
}

async function upload(user, file) {
  assertFile(file);
  return Resume.create({ userId: user._id, fileName: file.originalname.slice(0, 200), mimeType: file.mimetype, size: file.size, sha256: sha256(file.buffer), data: file.buffer });
}

// Upload and make it the candidate's current resume (replaces any previous one)
async function setCurrent(user, file) {
  const resume = await upload(user, file);
  // old resume is kept if any application still references it
  const profile = await EmployeeProfile.findOneAndUpdate({ userId: user._id }, { resumeId: resume._id, resumeUrl: null });
  if (!profile) throw AppError.notFound('Profile not found');
  if (profile.resumeId && !(await Application.exists({ resumeId: profile.resumeId }))) await Resume.deleteOne({ _id: profile.resumeId });
  return resume;
}

const current = (profileId) => EmployeeProfile.findById(profileId).populate('resumeId', 'fileName mimeType size createdAt').lean().then((p) => p?.resumeId || null);

async function remove(profile) {
  if (profile.resumeId) await Resume.deleteOne({ _id: profile.resumeId });
  profile.resumeId = undefined;
  return profile.save();
}

async function read(id) {
  const resume = await Resume.findById(id).select('+data').lean();
  if (!resume) throw AppError.notFound('Resume not found');
  resume.data = Buffer.isBuffer(resume.data) ? resume.data : Buffer.from(resume.data.buffer ?? resume.data);
  return resume;
}

// Employer may download a resume only if the candidate applied to one of their jobs with it, or they viewed the candidate's report
async function employerCanRead(employerId, resumeId) {
  const application = await Application.findOne({ employerId, resumeId }).lean();
  if (application) return true;
  const profile = await EmployeeProfile.findOne({ resumeId }).lean();
  if (!profile) return false;
  return Boolean(await VerificationCheck.exists({ employerId, employeeId: profile._id }));
}

module.exports = { TYPES, upload, setCurrent, current, remove, read, employerCanRead };
