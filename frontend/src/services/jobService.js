import api, { unwrap, unwrapFull } from './api';

export const jobService = {
  list: (params) => unwrapFull(api.get('/jobs', { params })),
  get: (id) => unwrap(api.get(`/jobs/${id}`)),
  apply: (id, fd) => unwrapFull(api.post(`/jobs/${id}/apply`, fd)),
};

export const publicService = {
  cms: (slug) => unwrap(api.get(`/public/cms/${slug}`)),
  stats: () => unwrap(api.get('/public/stats')),
  plans: () => unwrap(api.get('/public/plans')),
  site: () => unwrap(api.get('/public/site')),
  contact: (b) => unwrapFull(api.post('/public/contact', b)),
  verifyReport: (token) => unwrap(api.get(`/public/report-verify/${token}`)),
};

export const supportService = {
  mine: () => unwrap(api.get('/support/tickets')),
  create: (b) => unwrapFull(api.post('/support/tickets', b)),
};
