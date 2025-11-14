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
  isInitialized: boolean;
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
  isInitialized: false,
  error: null,

  login: async (email: string, password: string) => {
    console.log('🔐 [AUTH] Login started for:', email);
    set({ isLoading: true, error: null });
    try {
      const response = await authAPI.login(email, password);
      console.log('🔐 [AUTH] Login response received:', response.data);
      const { user, token } = response.data;

      console.log('🔐 [AUTH] Token from response:', token ? `${token.substring(0, 20)}... (${token.length} chars)` : 'NO TOKEN');
      console.log('🔐 [AUTH] User from response:', user);

      // Store token and user
      localStorage.setItem('focal_auth_token', token);
      localStorage.setItem('focal_user', JSON.stringify(user));

      // Verify storage
      const storedToken = localStorage.getItem('focal_auth_token');
      const storedUser = localStorage.getItem('focal_user');
      console.log('🔐 [AUTH] Stored token:', storedToken ? `${storedToken.substring(0, 20)}... (${storedToken.length} chars)` : 'NO TOKEN');
      console.log('🔐 [AUTH] Stored user:', storedUser);

      set({ user, token, isLoading: false });
      console.log('🔐 [AUTH] Login completed successfully');
    } catch (error: any) {
      console.error('🔐 [AUTH] Login failed:', error);
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
    console.log('🔐 [AUTH] Logout called');
    // Clear storage
    localStorage.removeItem('focal_auth_token');
    localStorage.removeItem('focal_user');

    // Clear state
    set({ user: null, token: null, error: null });

    // Call logout endpoint (fire and forget)
    authAPI.logout().catch(() => {});
    console.log('🔐 [AUTH] Logout completed');
  },

  setUser: (user: User) => {
    set({ user });
    localStorage.setItem('focal_user', JSON.stringify(user));
  },

  clearError: () => {
    set({ error: null });
  },

  initAuth: () => {
    console.log('🔐 [AUTH] initAuth called');
    // Initialize auth from localStorage
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('focal_auth_token');
      const userStr = localStorage.getItem('focal_user');

      console.log('🔐 [AUTH] initAuth - token from localStorage:', token ? `${token.substring(0, 20)}... (${token.length} chars)` : 'NO TOKEN');
      console.log('🔐 [AUTH] initAuth - user from localStorage:', userStr);

      if (token && userStr) {
        try {
          const user = JSON.parse(userStr);
          set({ user, token, isInitialized: true });
          console.log('🔐 [AUTH] initAuth - set state with user and token');
        } catch (e) {
          console.error('🔐 [AUTH] initAuth - failed to parse user data:', e);
          // Invalid stored data, clear it
          localStorage.removeItem('focal_auth_token');
          localStorage.removeItem('focal_user');
          set({ isInitialized: true });
        }
      } else {
        console.log('🔐 [AUTH] initAuth - no token or user in localStorage');
        set({ isInitialized: true });
      }
    } else {
      set({ isInitialized: true });
    }
  },
}));
