import React from 'react';
import { Hash } from 'lucide-react';
import { MessageList } from './MessageList';
import { MessageInput } from './MessageInput';
import { ThreadPanel } from './ThreadPanel';
import { useMessageStore } from '../../stores/messageStore';

export const DashboardHome: React.FC = () => {
  const { activeChannel } = useMessageStore();
  const activeChannelId = activeChannel?.id || "00000000-0000-0000-0000-000000000001";
  const activeChannelName = activeChannel?.name || "general";

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
        </div>

        {/* Main Messages Area */}
        <MessageList channelId={activeChannelId} />

        {/* Input Area */}
        <MessageInput channelId={activeChannelId} />
      </div>

      {/* Slide-out Thread Panel */}
      <ThreadPanel channelId={activeChannelId} />
      
    </div>
  );
};
