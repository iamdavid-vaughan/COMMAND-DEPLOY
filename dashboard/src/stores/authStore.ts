/**
 * Auth Store - Global authentication state with Zustand
 */

import { create } from 'zustand';
import { authAPI } from '@/lib/api';

interface User {
  id: string;
  email: string;
  name: string;
  licenseTier: string;
  role?: string;
  superAdminFor?: string[];
}

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string, company?: string) => Promise<void>;
  logout: () => void;
  setUser: (user: User) => void;
  clearError: () => void;
  initAuth: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  isLoading: false,
  error: null,

  login: async (email: string, password: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await authAPI.login(email, password);
      const { user, token } = response.data;

      // Store token and user
      localStorage.setItem('focal_auth_token', token);
      localStorage.setItem('focal_user', JSON.stringify(user));

      set({ user, token, isLoading: false });
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || 'Login failed';
      set({ error: errorMessage, isLoading: false });
      throw error;
    }
  },

  register: async (email: string, password: string, name: string, company?: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await authAPI.register({ email, password, name, company });
      const { user, token } = response.data;

      // Store token and user
      localStorage.setItem('focal_auth_token', token);
      localStorage.setItem('focal_user', JSON.stringify(user));

      set({ user, token, isLoading: false });
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || 'Registration failed';
      set({ error: errorMessage, isLoading: false });
      throw error;
    }
  },

  logout: () => {
    // Clear storage
    localStorage.removeItem('focal_auth_token');
    localStorage.removeItem('focal_user');

    // Clear state
    set({ user: null, token: null, error: null });

    // Call logout endpoint (fire and forget)
    authAPI.logout().catch(() => {});
  },

  setUser: (user: User) => {
    set({ user });
    localStorage.setItem('focal_user', JSON.stringify(user));
  },

  clearError: () => {
    set({ error: null });
  },

  initAuth: () => {
    // Initialize auth from localStorage
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('focal_auth_token');
      const userStr = localStorage.getItem('focal_user');

      if (token && userStr) {
        try {
          const user = JSON.parse(userStr);
          set({ user, token });
        } catch (e) {
          // Invalid stored data, clear it
          localStorage.removeItem('focal_auth_token');
          localStorage.removeItem('focal_user');
        }
      }
    }
  },
}));
