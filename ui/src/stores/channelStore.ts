import { create } from 'zustand';

export interface Channel {
  id: string;
  org_id: string;
  name: string;
  description?: string;
  topic?: string;
  is_private: boolean;
  created_by?: string;
  archived_at?: string;
  created_at: string;
  updated_at: string;
}

export interface ChannelMember {
  channel_id: string;
  user_id: string;
  username?: string;
  added_at: string;
  added_by?: string;
}

interface CreateChannelPayload {
  name: string;
  description?: string;
  topic?: string;
  is_private: boolean;
}

interface UpdateChannelPayload {
  name?: string;
  description?: string;
  topic?: string;
}

interface ChannelState {
  channels: Channel[];
  isLoading: boolean;
  error: string | null;
  members: ChannelMember[];
  membersLoading: boolean;

  fetchChannels: (includeArchived?: boolean) => Promise<void>;
  createChannel: (payload: CreateChannelPayload) => Promise<Channel>;
  updateChannel: (channelId: string, payload: UpdateChannelPayload) => Promise<Channel>;
  archiveChannel: (channelId: string) => Promise<Channel>;
  unarchiveChannel: (channelId: string) => Promise<Channel>;
  deleteChannel: (channelId: string) => Promise<void>;
  getChannel: (channelId: string) => Promise<Channel>;
  fetchMembers: (channelId: string) => Promise<void>;
  addMember: (channelId: string, userId: string) => Promise<void>;
  removeMember: (channelId: string, userId: string) => Promise<void>;
}

const API_BASE_URL = 'http://localhost:8080/v1';

function getHeaders(): Record<string, string> {
  const orgId = localStorage.getItem('nox_org_id') || '';
  const userStr = localStorage.getItem('nox_user');
  const userId = userStr ? JSON.parse(userStr).id : '';
  return {
    'Content-Type': 'application/json',
    'X-Org-ID': orgId,
    'X-User-ID': userId,
  };
}

export const useChannelStore = create<ChannelState>((set) => ({
  channels: [],
  isLoading: false,
  error: null,
  members: [],
  membersLoading: false,

  fetchChannels: async (includeArchived = false) => {
    set({ isLoading: true, error: null });
    try {
      const qs = includeArchived ? '?include_archived=true' : '';
      const response = await fetch(`${API_BASE_URL}/channels${qs}`, {
        headers: getHeaders(),
      });
      if (!response.ok) throw new Error('Failed to fetch channels');
      const data = await response.json();
      set({ channels: data, isLoading: false });
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false });
    }
  },

  createChannel: async (payload) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch(`${API_BASE_URL}/channels`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to create channel');
      }
      const channel = await response.json();
      set((state) => ({ channels: [...state.channels, channel], isLoading: false }));
      return channel;
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false });
      throw err;
    }
  },

  updateChannel: async (channelId, payload) => {
    set({ error: null });
    try {
      const response = await fetch(`${API_BASE_URL}/channels/${channelId}`, {
        method: 'PATCH',
        headers: getHeaders(),
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to update channel');
      }
      const updated = await response.json();
      set((state) => ({
        channels: state.channels.map((ch) => (ch.id === channelId ? updated : ch)),
      }));
      return updated;
    } catch (err) {
      set({ error: (err as Error).message });
      throw err;
    }
  },

  archiveChannel: async (channelId) => {
    set({ error: null });
    try {
      const response = await fetch(`${API_BASE_URL}/channels/${channelId}/archive`, {
        method: 'POST',
        headers: getHeaders(),
      });
      if (!response.ok) throw new Error('Failed to archive channel');
      const updated = await response.json();
      set((state) => ({
        channels: state.channels.map((ch) => (ch.id === channelId ? updated : ch)),
      }));
      return updated;
    } catch (err) {
      set({ error: (err as Error).message });
      throw err;
    }
  },

  unarchiveChannel: async (channelId) => {
    set({ error: null });
    try {
      const response = await fetch(`${API_BASE_URL}/channels/${channelId}/unarchive`, {
        method: 'POST',
        headers: getHeaders(),
      });
      if (!response.ok) throw new Error('Failed to unarchive channel');
      const updated = await response.json();
      set((state) => ({
        channels: state.channels.map((ch) => (ch.id === channelId ? updated : ch)),
      }));
      return updated;
    } catch (err) {
      set({ error: (err as Error).message });
      throw err;
    }
  },

  deleteChannel: async (channelId) => {
    set({ error: null });
    try {
      const response = await fetch(`${API_BASE_URL}/channels/${channelId}`, {
        method: 'DELETE',
        headers: getHeaders(),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to delete channel');
      }
      set((state) => ({
        channels: state.channels.filter((ch) => ch.id !== channelId),
      }));
    } catch (err) {
      set({ error: (err as Error).message });
      throw err;
    }
  },

  getChannel: async (channelId) => {
    const response = await fetch(`${API_BASE_URL}/channels/${channelId}`, {
      headers: getHeaders(),
    });
    if (!response.ok) throw new Error('Failed to get channel');
    return response.json();
  },

  fetchMembers: async (channelId) => {
    set({ membersLoading: true });
    try {
      const response = await fetch(`${API_BASE_URL}/channels/${channelId}/members`, {
        headers: getHeaders(),
      });
      if (!response.ok) throw new Error('Failed to fetch members');
      const data = await response.json();
      set({ members: data, membersLoading: false });
    } catch (err) {
      set({ error: (err as Error).message, membersLoading: false });
    }
  },

  addMember: async (channelId, userId) => {
    try {
      const response = await fetch(`${API_BASE_URL}/channels/${channelId}/members`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ user_id: userId }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to add member');
      }
      const member = await response.json();
      set((state) => ({ members: [...state.members, member] }));
    } catch (err) {
      set({ error: (err as Error).message });
      throw err;
    }
  },

  removeMember: async (channelId, userId) => {
    try {
      const response = await fetch(`${API_BASE_URL}/channels/${channelId}/members/${userId}`, {
        method: 'DELETE',
        headers: getHeaders(),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to remove member');
      }
      set((state) => ({
        members: state.members.filter((m) => m.user_id !== userId),
      }));
    } catch (err) {
      set({ error: (err as Error).message });
      throw err;
    }
  },
}));
