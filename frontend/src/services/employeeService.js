import api, { unwrap, unwrapFull, API_BASE, tokenStore } from './api';

const g = (p, params) => unwrap(api.get(`/employee${p}`, { params }));
const post = (p, b) => unwrapFull(api.post(`/employee${p}`, b));

export const employeeService = {
  profile: () => g('/profile'),
  updateProfile: (b) => unwrapFull(api.put('/employee/profile', b)),
  score: () => g('/score'),
  scoreHistory: () => g('/score/history'),
  employments: () => g('/employments'),
  addEmployment: (b) => post('/employments', b),
  removeEmployment: (id) => unwrapFull(api.delete(`/employee/employments/${id}`)),
  confirmEmployment: (id, accept) => post(`/employments/${id}/confirm`, { accept }),
  evaluations: () => g('/evaluations'),
  disputes: () => g('/disputes'),
  raiseDispute: (b) => post('/disputes', b),
  privacy: () => g('/privacy'),
  updatePrivacy: (b) => unwrapFull(api.put('/employee/privacy', b)),
  consents: () => g('/consents'),
  respondConsent: (id, approve) => post(`/consents/${id}/respond`, { approve }),
  revokeConsent: (id) => post(`/consents/${id}/revoke`),
  exportData: () => g('/data-export'),
  requestDeletion: () => post('/deletion-request'),
  notifications: (params) => g('/notifications', params),
  unreadCount: () => g('/notifications/unread-count'),
  readNotifications: (id) => post('/notifications/read', id ? { id } : {}),
  employers: () => g('/employers'),
  applications: () => g('/applications'),
  savedJobs: () => g('/saved-jobs'),
  toggleSave: (id) => post(`/saved-jobs/${id}`),
  async downloadReport() {
    const res = await fetch(`${API_BASE}/employee/report.pdf`, { headers: { Authorization: `Bearer ${tokenStore.get()}` } });
    if (!res.ok) throw new Error((await res.json()).message);
    const url = URL.createObjectURL(await res.blob());
    const a = Object.assign(document.createElement('a'), { href: url, download: 'EIBIL-Report.pdf' });
    a.click();
    URL.revokeObjectURL(url);
  },
  offers: () => g('/offers'),
  declareOffer: (b) => post('/offers', b),
  offerOtp: (id) => post(`/offers/${id}/accept-otp`),
  acceptOffer: (id, code) => post(`/offers/${id}/accept`, { code }),
  declineOffer: (id) => post(`/offers/${id}/decline`),
  disputeOffer: (id, reason) => post(`/offers/${id}/dispute`, { reason }),
  separations: () => g('/separations'),
  logResignation: (b) => post('/separations', b),
  respondSeparation: (id, b) => post(`/separations/${id}/respond`, b),
  confirmSeparation: (id, b) => unwrapFull(api.post(`/separations/${id}/confirm`, b)),
};
