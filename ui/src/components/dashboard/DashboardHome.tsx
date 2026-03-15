import React, { useState } from 'react';
import { Hash, Lock, Pin, Users } from 'lucide-react';
import { MessageList } from './MessageList';
import { MessageInput } from './MessageInput';
import { ThreadPanel } from './ThreadPanel';
import { PinManager } from './PinManager';
import ChannelMembers from './ChannelMembers';
import { useMessageStore } from '../../stores/messageStore';
import { useAuthStore } from '../../stores/authStore';
import { usePresenceStore } from '../../stores/presenceStore';

export const DashboardHome: React.FC = () => {
  const { activeChannel, setActiveChannel, channels, activeThreadId } = useMessageStore();
  const { user, token } = useAuthStore();
  const { startHeartbeat, stopHeartbeat } = usePresenceStore();

  const [isPinManagerOpen, setIsPinManagerOpen] = useState(false);
  const [isMembersOpen, setIsMembersOpen] = useState(false);

  const activeChannelId = activeChannel?.id || "";
  const activeChannelName = activeChannel?.name || "Loading...";

  React.useEffect(() => {
    if (user && token) {
      startHeartbeat(user.id, token);
    }
    return () => stopHeartbeat();
  }, [user, token, startHeartbeat, stopHeartbeat]);

  // Auto-select first channel if none is active
  React.useEffect(() => {
    if (!activeChannel && channels.length > 0) {
      setActiveChannel(channels[0]);
    }
  }, [activeChannel, channels, setActiveChannel]);

  return (
    <div className="w-full h-full flex flex-row border-l border-white/5 relative bg-[#010309] overflow-hidden">

      {/* Dynamic Background Glow */}
      <div className="absolute top-0 right-1/4 w-[600px] h-[600px] bg-blue-500/5 rounded-full blur-[150px] pointer-events-none" />

      {/* Main Channel Area - shrinks smoothly when thread panel opens */}
      <div className="flex-1 h-full flex flex-col relative min-w-0 min-h-0 transition-all duration-300 ease-in-out">
        {/* Header */}
        <div className="h-14 border-b border-white/5 flex items-center px-3 md:px-6 bg-[#030712]/50 backdrop-blur-md z-10 shrink-0">
          {/* Spacer for mobile hamburger button */}
          <div className="w-10 md:hidden" />
          <div className="flex items-center gap-2 min-w-0">
            {activeChannel?.is_private ? (
              <Lock size={20} className="text-yellow-500 shrink-0" />
            ) : (
              <Hash size={20} className="text-gray-500 shrink-0" />
            )}
            <h2 className="text-white font-semibold flex items-center gap-2 min-w-0">
              <span className="truncate">{activeChannelName}</span>
              <span className="text-xs font-normal text-gray-500 bg-white/5 px-2 py-0.5 rounded-full hidden sm:inline-block whitespace-nowrap">
                {activeChannel?.is_private ? 'Private channel' : 'Team discussion'}
              </span>
            </h2>
          </div>
          <div className="ml-auto flex items-center gap-2 md:gap-4 shrink-0">
            {activeChannel?.is_private && (
              <button
                onClick={() => setIsMembersOpen(true)}
                className={`p-1.5 md:pl-2 md:pr-3 rounded-lg flex items-center gap-2 transition-colors border ${isMembersOpen ? 'bg-white/10 border-white/20 text-white' : 'bg-[#2a2a2a] border-white/5 text-gray-400 hover:text-white hover:bg-[#333]'}`}
                data-testid="channel-members-btn"
              >
                <Users size={16} />
                <span className="text-sm font-medium hidden md:inline">Members</span>
              </button>
            )}
            <button
              onClick={() => setIsPinManagerOpen(true)}
              className={`p-1.5 md:pl-2 md:pr-3 rounded-lg flex items-center gap-2 transition-colors border ${isPinManagerOpen ? 'bg-white/10 border-white/20 text-white' : 'bg-[#2a2a2a] border-white/5 text-gray-400 hover:text-white hover:bg-[#333]'}`}
            >
              <Pin size={16} />
              <span className="text-sm font-medium hidden md:inline">Saved Items</span>
            </button>
          </div>
        </div>

        {/* Main Messages Area */}
        <MessageList channelId={activeChannelId} />

        {/* Input Area */}
        <MessageInput channelId={activeChannelId} />
      </div>

      {/* Thread Panel - full-width overlay on mobile, inline on desktop */}
      {activeThreadId && (
        <div className="fixed inset-0 z-40 md:hidden bg-black/60 backdrop-blur-sm" onClick={() => useMessageStore.getState().setActiveThread(null)} />
      )}
      <div className={`${activeThreadId ? 'fixed inset-0 z-50 md:relative md:inset-auto md:z-20' : ''}`}>
        <ThreadPanel channelId={activeChannelId} />
      </div>

      <PinManager isOpen={isPinManagerOpen} onClose={() => setIsPinManagerOpen(false)} />

      {activeChannel?.is_private && (
        <ChannelMembers
          channel={activeChannel}
          isOpen={isMembersOpen}
          onClose={() => setIsMembersOpen(false)}
        />
      )}
    </div>
  );
};
