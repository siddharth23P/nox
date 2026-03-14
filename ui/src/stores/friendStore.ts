import { create } from 'zustand';

const API_BASE = 'http://localhost:8080/v1';

export interface FriendUser {
  friendship_id: string;
  user_id: string;
  username: string;
  full_name: string;
  avatar_url: string;
  status: string;
  direction: string; // "sent" or "received" for pending
}

export interface MutualOrg {
  org_id: string;
  org_name: string;
}

export interface SearchUser {
  user_id: string;
  username: string;
  full_name: string;
  avatar_url: string;
}

type FriendTab = 'all' | 'online' | 'pending' | 'blocked';

interface FriendState {
  friends: FriendUser[];
  searchResults: SearchUser[];
  mutualOrgs: MutualOrg[];
  activeTab: FriendTab;
  isLoading: boolean;
  error: string | null;

  setActiveTab: (tab: FriendTab) => void;
  fetchFriends: (status?: string) => Promise<void>;
  sendFriendRequest: (addresseeId: string) => Promise<boolean>;
  acceptFriendRequest: (friendshipId: string) => Promise<void>;
  declineFriendRequest: (friendshipId: string) => Promise<void>;
  removeFriend: (friendshipId: string) => Promise<void>;
  blockUser: (userId: string) => Promise<void>;
  unblockUser: (userId: string) => Promise<void>;
  searchUsers: (query: string) => Promise<void>;
  fetchMutualOrgs: (userId: string) => Promise<void>;
  clearSearch: () => void;
}

const getHeaders = () => {
  const token = localStorage.getItem('nox_token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

export const useFriendStore = create<FriendState>((set, get) => ({
  friends: [],
  searchResults: [],
  mutualOrgs: [],
  activeTab: 'all',
  isLoading: false,
  error: null,

  setActiveTab: (tab: FriendTab) => {
    set({ activeTab: tab });
    const statusMap: Record<FriendTab, string> = {
      all: 'all',
      online: 'accepted',
      pending: 'pending',
      blocked: 'blocked',
    };
    get().fetchFriends(statusMap[tab]);
  },

  fetchFriends: async (status = 'all') => {
    set({ isLoading: true, error: null });
    try {
      const res = await fetch(`${API_BASE}/friends?status=${status}`, {
        headers: getHeaders(),
      });
      if (!res.ok) throw new Error('Failed to fetch friends');
      const data = await res.json();
      set({ friends: data.friends || [], isLoading: false });
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false });
    }
  },

  sendFriendRequest: async (addresseeId: string) => {
    set({ isLoading: true, error: null });
    try {
      const res = await fetch(`${API_BASE}/friends/request`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ addressee_id: addresseeId }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to send friend request');
      }
      set({ isLoading: false });
      return true;
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false });
      return false;
    }
  },

  acceptFriendRequest: async (friendshipId: string) => {
    try {
      const res = await fetch(`${API_BASE}/friends/${friendshipId}/accept`, {
        method: 'POST',
        headers: getHeaders(),
      });
      if (!res.ok) throw new Error('Failed to accept friend request');
      set((state) => ({
        friends: state.friends.map((f) =>
          f.friendship_id === friendshipId ? { ...f, status: 'accepted', direction: '' } : f
        ),
      }));
    } catch (err) {
      set({ error: (err as Error).message });
    }
  },

  declineFriendRequest: async (friendshipId: string) => {
    try {
      const res = await fetch(`${API_BASE}/friends/${friendshipId}/decline`, {
        method: 'POST',
        headers: getHeaders(),
      });
      if (!res.ok) throw new Error('Failed to decline friend request');
      set((state) => ({
        friends: state.friends.filter((f) => f.friendship_id !== friendshipId),
      }));
    } catch (err) {
      set({ error: (err as Error).message });
    }
  },

  removeFriend: async (friendshipId: string) => {
    try {
      const res = await fetch(`${API_BASE}/friends/${friendshipId}`, {
        method: 'DELETE',
        headers: getHeaders(),
      });
      if (!res.ok) throw new Error('Failed to remove friend');
      set((state) => ({
        friends: state.friends.filter((f) => f.friendship_id !== friendshipId),
      }));
    } catch (err) {
      set({ error: (err as Error).message });
    }
  },

  blockUser: async (userId: string) => {
    try {
      const res = await fetch(`${API_BASE}/users/${userId}/block`, {
        method: 'POST',
        headers: getHeaders(),
      });
      if (!res.ok) throw new Error('Failed to block user');
      // Refresh the current list
      const tab = get().activeTab;
      const statusMap: Record<FriendTab, string> = {
        all: 'all',
        online: 'accepted',
        pending: 'pending',
        blocked: 'blocked',
      };
      get().fetchFriends(statusMap[tab]);
    } catch (err) {
      set({ error: (err as Error).message });
    }
  },

  unblockUser: async (userId: string) => {
    try {
      const res = await fetch(`${API_BASE}/users/${userId}/block`, {
        method: 'DELETE',
        headers: getHeaders(),
      });
      if (!res.ok) throw new Error('Failed to unblock user');
      set((state) => ({
        friends: state.friends.filter((f) => f.user_id !== userId),
      }));
    } catch (err) {
      set({ error: (err as Error).message });
    }
  },

  searchUsers: async (query: string) => {
    if (!query || query.length < 1) {
      set({ searchResults: [] });
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/users/search?q=${encodeURIComponent(query)}`, {
        headers: getHeaders(),
      });
      if (!res.ok) throw new Error('Failed to search users');
      const data = await res.json();
      set({ searchResults: data.users || [] });
    } catch (err) {
      set({ error: (err as Error).message });
    }
  },

  fetchMutualOrgs: async (userId: string) => {
    try {
      const res = await fetch(`${API_BASE}/friends/mutual/${userId}`, {
        headers: getHeaders(),
      });
      if (!res.ok) throw new Error('Failed to fetch mutual orgs');
      const data = await res.json();
      set({ mutualOrgs: data.mutual_orgs || [] });
    } catch (err) {
      set({ error: (err as Error).message });
    }
  },

  clearSearch: () => set({ searchResults: [] }),
}));
