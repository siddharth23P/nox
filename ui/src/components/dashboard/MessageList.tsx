import React, { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { useMessageStore } from '../../stores/messageStore';
import type { Message } from '../../stores/messageStore';

interface MessageListProps {
  channelId: string | undefined;
}

export const MessageList: React.FC<MessageListProps> = ({ channelId }) => {
  const { messages, fetchMessages, isLoading } = useMessageStore();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (channelId) {
      fetchMessages(channelId);
    }
  }, [channelId, fetchMessages]);

  useEffect(() => {
    // Scroll to bottom when new messages arrive
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (isLoading && messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-500">
        Loading messages...
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-6 pt-4 flex flex-col custom-scrollbar">
      <div className="flex-1 flex flex-col justify-end max-w-4xl mx-auto w-full min-h-0">
        
        <div className="space-y-6 pb-4">
          {messages.map((msg: Message, i) => {
            const isConsecutive = i > 0 && messages[i - 1].user_id === msg.user_id;

            return (
              <motion.div 
                key={msg.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`group flex items-start gap-4 hover:bg-white/[0.02] -mx-4 px-4 py-2 rounded-2xl transition-colors ${isConsecutive ? 'mt-1' : 'mt-6'}`}
              >
                {/* Avatar area */}
                <div className="w-10 flex-shrink-0 flex justify-center">
                  {!isConsecutive ? (
                    <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-500/20 to-purple-500/20 border border-white/10 flex items-center justify-center overflow-hidden">
                      <span className="text-white/70 font-medium text-sm">
                        {msg.user_id.substring(0, 2).toUpperCase() || 'U'}
                      </span>
                    </div>
                  ) : (
                    <span className="text-[10px] text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity mt-2">
                      {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                </div>

                {/* Message Content */}
                <div className="flex-1 min-w-0">
                  {!isConsecutive && (
                    <div className="flex items-baseline gap-2 mb-1">
                      <span className="text-[15px] font-semibold text-gray-100">User {msg.user_id.substring(0, 4)}</span>
                      <span className="text-xs text-gray-500 font-medium">
                        {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  )}
                  
                  <div 
                    className="text-[15px] text-gray-300 leading-relaxed font-light whitespace-pre-wrap"
                    dangerouslySetInnerHTML={{ __html: msg.content_html || msg.content_md }}
                  />
                </div>
              </motion.div>
            );
          })}
        </div>
        
        <div ref={bottomRef} className="h-4 shrink-0" />
      </div>
    </div>
  );
};
