import { create } from 'zustand';

interface User {
  id: string;
  email: string;
  fullName?: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  orgId: string | null;
  isAuthenticated: boolean;
  setAuth: (user: User, token: string, orgId: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: localStorage.getItem('nox_token'),
  orgId: localStorage.getItem('nox_org_id'),
  isAuthenticated: !!localStorage.getItem('nox_token'),
  setAuth: (user, token, orgId) => {
    localStorage.setItem('nox_token', token);
    localStorage.setItem('nox_org_id', orgId);
    set({ user, token, orgId, isAuthenticated: true });
  },
  logout: () => {
    localStorage.removeItem('nox_token');
    localStorage.removeItem('nox_org_id');
    set({ user: null, token: null, orgId: null, isAuthenticated: false });
  },
}));
