import { create } from 'zustand';

const API_BASE = 'http://localhost:8080/v1';

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem('nox_token') || '';
  return { Authorization: `Bearer ${token}` };
}

export interface Notification {
  id: string;
  user_id: string;
  type: string; // mention, reply, reaction, channel_invite, system
  title: string;
  body: string;
  channel_id?: string;
  message_id?: string;
  actor_id?: string;
  actor_name?: string;
  is_read: boolean;
  created_at: string;
}

interface NotificationState {
  notifications: Notification[];
  unreadCount: number;
  isLoading: boolean;

  fetchNotifications: (limit?: number, offset?: number) => Promise<void>;
  fetchUnreadCount: () => Promise<void>;
  markRead: (notificationId: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  addNotification: (notification: Notification) => void;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  isLoading: false,

  fetchNotifications: async (limit = 30, offset = 0) => {
    set({ isLoading: true });
    try {
      const res = await fetch(`${API_BASE}/notifications?limit=${limit}&offset=${offset}`, {
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error('Failed to fetch notifications');
      const data = await res.json();
      set({
        notifications: data.notifications || [],
        unreadCount: data.unread_count || 0,
        isLoading: false,
      });
    } catch {
      set({ isLoading: false });
    }
  },

  fetchUnreadCount: async () => {
    try {
      const res = await fetch(`${API_BASE}/notifications/unread-count`, {
        headers: authHeaders(),
      });
      if (!res.ok) return;
      const data = await res.json();
      set({ unreadCount: data.unread_count || 0 });
    } catch {
      // ignore
    }
  },

  markRead: async (notificationId: string) => {
    // Optimistic update
    set((state) => ({
      notifications: state.notifications.map((n) =>
        n.id === notificationId ? { ...n, is_read: true } : n
      ),
      unreadCount: Math.max(0, state.unreadCount - 1),
    }));

    try {
      await fetch(`${API_BASE}/notifications/${notificationId}/read`, {
        method: 'PATCH',
        headers: authHeaders(),
      });
    } catch {
      // Revert on error
      get().fetchNotifications();
    }
  },

  markAllRead: async () => {
    const prev = get().notifications;
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, is_read: true })),
      unreadCount: 0,
    }));

    try {
      await fetch(`${API_BASE}/notifications/read-all`, {
        method: 'POST',
        headers: authHeaders(),
      });
    } catch {
      set({ notifications: prev });
      get().fetchNotifications();
    }
  },

  addNotification: (notification: Notification) => {
    set((state) => ({
      notifications: [notification, ...state.notifications],
      unreadCount: state.unreadCount + 1,
    }));
  },
}));
