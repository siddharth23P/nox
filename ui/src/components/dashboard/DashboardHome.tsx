import React, { useState } from 'react';
import { Hash, Pin } from 'lucide-react';
import { MessageList } from './MessageList';
import { MessageInput } from './MessageInput';
import { ThreadPanel } from './ThreadPanel';
import { PinManager } from './PinManager';
import { useMessageStore } from '../../stores/messageStore';
import { useAuthStore } from '../../stores/authStore';
import { usePresenceStore } from '../../stores/presenceStore';

export const DashboardHome: React.FC = () => {
  const { activeChannel, setActiveChannel, channels } = useMessageStore();
  const { user, token } = useAuthStore();
  const { startHeartbeat, stopHeartbeat } = usePresenceStore();
  
  const [isPinManagerOpen, setIsPinManagerOpen] = useState(false);

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

      {/* Main Channel Area */}
      <div className="flex-1 h-full flex flex-col relative min-w-0 min-h-0">
        {/* Header */}
        <div className="h-14 border-b border-white/5 flex items-center px-6 bg-[#030712]/50 backdrop-blur-md z-10 shrink-0">
          <div className="flex items-center gap-2">
            <Hash size={20} className="text-gray-500" />
            <h2 className="text-white font-semibold flex items-center gap-2">
              {activeChannelName}
              <span className="text-xs font-normal text-gray-500 bg-white/5 px-2 py-0.5 rounded-full">
                Team discussion
              </span>
            </h2>
          </div>
          <div className="ml-auto flex items-center gap-4">
            <button 
              onClick={() => setIsPinManagerOpen(true)}
              className={`p-1.5 pl-2 pr-3 rounded-lg flex items-center gap-2 transition-colors border ${isPinManagerOpen ? 'bg-white/10 border-white/20 text-white' : 'bg-[#2a2a2a] border-white/5 text-gray-400 hover:text-white hover:bg-[#333]'}`}
            >
              <Pin size={16} />
              <span className="text-sm font-medium">Saved Items</span>
            </button>
          </div>
        </div>

        {/* Main Messages Area */}
        <MessageList channelId={activeChannelId} />

        {/* Input Area */}
        <MessageInput channelId={activeChannelId} />
      </div>

      {/* Slide-out Thread Panel (inline with main chat) */}
      <ThreadPanel channelId={activeChannelId} />

      <PinManager isOpen={isPinManagerOpen} onClose={() => setIsPinManagerOpen(false)} />
      
    </div>
  );
};
