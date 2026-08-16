import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { APIErrorResponse } from '../types';

export const API_BASE_URL = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000,
});

// Attach JWT Bearer token if present in sessionStorage or localStorage
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = sessionStorage.getItem('lexlogic_token') || localStorage.getItem('lexlogic_token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor for Error Handling
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError<APIErrorResponse>) => {
    const status = error.response?.status;
    const detail = error.response?.data?.detail || error.message || 'An unexpected error occurred';

    if (status === 401) {
      // Clear token on 401 Unauthorized (unless logging in or registering)
      const currentPath = window.location.pathname;
      if (!currentPath.includes('/login') && !currentPath.includes('/register')) {
        sessionStorage.removeItem('lexlogic_token');
        sessionStorage.removeItem('lexlogic_user');
        localStorage.removeItem('lexlogic_token');
        localStorage.removeItem('lexlogic_user');
      }
    }

    return Promise.reject({
      status,
      message: detail,
      errors: error.response?.data?.errors,
      rawError: error,
    });
  }
);
