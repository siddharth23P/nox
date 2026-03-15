import React, { useState, useCallback, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { Menu } from 'lucide-react';
import { Sidebar } from './Sidebar';
import { useWebSocket } from '../../hooks/useWebSocket';

export const DashboardLayout: React.FC = () => {
  useWebSocket();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleSidebarClose = useCallback(() => {
    setSidebarOpen(false);
  }, []);

  // Close sidebar on escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && sidebarOpen) {
        setSidebarOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [sidebarOpen]);

  return (
    <div className="h-screen w-full flex overflow-hidden" style={{ backgroundColor: 'var(--nox-bg-primary)' }}>
      {/* Desktop sidebar - always visible */}
      <div className="hidden md:block">
        <Sidebar />
      </div>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
          onClick={handleSidebarClose}
        />
      )}

      {/* Mobile sidebar drawer */}
      {sidebarOpen && (
        <div
          className="fixed inset-y-0 left-0 z-50 w-full max-w-[300px] md:hidden animate-slide-in-left"
        >
          <Sidebar onClose={handleSidebarClose} />
        </div>
      )}

      <main className="flex-1 h-full overflow-hidden relative">
        {/* Mobile hamburger button */}
        <button
          onClick={() => setSidebarOpen(true)}
          className="absolute top-3 left-3 z-30 p-2 rounded-lg bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:bg-white/10 transition-colors md:hidden"
          aria-label="Open sidebar"
          data-testid="mobile-menu-btn"
        >
          <Menu size={20} />
        </button>

        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-blue-500/5 rounded-full blur-[120px] pointer-events-none" />
        <div className="relative z-10 h-full w-full">
          <Outlet />
        </div>
      </main>
    </div>
  );
};
