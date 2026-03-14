import { create } from 'zustand';
import { usePresenceStore } from './presenceStore';
import { closeWebSocket } from '../hooks/useWebSocket';

const API_BASE = 'http://localhost:8080/v1';

interface User {
  id: string;
  email: string;
  username?: string;
  fullName?: string;
  role?: string;
}

interface Organization {
  id: string;
  name: string;
  slug: string;
  role: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  orgId: string | null;
  orgName: string | null;
  role: string | null;
  organizations: Organization[];
  isAuthenticated: boolean;
  setAuth: (user: User, token: string, orgId: string, role?: string) => void;
  logout: () => void;
  fetchOrganizations: () => Promise<void>;
  switchOrganization: (orgId: string) => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => {
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
    orgName: localStorage.getItem('nox_org_name'),
    role: localStorage.getItem('nox_role'),
    organizations: [],
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
      // Stop presence heartbeat and close WebSocket BEFORE clearing auth
      // state so the server is notified immediately (fixes #119).
      usePresenceStore.getState().stopHeartbeat();
      closeWebSocket();

      localStorage.removeItem('nox_token');
      localStorage.removeItem('nox_org_id');
      localStorage.removeItem('nox_org_name');
      localStorage.removeItem('nox_role');
      localStorage.removeItem('nox_user');
      set({ user: null, token: null, orgId: null, orgName: null, role: null, organizations: [], isAuthenticated: false });
    },
    fetchOrganizations: async () => {
      const token = get().token;
      if (!token) return;

      try {
        const res = await fetch(`${API_BASE}/orgs`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const data = await res.json();
        const orgs: Organization[] = data.organizations || [];
        set({ organizations: orgs });

        // Set orgName from current orgId
        const currentOrgId = get().orgId;
        const currentOrg = orgs.find(o => o.id === currentOrgId);
        if (currentOrg) {
          localStorage.setItem('nox_org_name', currentOrg.name);
          set({ orgName: currentOrg.name });
        }
      } catch (err) {
        console.error('Failed to fetch organizations', err);
      }
    },
    switchOrganization: async (orgId: string) => {
      const token = get().token;
      if (!token) return;

      try {
        const res = await fetch(`${API_BASE}/orgs/${orgId}/switch`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error('Failed to switch org');
        const data = await res.json();

        localStorage.setItem('nox_token', data.token);
        localStorage.setItem('nox_org_id', data.org_id);
        localStorage.setItem('nox_role', data.role);

        const orgs = get().organizations;
        const newOrg = orgs.find(o => o.id === orgId);
        if (newOrg) {
          localStorage.setItem('nox_org_name', newOrg.name);
        }

        set({
          token: data.token,
          orgId: data.org_id,
          role: data.role,
          orgName: newOrg?.name || null,
        });

        // Reload to refresh all data for new org context
        window.location.reload();
      } catch (err) {
        console.error('Failed to switch organization', err);
      }
    },
  };
});
