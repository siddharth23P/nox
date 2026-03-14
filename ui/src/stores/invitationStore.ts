import { create } from 'zustand';

const API_BASE = 'http://localhost:8080/v1';

export interface Invitation {
  id: string;
  org_id: string;
  inviter_id: string;
  email: string;
  role: string;
  token: string;
  max_uses: number | null;
  use_count: number;
  expires_at: string | null;
  created_at: string;
}

export interface InviteLink {
  id: string;
  org_id: string;
  creator_id: string;
  code: string;
  role: string;
  max_uses: number | null;
  use_count: number;
  expires_at: string | null;
  active: boolean;
  created_at: string;
}

export interface InviteLinkInfo {
  code: string;
  org_name: string;
  role: string;
}

interface InvitationState {
  invitations: Invitation[];
  inviteLinks: InviteLink[];
  isLoading: boolean;
  error: string | null;

  fetchInvitations: (orgId: string) => Promise<void>;
  createInvitation: (orgId: string, email: string, role: string, maxUses?: number, expiresInHours?: number) => Promise<Invitation | null>;
  createInviteLink: (orgId: string, role: string, maxUses?: number, expiresInHours?: number) => Promise<InviteLink | null>;
  revokeInvitation: (orgId: string, inviteId: string) => Promise<void>;
  revokeInviteLink: (orgId: string, linkId: string) => Promise<void>;
  acceptInvitation: (token: string) => Promise<{ org_id: string; role: string } | null>;
  joinViaLink: (code: string) => Promise<{ org_id: string; role: string } | null>;
  getInviteLinkInfo: (code: string) => Promise<InviteLinkInfo | null>;
}

const getHeaders = () => {
  const token = localStorage.getItem('nox_token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

export const useInvitationStore = create<InvitationState>((set) => ({
  invitations: [],
  inviteLinks: [],
  isLoading: false,
  error: null,

  fetchInvitations: async (orgId: string) => {
    set({ isLoading: true, error: null });
    try {
      const res = await fetch(`${API_BASE}/orgs/${orgId}/invitations`, {
        headers: getHeaders(),
      });
      if (!res.ok) throw new Error('Failed to fetch invitations');
      const data = await res.json();
      set({
        invitations: data.invitations || [],
        inviteLinks: data.invite_links || [],
        isLoading: false,
      });
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false });
    }
  },

  createInvitation: async (orgId, email, role, maxUses, expiresInHours) => {
    set({ isLoading: true, error: null });
    try {
      const body: Record<string, unknown> = { email, role };
      if (maxUses !== undefined) body.max_uses = maxUses;
      if (expiresInHours !== undefined) body.expires_in_hours = expiresInHours;

      const res = await fetch(`${API_BASE}/orgs/${orgId}/invitations`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create invitation');
      }
      const data = await res.json();
      set((state) => ({
        invitations: [data.invitation, ...state.invitations],
        isLoading: false,
      }));
      return data.invitation;
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false });
      return null;
    }
  },

  createInviteLink: async (orgId, role, maxUses, expiresInHours) => {
    set({ isLoading: true, error: null });
    try {
      const body: Record<string, unknown> = { role };
      if (maxUses !== undefined) body.max_uses = maxUses;
      if (expiresInHours !== undefined) body.expires_in_hours = expiresInHours;

      const res = await fetch(`${API_BASE}/orgs/${orgId}/invite-links`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create invite link');
      }
      const data = await res.json();
      set((state) => ({
        inviteLinks: [data.invite_link, ...state.inviteLinks],
        isLoading: false,
      }));
      return data.invite_link;
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false });
      return null;
    }
  },

  revokeInvitation: async (orgId, inviteId) => {
    try {
      const res = await fetch(`${API_BASE}/orgs/${orgId}/invitations/${inviteId}`, {
        method: 'DELETE',
        headers: getHeaders(),
      });
      if (!res.ok) throw new Error('Failed to revoke invitation');
      set((state) => ({
        invitations: state.invitations.filter((i) => i.id !== inviteId),
      }));
    } catch (err) {
      set({ error: (err as Error).message });
    }
  },

  revokeInviteLink: async (orgId, linkId) => {
    try {
      const res = await fetch(`${API_BASE}/orgs/${orgId}/invite-links/${linkId}`, {
        method: 'DELETE',
        headers: getHeaders(),
      });
      if (!res.ok) throw new Error('Failed to revoke invite link');
      set((state) => ({
        inviteLinks: state.inviteLinks.map((l) =>
          l.id === linkId ? { ...l, active: false } : l
        ),
      }));
    } catch (err) {
      set({ error: (err as Error).message });
    }
  },

  acceptInvitation: async (token) => {
    set({ isLoading: true, error: null });
    try {
      const res = await fetch(`${API_BASE}/invitations/${token}/accept`, {
        method: 'POST',
        headers: getHeaders(),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to accept invitation');
      }
      const data = await res.json();
      set({ isLoading: false });
      return { org_id: data.org_id, role: data.role };
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false });
      return null;
    }
  },

  joinViaLink: async (code) => {
    set({ isLoading: true, error: null });
    try {
      const res = await fetch(`${API_BASE}/join/${code}`, {
        method: 'POST',
        headers: getHeaders(),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to join organization');
      }
      const data = await res.json();
      set({ isLoading: false });
      return { org_id: data.org_id, role: data.role };
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false });
      return null;
    }
  },

  getInviteLinkInfo: async (code) => {
    try {
      const res = await fetch(`${API_BASE}/join/${code}`);
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  },
}));
