import axios from 'axios';

const api = axios.create({ baseURL: '/api' });

api.interceptors.request.use(cfg => {
  const t = localStorage.getItem('gs_token');
  if (t) cfg.headers.Authorization = `Bearer ${t}`;
  return cfg;
});

api.interceptors.response.use(
  r => r,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('gs_token');
      window.location.href = '/';
    }
    return Promise.reject(err);
  }
);

export const authAPI = {
  register:   d => api.post('/auth/register', d),
  login:      d => api.post('/auth/login', d),
  adminLogin: d => api.post('/auth/admin/login', d),
  me:         () => api.get('/auth/me'),
};

export const policyAPI = {
  plans:   () => api.get('/policies/plans'),
  active:  () => api.get('/policies/active'),
  my:      () => api.get('/policies/my'),
  buy:     planId => api.post('/policies', { planId }),
  cancel:  () => api.delete('/policies/active'),
};

export const claimsAPI = {
  my:      () => api.get('/claims/my'),
  all:     () => api.get('/claims'),
  approve: id => api.post(`/claims/${id}/approve`),
  reject:  (id, reason) => api.post(`/claims/${id}/reject`, { reason }),
};

export const dashAPI = {
  worker: () => api.get('/dashboard/worker'),
  admin:  () => api.get('/dashboard/admin'),
};

export const triggerAPI = {
  recent:   () => api.get('/triggers/recent'),
  simulate: type => api.post('/triggers/simulate', { type }),
};

export const workerAPI = {
  zones:         () => api.get('/workers/zones'),
  riskProfile:   () => api.get('/workers/risk-profile'),
  updateProfile: d  => api.patch('/workers/profile', d),
};

export const walletAPI = {
  balance:      ()        => api.get('/wallet/balance'),
  transactions: (limit=50)=> api.get(`/wallet/transactions?limit=${limit}`),
  add:          d         => api.post('/wallet/add', d),
  withdraw:     d         => api.post('/wallet/withdraw', d),
};

export default api;