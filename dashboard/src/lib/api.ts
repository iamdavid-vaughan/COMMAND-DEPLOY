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

  forgotPassword: (email: string) =>
    api.post('/api/auth/forgot-password', { email }),

  resetPassword: (token: string, password: string) =>
    api.post('/api/auth/reset-password', { token, password }),
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

export const twoFactorAPI = {
  // Get 2FA status
  status: () => api.get('/api/auth/2fa/status'),

  // Setup 2FA (returns QR code and backup codes)
  setup: () => api.post('/api/auth/2fa/setup'),

  // Verify TOTP code to enable 2FA
  verify: (token: string) => api.post('/api/auth/2fa/verify', { token }),

  // Verify 2FA code during login
  verifyLogin: (token: string, tempToken: string) =>
    api.post('/api/auth/2fa/verify-login', { token, tempToken }),

  // Disable 2FA
  disable: (password: string) => api.post('/api/auth/2fa/disable', { password }),

  // Regenerate backup codes
  regenerateBackupCodes: () => api.post('/api/auth/2fa/regenerate-backup-codes'),
};

export const deploymentsAPI = {
  list: (params?: { status?: string; limit?: number; offset?: number }) =>
    api.get('/api/deployments', { params }),

  get: (id: string) =>
    api.get(`/api/deployments/${id}`),

  getById: (id: string) =>
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

  getLogs: (id: string) =>
    api.get(`/api/deployments/${id}/logs`),

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
  getSubscription: () => api.get('/api/billing/subscription'),

  subscribe: (data: {
    plan: string;
    billingCycle: string;
    paymentProfile: {
      cardNumber: string;
      expirationDate: string;
      cardCode: string;
      firstName: string;
      lastName: string;
      address?: string;
      city?: string;
      state?: string;
      zip?: string;
    };
  }) => api.post('/api/billing/subscribe', data),

  updateSubscription: (data: {
    plan: string;
    billingCycle?: string;
  }) => api.patch('/api/billing/subscription', data),

  cancelSubscription: () => api.delete('/api/billing/subscription'),

  getInvoices: (params?: { limit?: number; offset?: number }) =>
    api.get('/api/billing/invoices', { params }),

  updatePaymentMethod: (data: {
    paymentProfile: {
      cardNumber: string;
      expirationDate: string;
      cardCode: string;
      firstName: string;
      lastName: string;
      address?: string;
      city?: string;
      state?: string;
      zip?: string;
    };
  }) => api.post('/api/billing/payment-method', data),

  getPlans: () => api.get('/api/billing/plans'),
};

export const pricingAPI = {
  list: () => api.get('/api/pricing'),

  get: (tier: string) => api.get(`/api/pricing/${tier}`),
};

export const apiKeysAPI = {
  list: () => api.get('/api/api-keys'),

  create: (data: {
    name: string;
    permissions?: string[];
    expiresInDays?: number;
  }) => api.post('/api/api-keys', data),

  update: (id: string, data: { name: string }) =>
    api.patch(`/api/api-keys/${id}`, data),

  revoke: (id: string) => api.delete(`/api/api-keys/${id}`),
};

export const adminAPI = {
  // User management
  users: (params?: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
    tier?: string;
  }) => api.get('/api/admin/users', { params }),

  getUser: (id: string) => api.get(`/api/admin/users/${id}`),

  updateUser: (id: string, data: {
    firstName?: string;
    lastName?: string;
    companyName?: string;
    licenseTier?: string;
    status?: string;
    role?: string;
  }) => api.patch(`/api/admin/users/${id}`, data),

  resetPassword: (id: string, newPassword: string) =>
    api.post(`/api/admin/users/${id}/reset-password`, { newPassword }),

  deleteUser: (id: string) => api.delete(`/api/admin/users/${id}`),

  // Platform statistics
  stats: () => api.get('/api/admin/stats'),
};

export const auditAPI = {
  // Query audit logs
  logs: (params?: {
    category?: string;
    severity?: string;
    action?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
    offset?: number;
  }) => api.get('/api/audit/logs', { params }),

  // Get statistics
  statistics: () => api.get('/api/audit/statistics'),

  // Log an event
  log: (data: {
    action: string;
    category?: string;
    severity?: string;
    metadata?: any;
    ipAddress?: string;
  }) => api.post('/api/audit/log', data),

  // Export logs
  export: (params?: {
    format?: 'json' | 'csv';
    category?: string;
    severity?: string;
    startDate?: string;
    endDate?: string;
  }) => api.post('/api/audit/export', params, {
    responseType: params?.format === 'csv' ? 'blob' : 'json',
  }),

  // Clear logs
  clear: (params?: {
    olderThan?: string;
    category?: string;
  }) => api.delete('/api/audit/clear', { data: params }),
};

export const passwordSecurityAPI = {
  // Check password for breaches
  check: (password: string) =>
    api.post('/api/password-security/check', { password }),

  // Check password strength only
  checkStrength: (password: string) =>
    api.post('/api/password-security/check-strength', { password }),

  // Generate secure password
  generate: (params?: {
    length?: number;
    includeSymbols?: boolean;
    includeNumbers?: boolean;
    includeUppercase?: boolean;
    includeLowercase?: boolean;
  }) => api.post('/api/password-security/generate', params),

  // Batch check passwords
  batchCheck: (passwords: string[]) =>
    api.post('/api/password-security/batch-check', { passwords }),
};

export default api;
