import { create } from 'zustand';

const API_BASE = 'http://localhost:8080/v1';

export interface UserProfile {
  id: string;
  email: string;
  username: string;
  full_name: string;
  display_name: string;
  bio: string;
  avatar_url: string;
  created_at: string;
}

export interface UserPreferences {
  user_id: string;
  theme: 'dark' | 'light' | 'system';
  notification_sound: boolean;
  notification_desktop: boolean;
  notification_email: boolean;
  dnd_enabled: boolean;
  dnd_start?: string;
  dnd_end?: string;
  updated_at: string;
}

interface ProfileState {
  profile: UserProfile | null;
  preferences: UserPreferences | null;
  isLoading: boolean;
  error: string | null;
  popoverProfile: UserProfile | null;

  fetchProfile: () => Promise<void>;
  updateProfile: (data: { display_name: string; bio: string }) => Promise<void>;
  uploadAvatar: (file: File) => Promise<void>;
  fetchUserProfile: (userId: string) => Promise<UserProfile | null>;
  fetchPreferences: () => Promise<void>;
  updatePreferences: (prefs: Partial<UserPreferences>) => Promise<void>;
  setPopoverProfile: (profile: UserProfile | null) => void;
}

function getToken(): string | null {
  return localStorage.getItem('nox_token');
}

function authHeaders(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export const useProfileStore = create<ProfileState>((set, get) => ({
  profile: null,
  preferences: null,
  isLoading: false,
  error: null,
  popoverProfile: null,

  fetchProfile: async () => {
    const token = getToken();
    if (!token) return;

    set({ isLoading: true, error: null });
    try {
      const res = await fetch(`${API_BASE}/users/me`, {
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error('Failed to fetch profile');
      const data: UserProfile = await res.json();
      set({ profile: data, isLoading: false });
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false });
    }
  },

  updateProfile: async (data) => {
    const token = getToken();
    if (!token) return;

    set({ isLoading: true, error: null });
    try {
      const res = await fetch(`${API_BASE}/users/me`, {
        method: 'PATCH',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to update profile');
      }
      const profile: UserProfile = await res.json();
      set({ profile, isLoading: false });
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false });
      throw err;
    }
  },

  uploadAvatar: async (file) => {
    const token = getToken();
    if (!token) return;

    set({ isLoading: true, error: null });
    try {
      const formData = new FormData();
      formData.append('avatar', file);

      const res = await fetch(`${API_BASE}/users/me/avatar`, {
        method: 'POST',
        headers: authHeaders(),
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to upload avatar');
      }
      const data = await res.json();

      // Update profile with new avatar_url
      const current = get().profile;
      if (current) {
        set({ profile: { ...current, avatar_url: data.avatar_url }, isLoading: false });
      } else {
        set({ isLoading: false });
      }
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false });
      throw err;
    }
  },

  fetchUserProfile: async (userId) => {
    const token = getToken();
    if (!token) return null;

    try {
      const res = await fetch(`${API_BASE}/users/${userId}`, {
        headers: authHeaders(),
      });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  },

  fetchPreferences: async () => {
    const token = getToken();
    if (!token) return;

    set({ isLoading: true, error: null });
    try {
      const res = await fetch(`${API_BASE}/users/me/preferences`, {
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error('Failed to fetch preferences');
      const data: UserPreferences = await res.json();
      set({ preferences: data, isLoading: false });
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false });
    }
  },

  updatePreferences: async (prefs) => {
    const token = getToken();
    if (!token) return;

    set({ isLoading: true, error: null });
    try {
      const res = await fetch(`${API_BASE}/users/me/preferences`, {
        method: 'PATCH',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(prefs),
      });
      if (!res.ok) throw new Error('Failed to update preferences');
      const data: UserPreferences = await res.json();
      set({ preferences: data, isLoading: false });
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false });
      throw err;
    }
  },

  setPopoverProfile: (profile) => set({ popoverProfile: profile }),
}));
