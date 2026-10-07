import api, { unwrap, unwrapFull } from './api';

export const adminService = {
  list: (path, params) => unwrapFull(api.get(`/admin${path}`, { params })),
  get: (path, params) => unwrap(api.get(`/admin${path}`, { params })),
  post: (path, body) => unwrapFull(api.post(`/admin${path}`, body)),
  put: (path, body) => unwrapFull(api.put(`/admin${path}`, body)),
  del: (path) => unwrapFull(api.delete(`/admin${path}`)),
};
