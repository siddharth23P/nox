import { create } from 'zustand';

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem('nox_token') || '';
  return { Authorization: `Bearer ${token}` };
}

const API_BASE = 'http://localhost:8080/v1';

interface UnreadCountEntry {
  channel_id: string;
  count: number;
}

interface ReadState {
  unreadCounts: Record<string, number>;
  lastReadTimestamps: Record<string, string>;
  fetchUnreadCounts: () => Promise<void>;
  markChannelRead: (channelId: string, messageId: string) => void;
  setUnread: (channelId: string, count: number) => void;
  decrementUnread: (channelId: string) => void;
  onReadReceiptUpdated: (data: { channel_id: string; user_id: string; last_read_message_id: string }) => void;
}

// Debounce timers keyed by channelId
const debounceTimers: Record<string, ReturnType<typeof setTimeout>> = {};

export const useReadStore = create<ReadState>((set, get) => ({
  unreadCounts: {},
  lastReadTimestamps: {},

  fetchUnreadCounts: async () => {
    try {
      const res = await fetch(`${API_BASE}/channels/unread-counts`, {
        headers: authHeaders(),
      });
      if (res.ok) {
        const data: UnreadCountEntry[] = await res.json();
        const counts: Record<string, number> = {};
        for (const entry of data) {
          counts[entry.channel_id] = entry.count;
        }
        set({ unreadCounts: counts });
      }
    } catch {
      // ignore fetch errors
    }
  },

  markChannelRead: (channelId: string, messageId: string) => {
    // Optimistic update: set unread to 0 immediately
    set((state) => ({
      unreadCounts: { ...state.unreadCounts, [channelId]: 0 },
    }));

    // Debounce the actual API call by 2 seconds
    if (debounceTimers[channelId]) {
      clearTimeout(debounceTimers[channelId]);
    }

    debounceTimers[channelId] = setTimeout(async () => {
      try {
        await fetch(`${API_BASE}/channels/${channelId}/read`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', ...authHeaders() },
          body: JSON.stringify({ message_id: messageId }),
        });
      } catch {
        // If the API call fails, refetch to get accurate counts
        get().fetchUnreadCounts();
      }
    }, 2000);
  },

  setUnread: (channelId: string, count: number) => {
    set((state) => ({
      unreadCounts: { ...state.unreadCounts, [channelId]: count },
    }));
  },

  decrementUnread: (channelId: string) => {
    set((state) => {
      const current = state.unreadCounts[channelId] || 0;
      return {
        unreadCounts: {
          ...state.unreadCounts,
          [channelId]: Math.max(0, current - 1),
        },
      };
    });
  },

  onReadReceiptUpdated: (data: { channel_id: string; user_id: string; last_read_message_id: string }) => {
    // When we receive a read receipt update for the current user,
    // set that channel's unread count to 0
    const currentUser = JSON.parse(localStorage.getItem('nox_user') || '{}');
    if (data.user_id === currentUser.id) {
      set((state) => ({
        unreadCounts: { ...state.unreadCounts, [data.channel_id]: 0 },
      }));
    }
  },
}));
