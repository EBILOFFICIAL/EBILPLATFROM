import api, { unwrap, unwrapFull, API_BASE, tokenStore } from './api';

const g = (p, params) => unwrap(api.get(`/employer${p}`, { params }));
const post = (p, b) => unwrapFull(api.post(`/employer${p}`, b));

export const employerService = {
  profile: () => g('/profile'),
  updateProfile: (b) => unwrapFull(api.put('/employer/profile', b)),
  dashboard: () => g('/dashboard'),
  verifyCandidate: (b) => post('/verify-candidate', b),
  bulkVerify: (file) => { const fd = new FormData(); fd.append('file', file); return unwrapFull(api.post('/employer/verify-candidate/bulk', fd)); },
  consentOtp: (id, code) => post(`/consents/${id}/otp`, { code }),
  consents: () => g('/consents'),
  generateReport: (employeeId) => post('/reports', { employeeId }),
  report: (id) => g(`/reports/${id}`),
  reports: () => g('/reports'),
  async downloadResume(id, fileName = 'resume') {
    const res = await fetch(`${API_BASE}/employer/resumes/${id}/download`, { headers: { Authorization: `Bearer ${tokenStore.get()}` } });
    if (!res.ok) throw new Error((await res.json()).message);
    const name = res.headers.get('Content-Disposition')?.split('filename="')[1]?.replace(/"$/, '') || fileName;
    const url = URL.createObjectURL(await res.blob());
    const a = Object.assign(document.createElement('a'), { href: url, download: name });
    a.click(); URL.revokeObjectURL(url);
  },
  questionnaire: () => g('/questionnaire'),
  employees: (status) => g('/employees', { status }),
  addEmployee: (b) => post('/employees', b),
  verifyEmployment: (id, b) => post(`/employments/${id}/verify`, b),
  evaluations: () => g('/evaluations'),
  createEvaluation: (b) => post('/evaluations', b),
  updateEvaluation: (id, b) => unwrapFull(api.put(`/employer/evaluations/${id}`, b)),
  talent: (params) => g('/talent', params),
  team: () => g('/team'),
  invite: (b) => post('/team', b),
  removeMember: (id) => unwrapFull(api.delete(`/employer/team/${id}`)),
  usage: () => g('/usage'),
  jobs: () => g('/jobs'),
  createJob: (b) => post('/jobs', b),
  updateJob: (id, b) => unwrapFull(api.put(`/employer/jobs/${id}`, b)),
  applicants: (id) => g(`/jobs/${id}/applicants`),
  setApplicationStatus: (id, status, note, ids) => unwrapFull(api.patch(`/employer/applications/${id}/status`, { status, note, ids })),
  invoices: () => g('/invoices'),
  notifications: () => g('/notifications'),
  offers: () => g('/offers'),
  issueOffer: (b) => post('/offers', b),
  confirmJoin: (id) => post(`/offers/${id}/confirm-join`),
  markNoShow: (id) => post(`/offers/${id}/mark-no-show`),
  withdrawOffer: (id, reason) => post(`/offers/${id}/withdraw`, { reason }),
  separations: () => g('/separations'),
  logSeparation: (b) => post('/separations', b),
  saveAssessment: (id, b) => unwrapFull(api.put(`/employer/separations/${id}/assessment`, b)),
  submitAssessment: (id) => post(`/separations/${id}/submit-assessment`),
  confirmSeparation: (id, b) => unwrapFull(api.post(`/separations/${id}/confirm`, b)),
  references: () => g('/reference-requests'),
  createReference: (b) => post('/reference-requests', b),
  respondReference: (id, response) => post(`/reference-requests/${id}/respond`, { response }),
};

export const billingService = {
  plans: () => unwrap(api.get('/billing/plans')),
  subscribe: (b) => unwrap(api.post('/billing/subscribe', b)),
  purchaseCredits: (b) => unwrap(api.post('/billing/credits/purchase', b)),
  verify: (b) => unwrapFull(api.post('/billing/verify', b)),
};
