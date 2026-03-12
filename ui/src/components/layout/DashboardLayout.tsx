import React from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { useWebSocket } from '../../hooks/useWebSocket';

export const DashboardLayout: React.FC = () => {
  useWebSocket();

  return (
    <div className="h-screen w-full bg-[#030712] flex overflow-hidden">
      <Sidebar />
      <main className="flex-1 h-full overflow-hidden relative">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-blue-500/5 rounded-full blur-[120px] pointer-events-none" />
        <div className="relative z-10 h-full w-full">
          <Outlet />
        </div>
      </main>
    </div>
  );
};
