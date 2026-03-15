import React, { useState, useMemo, useCallback } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { useWebSocket } from '../../hooks/useWebSocket';
import { useKeyboardShortcuts, type Shortcut } from '../../hooks/useKeyboardShortcuts';
import { ShortcutsModal } from '../common/ShortcutsModal';
import { useMessageStore } from '../../stores/messageStore';

export const DashboardLayout: React.FC = () => {
  useWebSocket();
  const navigate = useNavigate();
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const { channels, activeChannel, setActiveChannel, fetchMessages } = useMessageStore();

  const navigateChannel = useCallback((direction: -1 | 1) => {
    if (channels.length === 0) return;
    const currentIdx = channels.findIndex(c => c.id === activeChannel?.id);
    const nextIdx = currentIdx === -1
      ? 0
      : (currentIdx + direction + channels.length) % channels.length;
    const next = channels[nextIdx];
    setActiveChannel(next);
    fetchMessages(next.id);
    navigate('/dashboard');
  }, [channels, activeChannel, setActiveChannel, fetchMessages, navigate]);

  const shortcuts: Shortcut[] = useMemo(() => [
    {
      key: '?',
      description: 'Show keyboard shortcuts',
      category: 'General',
      action: () => setShowShortcuts(prev => !prev),
    },
    {
      key: 'k',
      meta: true,
      description: 'Quick search',
      category: 'Navigation',
      action: () => {
        // Focus search input if it exists
        const searchInput = document.querySelector('[data-testid="search-input"]') as HTMLInputElement;
        if (searchInput) searchInput.focus();
      },
    },
    {
      key: '\\',
      meta: true,
      shift: true,
      description: 'Toggle sidebar',
      category: 'Navigation',
      action: () => setSidebarVisible(prev => !prev),
    },
    {
      key: 'ArrowUp',
      alt: true,
      description: 'Previous channel',
      category: 'Navigation',
      action: () => navigateChannel(-1),
    },
    {
      key: 'ArrowDown',
      alt: true,
      description: 'Next channel',
      category: 'Navigation',
      action: () => navigateChannel(1),
    },
    {
      key: 'Escape',
      description: 'Close panel / cancel',
      category: 'General',
      action: () => {
        const { setActiveThread } = useMessageStore.getState();
        setActiveThread(null);
      },
    },
  ], [navigateChannel]);

  useKeyboardShortcuts(shortcuts);

  return (
    <div className="h-screen w-full flex overflow-hidden" style={{ backgroundColor: 'var(--nox-bg-primary)' }}>
      {/* Skip to content link for keyboard/screen reader users */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-[200] focus:top-2 focus:left-2 focus:px-4 focus:py-2 focus:bg-blue-600 focus:text-white focus:rounded-lg focus:text-sm"
      >
        Skip to content
      </a>
      {sidebarVisible && <Sidebar />}
      <main id="main-content" className="flex-1 h-full overflow-hidden relative" role="main" aria-label="Main content">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-blue-500/5 rounded-full blur-[120px] pointer-events-none" />
        <div className="relative z-10 h-full w-full">
          <Outlet />
        </div>
      </main>
      <ShortcutsModal isOpen={showShortcuts} onClose={() => setShowShortcuts(false)} />
    </div>
  );
};
