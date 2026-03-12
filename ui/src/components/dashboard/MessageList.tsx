import React, { useEffect, useRef, useLayoutEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useMessageStore } from '../../stores/messageStore';
import { useAuthStore } from '../../stores/authStore';
import { MessageCircle, Edit2 } from 'lucide-react';
import { PresenceAvatar } from '../common/PresenceAvatar';
import { EditHistoryModal } from './EditHistoryModal';
import type { Message } from '../../stores/messageStore';

interface MessageListProps {
  channelId: string | undefined;
}

export const MessageList: React.FC<MessageListProps> = ({ channelId }) => {
  const { messages, fetchMessages, loadMoreMessages, isLoading, hasMore, setActiveThread, editMessage } = useMessageStore();
  const { user } = useAuthStore();
  const currentUserId = user?.id || '22222222-2222-2222-2222-222222222222';
  
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [historyModalMessageId, setHistoryModalMessageId] = useState<string | null>(null);
  
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [previousScrollHeight, setPreviousScrollHeight] = useState(0);
  const [isFetchingOlder, setIsFetchingOlder] = useState(false);

  useEffect(() => {
    if (channelId) {
      fetchMessages(channelId);
    }
  }, [channelId, fetchMessages]);

  const messagesCount = messages.length;

  useEffect(() => {
    // Scroll to bottom when channel changes and initial fetch completes
    if (!isFetchingOlder) {
      bottomRef.current?.scrollIntoView({ behavior: 'auto' });
    }
  }, [messagesCount, channelId, isFetchingOlder]);

  useLayoutEffect(() => {
    // Restore scroll position after prepending older messages
    if (isFetchingOlder && scrollContainerRef.current) {
      const container = scrollContainerRef.current;
      container.scrollTop = container.scrollHeight - previousScrollHeight;
      // eslint-disable-next-line
      setIsFetchingOlder(false);
    }
  }, [messages, isFetchingOlder, previousScrollHeight]);

  const handleScroll = async (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    if (target.scrollTop === 0 && hasMore && !isLoading && messages.length > 0 && channelId) {
      setPreviousScrollHeight(target.scrollHeight);
      setIsFetchingOlder(true);
      const oldestMessage = messages[0];
      await loadMoreMessages(channelId, oldestMessage.created_at);
    }
  };

  const handleSaveEdit = async (msgId: string) => {
    if (!channelId || !editContent.trim()) return;
    try {
      await editMessage(channelId, msgId, editContent.trim());
      setEditingMessageId(null);
    } catch (e) {
      console.error(e);
      // In a real app we'd show a toast error
    }
  };

  if (isLoading && messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-500">
        Loading messages...
      </div>
    );
  }

  return (
    <div 
      ref={scrollContainerRef}
      onScroll={handleScroll}
      className="flex-1 overflow-y-auto px-6 pt-4 flex flex-col custom-scrollbar"
    >
      <div className="flex-1 flex flex-col max-w-4xl mx-auto w-full min-h-0">
        
        {isFetchingOlder && (
          <div className="w-full flex justify-center py-2 text-gray-500 text-sm">
            Loading older messages...
          </div>
        )}
        
        <div className="space-y-6 pb-4 mt-auto">
          {messages.map((msg: Message, i) => {
            const isConsecutive = i > 0 && messages[i - 1].user_id === msg.user_id;
            const isCurrentUser = msg.user_id === currentUserId;

            return (
              <motion.div 
                key={msg.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`group relative flex items-start gap-4 hover:bg-white/[0.02] -mx-4 px-4 py-2 rounded-2xl transition-colors ${isConsecutive ? 'mt-1' : 'mt-6'} ${isCurrentUser ? 'flex-row-reverse' : ''}`}
              >
                {/* Avatar area */}
                <div className="w-10 flex-shrink-0 flex justify-center">
                  {!isConsecutive ? (
                    <PresenceAvatar userId={msg.user_id} username={msg.username || 'U'} size="md" />
                  ) : (
                    <span className="text-[10px] text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity mt-2">
                      {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                </div>

                  {/* Message Content */}
                  <div className={`flex-1 min-w-0 flex flex-col ${isCurrentUser ? 'items-end' : 'items-start'}`}>
                    {!isConsecutive && (
                      <div className={`flex items-baseline gap-2 mb-1 ${isCurrentUser ? 'flex-row-reverse' : ''}`}>
                        <span className="text-[15px] font-semibold text-gray-100">{isCurrentUser ? 'You' : msg.username || 'Unknown'}</span>
                        <span className="text-xs text-gray-500 font-medium flex items-center gap-1">
                          {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          {msg.is_edited && (
                            <button 
                              onClick={() => setHistoryModalMessageId(msg.id)}
                              className="text-[10px] text-gray-500 hover:text-blue-400 bg-white/5 px-1.5 py-0.5 rounded transition-colors ml-1"
                            >
                              (edited)
                            </button>
                          )}
                        </span>
                      </div>
                    )}
                    
                    {editingMessageId === msg.id ? (
                      <div className="w-full max-w-lg mt-1 relative z-10 flex flex-col gap-2">
                        <textarea
                          value={editContent}
                          onChange={(e) => setEditContent(e.target.value)}
                          aria-label="Edit message"
                          placeholder="Edit your message..."
                          className={`w-full bg-[#2a2a2a] border border-white/10 rounded-xl p-3 text-sm text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none min-h-[80px] custom-scrollbar`}
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              handleSaveEdit(msg.id);
                            }
                            if (e.key === 'Escape') setEditingMessageId(null);
                          }}
                        />
                        <div className={`flex items-center gap-2 ${isCurrentUser ? 'justify-start' : 'justify-end'} text-xs`}>
                          <button 
                            onClick={() => setEditingMessageId(null)}
                            className="px-3 py-1.5 text-gray-400 hover:text-white transition-colors"
                          >
                            Cancel
                          </button>
                          <button 
                            onClick={() => handleSaveEdit(msg.id)}
                            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium transition-colors"
                            disabled={!editContent.trim()}
                          >
                            Save
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className={`flex items-end gap-2 ${isCurrentUser ? 'flex-row-reverse' : 'flex-row'}`}>
                        <div 
                          className={`text-[15px] leading-relaxed font-light whitespace-pre-wrap ${
                            isCurrentUser 
                              ? 'bg-blue-600/20 text-blue-100 px-4 py-2.5 rounded-2xl rounded-tr-sm inline-block text-right border border-blue-500/20' 
                              : 'text-gray-300'
                          }`}
                        >
                          <div dangerouslySetInnerHTML={{ __html: msg.content_html || msg.content_md }} />
                        </div>
                        {msg.is_edited && isConsecutive && (
                          <button 
                            onClick={() => setHistoryModalMessageId(msg.id)}
                            className="text-[10px] text-gray-500 hover:text-blue-400 bg-white/5 px-1.5 py-0.5 rounded transition-colors mb-2"
                          >
                            (edited)
                          </button>
                        )}
                      </div>
                    )}

                  {/* Reply Count Indicator */}
                  {msg.reply_count && msg.reply_count > 0 ? (
                    <div 
                      className={`mt-2 flex items-center gap-2 text-sm text-blue-400/80 cursor-pointer hover:text-blue-400 transition-colors w-max ${isCurrentUser ? 'flex-row-reverse' : ''}`}
                      onClick={() => setActiveThread(msg.id)}
                    >
                      <MessageCircle size={14} className="opacity-80" />
                      <span className="font-medium">{msg.reply_count} {msg.reply_count === 1 ? 'reply' : 'replies'}</span>
                    </div>
                  ) : null}
                </div>

                {/* Hover Actions */}
                <div className={`absolute top-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2 ${isCurrentUser ? 'left-4' : 'right-4'}`}>
                  {isCurrentUser && (
                    <button 
                      onClick={() => {
                        setEditingMessageId(msg.id);
                        setEditContent(msg.content_md);
                      }}
                      className="p-1.5 rounded-lg bg-[#2a2a2a] border border-white/5 text-gray-400 hover:text-white hover:bg-[#333] transition-all shadow-lg flex items-center gap-1.5"
                      title="Edit message"
                    >
                      <Edit2 size={14} />
                    </button>
                  )}
                  <button 
                    onClick={() => setActiveThread(msg.id)}
                    className="p-1.5 rounded-lg bg-[#2a2a2a] border border-white/5 text-gray-400 hover:text-white hover:bg-[#333] transition-all shadow-lg flex items-center gap-1.5"
                  >
                    <MessageCircle size={14} />
                    <span className="text-xs font-medium pr-1">Reply</span>
                  </button>
                </div>

              </motion.div>
            );
          })}
        </div>
        
        <div ref={bottomRef} className="h-4 shrink-0" />
      </div>

      {historyModalMessageId && channelId && (
        <EditHistoryModal 
          isOpen={!!historyModalMessageId}
          onClose={() => setHistoryModalMessageId(null)}
          channelId={channelId}
          messageId={historyModalMessageId}
        />
      )}
    </div>
  );
};
