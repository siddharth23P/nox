import { create } from 'zustand';

const API_BASE = 'http://localhost:8080/v1';

export interface OrgSettings {
  id: string;
  name: string;
  slug: string;
  description: string;
  logo_url: string;
  created_at: string;
  updated_at: string;
}

export interface OrgMember {
  user_id: string;
  username: string;
  full_name: string;
  display_name: string;
  avatar_url: string;
  email: string;
  role: string;
  joined_at: string;
}

interface OrgState {
  settings: OrgSettings | null;
  members: OrgMember[];
  totalMembers: number;
  isLoading: boolean;
  error: string | null;

  fetchSettings: (orgId: string) => Promise<void>;
  updateSettings: (orgId: string, data: { name: string; description: string }) => Promise<void>;
  uploadLogo: (orgId: string, file: File) => Promise<void>;
  fetchMembers: (orgId: string, search?: string, limit?: number, offset?: number) => Promise<void>;
  changeMemberRole: (orgId: string, userId: string, role: string) => Promise<boolean>;
  removeMember: (orgId: string, userId: string) => Promise<boolean>;
  clearError: () => void;
}

const getAuthHeaders = (): Record<string, string> => {
  const token = localStorage.getItem('nox_token');
  return token ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };
};

const getAuthHeadersRaw = (): Record<string, string> => {
  const token = localStorage.getItem('nox_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export const useOrgStore = create<OrgState>((set, get) => ({
  settings: null,
  members: [],
  totalMembers: 0,
  isLoading: false,
  error: null,

  fetchSettings: async (orgId: string) => {
    set({ isLoading: true, error: null });
    try {
      const res = await fetch(`${API_BASE}/orgs/${orgId}/settings`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error('Failed to fetch org settings');
      const data: OrgSettings = await res.json();
      set({ settings: data, isLoading: false });
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false });
    }
  },

  updateSettings: async (orgId: string, data: { name: string; description: string }) => {
    set({ isLoading: true, error: null });
    try {
      const res = await fetch(`${API_BASE}/orgs/${orgId}`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to update org settings');
      }
      const settings: OrgSettings = await res.json();
      set({ settings, isLoading: false });
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false });
      throw err;
    }
  },

  uploadLogo: async (orgId: string, file: File) => {
    set({ isLoading: true, error: null });
    try {
      const formData = new FormData();
      formData.append('logo', file);

      const res = await fetch(`${API_BASE}/orgs/${orgId}/logo`, {
        method: 'POST',
        headers: getAuthHeadersRaw(),
        body: formData,
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to upload logo');
      }
      const data = await res.json();

      const current = get().settings;
      if (current) {
        set({ settings: { ...current, logo_url: data.logo_url }, isLoading: false });
      } else {
        set({ isLoading: false });
      }
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false });
      throw err;
    }
  },

  fetchMembers: async (orgId: string, search = '', limit = 50, offset = 0) => {
    set({ isLoading: true, error: null });
    try {
      const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
      if (search) params.set('search', search);

      const res = await fetch(`${API_BASE}/orgs/${orgId}/members?${params}`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error('Failed to fetch members');
      const data = await res.json();
      set({
        members: data.members || [],
        totalMembers: data.total || 0,
        isLoading: false,
      });
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false });
    }
  },

  changeMemberRole: async (orgId: string, userId: string, role: string) => {
    set({ isLoading: true, error: null });
    try {
      const res = await fetch(`${API_BASE}/orgs/${orgId}/members/${userId}/role`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({ role }),
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to change role');
      }
      // Update the member's role in the local state
      set((state) => ({
        members: state.members.map((m) =>
          m.user_id === userId ? { ...m, role } : m
        ),
        isLoading: false,
      }));
      return true;
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false });
      return false;
    }
  },

  removeMember: async (orgId: string, userId: string) => {
    set({ isLoading: true, error: null });
    try {
      const res = await fetch(`${API_BASE}/orgs/${orgId}/members/${userId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to remove member');
      }
      set((state) => ({
        members: state.members.filter((m) => m.user_id !== userId),
        totalMembers: state.totalMembers - 1,
        isLoading: false,
      }));
      return true;
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false });
      return false;
    }
  },

  clearError: () => set({ error: null }),
}));
