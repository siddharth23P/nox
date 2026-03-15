import { create } from 'zustand';

export type ThemeMode = 'dark' | 'light' | 'system';

interface ThemeStore {
  mode: ThemeMode;
  resolved: 'dark' | 'light';
  setMode: (mode: ThemeMode) => void;
}

function getSystemTheme(): 'dark' | 'light' {
  if (typeof window === 'undefined') return 'dark';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function resolveTheme(mode: ThemeMode): 'dark' | 'light' {
  if (mode === 'system') return getSystemTheme();
  return mode;
}

function applyTheme(resolved: 'dark' | 'light') {
  if (resolved === 'dark') {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
}

// Read persisted mode from localStorage
function getPersistedMode(): ThemeMode {
  if (typeof window === 'undefined') return 'system';
  const stored = localStorage.getItem('nox-theme');
  if (stored === 'dark' || stored === 'light' || stored === 'system') {
    return stored;
  }
  return 'system';
}

const initialMode = getPersistedMode();
const initialResolved = resolveTheme(initialMode);

// Apply theme immediately on store creation to avoid flash
applyTheme(initialResolved);

export const useThemeStore = create<ThemeStore>((set, get) => {
  // Listen for system preference changes
  if (typeof window !== 'undefined') {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery.addEventListener('change', () => {
      const { mode } = get();
      if (mode === 'system') {
        const newResolved = getSystemTheme();
        applyTheme(newResolved);
        set({ resolved: newResolved });
      }
    });
  }

  return {
    mode: initialMode,
    resolved: initialResolved,

    setMode: (mode: ThemeMode) => {
      const resolved = resolveTheme(mode);
      localStorage.setItem('nox-theme', mode);
      applyTheme(resolved);
      set({ mode, resolved });
    },
  };
});
