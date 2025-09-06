import axios from 'axios';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE?.replace(/\/$/, '') + '/api',
  withCredentials: false,
  timeout: 15000,
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const msg = err?.response?.data?.error || err.message || 'Network error';
    console.error('[API]', msg, err?.response?.data);
    return Promise.reject(new Error(msg));
  }
);
