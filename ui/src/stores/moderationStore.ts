import { create } from 'zustand';

const API_BASE = 'http://localhost:8080/v1';

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem('nox_token') || '';
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

export interface ModerationAction {
  id: string;
  org_id: string;
  target_user_id: string;
  moderator_id: string;
  action_type: 'timeout' | 'channel_mute' | 'server_mute' | 'warn' | 'ban';
  reason: string;
  channel_id?: string;
  expires_at?: string;
  revoked_at?: string;
  revoked_by?: string;
  created_at: string;
  target_username?: string;
  moderator_username?: string;
}

interface ModerationState {
  actions: ModerationAction[];
  userStatus: ModerationAction[];
  isLoading: boolean;

  timeoutUser: (userId: string, duration: string, reason: string, channelId?: string) => Promise<ModerationAction | null>;
  muteUser: (userId: string, reason: string, channelId?: string) => Promise<ModerationAction | null>;
  warnUser: (userId: string, reason: string) => Promise<ModerationAction | null>;
  banUser: (userId: string, reason: string) => Promise<ModerationAction | null>;
  revokeAction: (actionId: string) => Promise<boolean>;
  fetchActions: (limit?: number, offset?: number) => Promise<void>;
  fetchUserStatus: (userId: string) => Promise<void>;
}

export const useModerationStore = create<ModerationState>((set) => ({
  actions: [],
  userStatus: [],
  isLoading: false,

  timeoutUser: async (userId, duration, reason, channelId) => {
    try {
      const body: Record<string, string> = { user_id: userId, duration, reason };
      if (channelId) body.channel_id = channelId;
      const res = await fetch(`${API_BASE}/moderation/timeout`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(await res.text());
      return (await res.json()) as ModerationAction;
    } catch {
      return null;
    }
  },

  muteUser: async (userId, reason, channelId) => {
    try {
      const body: Record<string, string> = { user_id: userId, reason };
      if (channelId) body.channel_id = channelId;
      const res = await fetch(`${API_BASE}/moderation/mute`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(await res.text());
      return (await res.json()) as ModerationAction;
    } catch {
      return null;
    }
  },

  warnUser: async (userId, reason) => {
    try {
      const res = await fetch(`${API_BASE}/moderation/warn`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ user_id: userId, reason }),
      });
      if (!res.ok) throw new Error(await res.text());
      return (await res.json()) as ModerationAction;
    } catch {
      return null;
    }
  },

  banUser: async (userId, reason) => {
    try {
      const res = await fetch(`${API_BASE}/moderation/ban`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ user_id: userId, reason }),
      });
      if (!res.ok) throw new Error(await res.text());
      return (await res.json()) as ModerationAction;
    } catch {
      return null;
    }
  },

  revokeAction: async (actionId) => {
    try {
      const res = await fetch(`${API_BASE}/moderation/actions/${actionId}/revoke`, {
        method: 'POST',
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error(await res.text());
      // Remove from local state
      set((state) => ({
        actions: state.actions.map((a) =>
          a.id === actionId ? { ...a, revoked_at: new Date().toISOString() } : a
        ),
        userStatus: state.userStatus.filter((a) => a.id !== actionId),
      }));
      return true;
    } catch {
      return false;
    }
  },

  fetchActions: async (limit = 50, offset = 0) => {
    set({ isLoading: true });
    try {
      const res = await fetch(`${API_BASE}/moderation/actions?limit=${limit}&offset=${offset}`, {
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error('Failed to fetch moderation actions');
      const data = await res.json();
      set({ actions: data.actions || [], isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },

  fetchUserStatus: async (userId) => {
    set({ isLoading: true });
    try {
      const res = await fetch(`${API_BASE}/moderation/users/${userId}/status`, {
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error('Failed to fetch user status');
      const data = await res.json();
      set({ userStatus: data.actions || [], isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },
}));
