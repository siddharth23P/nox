import { create } from 'zustand';

interface PresenceState {
  onlineUsers: string[];
  isStealth: boolean;
  heartbeatInterval: ReturnType<typeof setInterval> | null;
  
  // Actions
  setStealth: (stealth: boolean) => void;
  startHeartbeat: (userId: string, token: string) => void;
  stopHeartbeat: () => void;
}

export const usePresenceStore = create<PresenceState>((set, get) => ({
  onlineUsers: [],
  isStealth: false,
  heartbeatInterval: null,

  setStealth: (stealth: boolean) => {
    set({ isStealth: stealth });
    // Trigger an immediate heartbeat with the new status if it's already running
    const { heartbeatInterval } = get();
    if (heartbeatInterval) {
      // Best-effort push of the new status
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
        }).catch(console.error);
      }
    }
  },

  startHeartbeat: (userId: string, token: string) => {
    const { heartbeatInterval, isStealth } = get();
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

    // Run immediately, then every 15s
    tick();
    const intervalId = setInterval(tick, 15000);
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
