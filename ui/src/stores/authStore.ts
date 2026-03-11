import { create } from 'zustand';

interface User {
  id: string;
  email: string;
  fullName?: string;
  role?: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  orgId: string | null;
  role: string | null;
  isAuthenticated: boolean;
  setAuth: (user: User, token: string, orgId: string, role?: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: localStorage.getItem('nox_token'),
  orgId: localStorage.getItem('nox_org_id'),
  role: localStorage.getItem('nox_role'),
  isAuthenticated: !!localStorage.getItem('nox_token'),
  setAuth: (user, token, orgId, role = 'member') => {
    localStorage.setItem('nox_token', token);
    localStorage.setItem('nox_org_id', orgId);
    localStorage.setItem('nox_role', role);
    set({ user, token, orgId, role, isAuthenticated: true });
  },
  logout: () => {
    localStorage.removeItem('nox_token');
    localStorage.removeItem('nox_org_id');
    localStorage.removeItem('nox_role');
    set({ user: null, token: null, orgId: null, role: null, isAuthenticated: false });
  },
}));
