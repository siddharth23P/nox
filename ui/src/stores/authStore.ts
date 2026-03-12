import { create } from 'zustand';

interface User {
  id: string;
  email: string;
  username?: string;
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

export const useAuthStore = create<AuthState>((set) => {
  let initialUser = null;
  try {
    const storedUser = localStorage.getItem('nox_user');
    if (storedUser) {
      initialUser = JSON.parse(storedUser);
    }
  } catch (e) {
    console.error('Failed to parse user from local storage', e);
  }

  return {
    user: initialUser,
    token: localStorage.getItem('nox_token'),
    orgId: localStorage.getItem('nox_org_id'),
    role: localStorage.getItem('nox_role'),
    isAuthenticated: !!localStorage.getItem('nox_token'),
    setAuth: (user, token, orgId, role = 'member') => {
      localStorage.setItem('nox_token', token);
      localStorage.setItem('nox_org_id', orgId);
      localStorage.setItem('nox_role', role);
      if (user) {
        localStorage.setItem('nox_user', JSON.stringify(user));
      }
      set({ user, token, orgId, role, isAuthenticated: true });
    },
    logout: () => {
      localStorage.removeItem('nox_token');
      localStorage.removeItem('nox_org_id');
      localStorage.removeItem('nox_role');
      localStorage.removeItem('nox_user');
      set({ user: null, token: null, orgId: null, role: null, isAuthenticated: false });
    },
  };
});
