import axios from 'axios';
import { useAuthStore } from '../stores/authStore';
import toast from 'react-hot-toast';

const API_URL = import.meta.env.VITE_API_URL || '/api';

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * Custom event used to signal that the user has been logged out
 * (e.g. token expired, 401, etc.).
 *
 * A global listener is registered in main.tsx that clears the auth
 * store and navigates to /login via React Router — avoiding the
 * hard page-reload that `window.location.href` caused, which was
 * a source of errors when navigating backward or exiting pages.
 */
const AUTH_LOGOUT_EVENT = 'auth:logout';
export const triggerAuthLogout = (reason?: string) => {
  if (reason) toast.error(reason);
  window.dispatchEvent(new CustomEvent(AUTH_LOGOUT_EVENT));
};

api.interceptors.request.use(
  (config) => {
    const token = useAuthStore.getState().token;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Don't intercept if the request was aborted (user navigated away)
    if (error.name === 'CanceledError' || error.name === 'AbortError') {
      return Promise.reject(error);
    }

    // Guard for login attempts: a 401 from /auth/login means wrong
    // credentials, NOT an expired session — the login page handles that.
    const isLoginRequest = error.config?.url?.endsWith('/auth/login');

    if (error.response?.status === 401 && !isLoginRequest) {
      // Clear auth state and signal logout via custom event
      useAuthStore.getState().logout();
      triggerAuthLogout('Your session has expired. Please log in again.');
    } else if (error.response?.status >= 400 && error.response?.status < 500) {
      // Show a toast for client errors (4xx) so the user gets feedback,
      // but still reject so individual handlers can react.
      const message =
        error.response?.data?.message || 'Request failed';
      toast.error(message);
    }
    return Promise.reject(error);
  }
);

export default api;