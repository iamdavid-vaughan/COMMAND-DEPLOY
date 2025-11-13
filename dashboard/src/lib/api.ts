/**
 * API Client - Axios instance with interceptors for Focal Deploy API
 */

import axios, { AxiosError, AxiosResponse } from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.focuswithfocal.io';

// Create axios instance
export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

// Request interceptor - attach JWT token
api.interceptors.request.use(
  (config) => {
    // Get token from localStorage
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('focal_auth_token');
      console.log(`🌐 [API] Request to ${config.url} - Token:`, token ? `${token.substring(0, 20)}... (${token.length} chars)` : 'NO TOKEN');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      } else {
        console.warn(`🌐 [API] No token found for request to ${config.url}`);
      }
    }
    return config;
  },
  (error) => {
    console.error('🌐 [API] Request interceptor error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor - handle errors and token refresh
api.interceptors.response.use(
  (response: AxiosResponse) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config;

    // Handle 401 Unauthorized
    if (error.response?.status === 401 && originalRequest) {
      // Try to refresh token
      try {
        const response = await axios.post(`${API_URL}/api/auth/refresh`, {}, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('focal_auth_token')}`
          }
        });

        const newToken = response.data.token;
        localStorage.setItem('focal_auth_token', newToken);

        // Retry original request with new token
        originalRequest.headers = originalRequest.headers || {};
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return axios(originalRequest);
      } catch (refreshError) {
        // Refresh failed, redirect to login
        if (typeof window !== 'undefined') {
          localStorage.removeItem('focal_auth_token');
          localStorage.removeItem('focal_user');
          window.location.href = '/login';
        }
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

// API Methods
export const authAPI = {
  login: (email: string, password: string) =>
    api.post('/api/auth/login', { email, password }),

  register: (data: { email: string; password: string; name: string; company?: string }) =>
    api.post('/api/auth/register', data),

  logout: () => api.post('/api/auth/logout'),

  refresh: () => api.post('/api/auth/refresh'),
};

export const userAPI = {
  profile: () => api.get('/api/user/profile'),

  updateProfile: (data: {
    firstName?: string;
    lastName?: string;
    companyName?: string;
  }) => api.patch('/api/user/profile', data),

  changePassword: (data: {
    currentPassword: string;
    newPassword: string;
  }) => api.post('/api/user/password', data),

  deleteAccount: () => api.delete('/api/user/account'),
};

export const deploymentsAPI = {
  list: (params?: { status?: string; limit?: number; offset?: number }) =>
    api.get('/api/deployments', { params }),

  get: (id: string) =>
    api.get(`/api/deployments/${id}`),

  create: (data: {
    projectName: string;
    region?: string;
    instanceType?: string;
    domains?: string[];
    configuration?: any;
  }) => api.post('/api/deployments', data),

  update: (id: string, data: {
    status?: string;
    publicIp?: string;
    instanceId?: string;
    errorMessage?: string;
  }) => api.patch(`/api/deployments/${id}`, data),

  delete: (id: string) =>
    api.delete(`/api/deployments/${id}`),

  logs: (id: string) =>
    api.get(`/api/deployments/${id}/logs`),
};

export const credentialsAPI = {
  list: () => api.get('/api/credentials'),

  get: (id: string) => api.get(`/api/credentials/${id}`),

  create: (data: {
    type: 'aws' | 'digitalocean' | 'cloudflare' | 'godaddy' | 'route53' | 'github';
    data: any;
    metadata?: any;
  }) => api.post('/api/credentials', data),

  update: (id: string, data: { data: any; metadata?: any }) =>
    api.patch(`/api/credentials/${id}`, data),

  delete: (id: string) =>
    api.delete(`/api/credentials/${id}`),
};

export const usageAPI = {
  current: (period?: string) =>
    api.get('/api/usage', { params: { period } }),

  history: (months?: number) =>
    api.get('/api/usage/history', { params: { months } }),

  limits: () =>
    api.get('/api/usage/limits'),

  export: (format: 'json' | 'csv', period?: string) =>
    api.get('/api/usage/export', {
      params: { format, period },
      responseType: format === 'csv' ? 'blob' : 'json',
    }),
};

export const billingAPI = {
  subscription: () => api.get('/api/billing/subscription'),

  invoices: () => api.get('/api/billing/invoices'),

  invoice: (id: string) => api.get(`/api/billing/invoices/${id}`),

  updateSubscription: (data: {
    licenseTier: string;
    billingCycle: 'monthly' | 'annual';
  }) => api.post('/api/billing/subscription', data),
};

export const pricingAPI = {
  list: () => api.get('/api/pricing'),

  get: (tier: string) => api.get(`/api/pricing/${tier}`),
};

export default api;
