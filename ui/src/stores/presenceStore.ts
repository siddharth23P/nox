import { create } from 'zustand';

interface PresenceState {
  onlineUsers: string[];
  isStealth: boolean;
  stealthError: string | null;
  heartbeatInterval: ReturnType<typeof setInterval> | null;

  // Actions
  setStealth: (stealth: boolean) => void;
  clearStealthError: () => void;
  startHeartbeat: (userId: string, token: string) => void;
  stopHeartbeat: () => void;
}

export const usePresenceStore = create<PresenceState>((set, get) => ({
  onlineUsers: [],
  isStealth: false,
  stealthError: null,
  heartbeatInterval: null,

  setStealth: (stealth: boolean) => {
    const previousStealth = get().isStealth;
    // Optimistic update: flip UI state immediately
    set({ isStealth: stealth, stealthError: null });

    // Persist the new status in the background
    const { heartbeatInterval } = get();
    if (heartbeatInterval) {
      const userId = localStorage.getItem('nox_user')
        ? JSON.parse(localStorage.getItem('nox_user')!).id
        : null;
      const token = localStorage.getItem('nox_token');
      if (userId && token) {
        fetch('http://localhost:8080/v1/presence/heartbeat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-User-ID': userId,
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({ status: stealth ? 'stealth' : 'online' }),
        }).then(res => {
          if (!res.ok) {
            // Revert on server error
            set({ isStealth: previousStealth, stealthError: 'Failed to update stealth mode. Please try again.' });
          }
        }).catch(() => {
          // Revert on network error
          set({ isStealth: previousStealth, stealthError: 'Network error. Stealth mode change reverted.' });
        });
      }
    }
  },

  clearStealthError: () => set({ stealthError: null }),

  startHeartbeat: (userId: string, token: string) => {
    const { heartbeatInterval } = get();
    if (heartbeatInterval) return; // Already running

    const tick = async () => {
      try {
        // 1. Send our heartbeat
        await fetch('http://localhost:8080/v1/presence/heartbeat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-User-ID': userId,
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({ status: get().isStealth ? 'stealth' : 'online' }),
        });

        // 2. Fetch active users
        const res = await fetch('http://localhost:8080/v1/presence/active', {
          headers: {
            'Authorization': `Bearer ${token}`,
          }
        });
        
        if (res.ok) {
          const active = await res.json();
          set({ onlineUsers: active });
        }
      } catch (error) {
        console.error('Presence engine tick failed:', error);
      }
    };

    // Run immediately, then poll. Use a faster interval for E2E tests.
    const interval = (window as unknown as { IS_PLAYWRIGHT?: boolean }).IS_PLAYWRIGHT ? 3000 : 15000;
    tick();
    const intervalId = setInterval(tick, interval);
    set({ heartbeatInterval: intervalId });
  },

  stopHeartbeat: () => {
    const { heartbeatInterval } = get();
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
      set({ heartbeatInterval: null, onlineUsers: [] });
    }
  },
}));
