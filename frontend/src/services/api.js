import axios from 'axios';

export const API_BASE = `${import.meta.env.REACT_APP_BACKEND_URL}/api/v1`;
const TOKEN_KEY = 'eibil_at';

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (t) => (t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY)),
};

const api = axios.create({ baseURL: API_BASE, withCredentials: true });

api.interceptors.request.use((config) => {
  const t = tokenStore.get();
  if (t) config.headers.Authorization = `Bearer ${t}`;
  return config;
});

let refreshing = null;
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    const url = original?.url || '';
    if (error.response?.status === 401 && !original._retry && !url.includes('/auth/')) {
      original._retry = true;
      try {
        refreshing = refreshing || axios.post(`${API_BASE}/auth/refresh`, {}, { withCredentials: true });
        const { data } = await refreshing;
        tokenStore.set(data.data.accessToken);
        return api(original);
      } catch {
        tokenStore.set(null);
      } finally {
        refreshing = null;
      }
    }
    return Promise.reject(error);
  },
);

export const errorMessage = (e) => {
  const d = e?.response?.data;
  if (d?.errors?.length) return d.errors.map((x) => x.message).join('. ');
  return d?.message || e?.message || 'Something went wrong';
};

export const unwrap = (p) => p.then((r) => r.data.data);
export const unwrapFull = (p) => p.then((r) => r.data);

export default api;
