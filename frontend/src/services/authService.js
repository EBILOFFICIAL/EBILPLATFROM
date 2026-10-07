import api, { unwrap, unwrapFull } from './api';

export const authService = {
  register: (role, body) => unwrapFull(api.post(`/auth/register?role=${role}`, body)),
  login: (body) => unwrapFull(api.post('/auth/login', body)),
  verify2fa: (body) => unwrap(api.post('/auth/2fa/verify', body)),
  verifyEmail: (body) => unwrap(api.post('/auth/verify-email', body)),
  resendOtp: (body) => unwrapFull(api.post('/auth/resend-otp', body)),
  me: () => unwrap(api.get('/auth/me')),
  logout: () => api.post('/auth/logout'),
  forgot: (body) => unwrapFull(api.post('/auth/forgot-password', body)),
  reset: (body) => unwrapFull(api.post('/auth/reset-password', body)),
  changePassword: (body) => unwrapFull(api.post('/auth/change-password', body)),
  setup2fa: (enabled) => unwrapFull(api.post('/auth/2fa/setup', { enabled })),
  sessions: () => unwrap(api.get('/auth/sessions')),
  revokeSessions: () => api.delete('/auth/sessions'),
  verifyPan: (body) => unwrapFull(api.post('/verification/pan', body)),
  verificationStatus: () => unwrap(api.get('/verification/status')),
  mobileSend: () => unwrapFull(api.post('/verification/mobile/send')),
  mobileVerify: (code) => unwrapFull(api.post('/verification/mobile/verify', { code })),
  uploadDocument: (file, purpose) => {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('purpose', purpose);
    return unwrap(api.post('/verification/documents', fd));
  },
};
