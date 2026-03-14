import React, { useEffect, useRef, useLayoutEffect, useState } from 'react';
import { motion } from 'framer-motion';
import DOMPurify from 'dompurify';
import { useMessageStore } from '../../stores/messageStore';
import { useAuthStore } from '../../stores/authStore';
import { MessageCircle, Edit2, SmilePlus, Pin, Bookmark, Quote, Send, Trash2 } from 'lucide-react';
import { PresenceAvatar } from '../common/PresenceAvatar';
import { EditHistoryModal } from './EditHistoryModal';
import ForwardModal from './ForwardModal';
import { ReactionBubble } from './ReactionBubble';
import { EmojiPicker } from './EmojiPicker';

import type { Message } from '../../stores/messageStore';

interface MessageListProps {
  channelId: string | undefined;
}

export const MessageList: React.FC<MessageListProps> = ({ channelId }) => {
  const { messages, fetchMessages, loadMoreMessages, isLoading, hasMore, setActiveThread, editMessage, deleteMessage, setReplyTo } = useMessageStore();
  const { user } = useAuthStore();
  const currentUserId = user?.id;
  
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [historyModalMessageId, setHistoryModalMessageId] = useState<string | null>(null);
  const [activeEmojiPickerMsgId, setActiveEmojiPickerMsgId] = useState<string | null>(null);
  const [forwardModalMessage, setForwardModalMessage] = useState<Message | null>(null);
  
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [previousScrollHeight, setPreviousScrollHeight] = useState(0);
  const [isFetchingOlder, setIsFetchingOlder] = useState(false);

  useEffect(() => {
    if (channelId) {
      fetchMessages(channelId);
    }
  }, [channelId, fetchMessages]);



  useLayoutEffect(() => {
    // Scroll to bottom when channel changes and initial fetch completes.
    // Uses useLayoutEffect so the scroll happens before the browser paints,
    // preventing a flash of messages at the wrong scroll position.
    if (!isFetchingOlder && !isLoading && messages.length > 0) {
      bottomRef.current?.scrollIntoView({ behavior: 'auto' });
    }
  }, [messages.length, channelId, isFetchingOlder, isLoading]);

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
      <div className="flex-1 flex items-center justify-center text-gray-500" data-testid="loading-messages">
        <div className="flex flex-col items-center gap-2">
          <div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
          <span>Loading messages...</span>
        </div>
      </div>
    );
  }

  if (!isLoading && messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-500">
        <div className="flex flex-col items-center gap-4 max-w-sm text-center">
          <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center text-gray-400">
            <MessageCircle size={32} opacity={0.5} />
          </div>
          <div>
            <h3 className="text-white font-medium mb-1">No messages yet</h3>
            <p className="text-sm">Be the first to say hello in this channel!</p>
          </div>
        </div>
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
                data-message-id={msg.id}
                data-user-id={msg.user_id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`message-item group relative flex items-start gap-4 hover:bg-white/[0.02] -mx-4 px-4 py-2 rounded-2xl transition-colors ${isConsecutive ? 'mt-1' : 'mt-6'} ${isCurrentUser ? 'flex-row-reverse' : ''}`}
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
                          {msg.is_pinned && <span title="Pinned to channel"><Pin size={12} className="text-yellow-500 fill-yellow-500 ml-1" /></span>}
                          {msg.is_bookmarked && <span title="Bookmarked"><Bookmark size={12} className="text-blue-400 fill-blue-400 ml-1" /></span>}
                        </span>
                      </div>
                    )}
                    
                    {msg.forward_source_id && (
                      <div className={`flex items-center gap-1.5 mb-1 text-[11px] font-medium text-blue-400 opacity-80 ${isCurrentUser ? 'flex-row-reverse' : ''}`}>
                        <Send size={10} />
                        <span>Forwarded {msg.forward_source_username ? `from ${msg.forward_source_username}` : ''}</span>
                      </div>
                    )}
                    
                    {msg.reply_to && (
                      <div 
                        className={`mb-2 p-2 rounded-lg bg-white/5 border-l-2 border-blue-500/50 cursor-pointer hover:bg-white/10 transition-colors max-w-sm ${isCurrentUser ? 'self-end' : 'self-start'}`}
                        onClick={() => {
                          const parent = document.querySelector(`[data-message-id="${msg.reply_to}"]`);
                          if (parent) {
                            parent.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            parent.classList.add('highlight-message');
                            setTimeout(() => parent.classList.remove('highlight-message'), 2000);
                          }
                        }}
                      >
                        <div className="flex items-center gap-2 mb-0.5">
                          <Quote size={10} className="text-blue-400" />
                          <span className="text-[11px] font-semibold text-blue-400/80 uppercase tracking-wider">
                            {messages.find(m => m.id === msg.reply_to)?.username || 'Original Message'}
                          </span>
                        </div>
                        <p className="text-xs text-gray-400 truncate line-clamp-1">
                          {messages.find(m => m.id === msg.reply_to)?.content_md || 'Unsaved or older message'}
                        </p>
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
                          } ${msg.status === 'sending' ? 'opacity-50' : ''}`}
                        >
                          <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(msg.content_html || msg.content_md) }} />
                        </div>
                        <div className={`flex flex-col gap-1 items-start ${isCurrentUser ? 'mr-2' : 'ml-2'} mb-1`}>
                          {msg.status === 'sending' && (
                            <span className="text-[10px] text-gray-500 animate-pulse">Sending...</span>
                          )}
                          {msg.status === 'error' && (
                            <span className="text-[10px] text-red-500">Failed to send</span>
                          )}
                          {msg.is_edited && isConsecutive && (
                            <button 
                              onClick={() => setHistoryModalMessageId(msg.id)}
                              className="text-[10px] text-gray-500 hover:text-blue-400 bg-white/5 px-1.5 py-0.5 rounded transition-colors"
                            >
                              (edited)
                            </button>
                          )}
                          {isConsecutive && (
                            <div className={`flex items-center gap-1 opacity-80 ${isCurrentUser ? 'flex-row-reverse' : ''}`}>
                              {msg.is_pinned && <span title="Pinned to channel"><Pin size={12} className="text-yellow-500 fill-yellow-500" /></span>}
                              {msg.is_bookmarked && <span title="Bookmarked"><Bookmark size={12} className="text-blue-400 fill-blue-400" /></span>}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                    
                    {/* Reactions array */}
                    {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                      <div className={`flex flex-wrap gap-1 mt-1.5 ${isCurrentUser ? 'justify-end' : 'justify-start'}`}>
                        {Object.entries(msg.reactions).map(([emoji, count]) => (
                          <ReactionBubble
                            key={emoji}
                            emoji={emoji}
                            count={count}
                            hasReacted={!!msg.user_reactions?.includes(emoji)}
                            onClick={() => useMessageStore.getState().toggleReaction(channelId!, msg.id, emoji)}
                          />
                        ))}
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
                    <>
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
                      <button
                        onClick={() => {
                          if (channelId) deleteMessage(channelId, msg.id);
                        }}
                        className="p-1.5 rounded-lg bg-[#2a2a2a] border border-white/5 text-gray-400 hover:text-red-400 hover:bg-[#333] transition-all shadow-lg flex items-center gap-1.5"
                        title="Delete message"
                      >
                        <Trash2 size={14} />
                      </button>
                    </>
                  )}
                  
                  <div className="relative">
                    <button 
                      onClick={() => setActiveEmojiPickerMsgId(activeEmojiPickerMsgId === msg.id ? null : msg.id)}
                      className="p-1.5 rounded-lg bg-[#2a2a2a] border border-white/5 text-gray-400 hover:text-white hover:bg-[#333] transition-all shadow-lg flex items-center gap-1.5"
                      title="Add reaction"
                    >
                      <SmilePlus size={14} />
                    </button>
                    {activeEmojiPickerMsgId === msg.id && (
                      <EmojiPicker 
                        onSelect={(emoji) => useMessageStore.getState().toggleReaction(channelId!, msg.id, emoji)}
                        onClose={() => setActiveEmojiPickerMsgId(null)}
                      />
                    )}
                  </div>

                  <button 
                    onClick={() => useMessageStore.getState().toggleBookmark(channelId!, msg.id)}
                    className="p-1.5 rounded-lg bg-[#2a2a2a] border border-white/5 text-gray-400 hover:text-blue-400 hover:bg-[#333] transition-all shadow-lg flex items-center gap-1.5"
                    title={msg.is_bookmarked ? "Remove bookmark" : "Bookmark"}
                  >
                    <Bookmark size={14} className={msg.is_bookmarked ? "fill-blue-400 text-blue-400" : ""} />
                  </button>

                  <button 
                    onClick={() => {
                      setReplyTo(msg);
                      const input = document.querySelector('textarea');
                      input?.focus();
                    }}
                    className="p-1.5 rounded-lg bg-[#2a2a2a] border border-white/5 text-gray-400 hover:text-blue-400 hover:bg-[#333] transition-all shadow-lg flex items-center gap-1.5"
                    title="Quote"
                  >
                    <Quote size={14} />
                  </button>

                  <button 
                    onClick={() => useMessageStore.getState().togglePin(channelId!, msg.id)}
                    className="p-1.5 rounded-lg bg-[#2a2a2a] border border-white/5 text-gray-400 hover:text-yellow-500 hover:bg-[#333] transition-all shadow-lg flex items-center gap-1.5"
                    title={msg.is_pinned ? "Unpin message" : "Pin to channel"}
                  >
                    <Pin size={14} className={msg.is_pinned ? "fill-yellow-500 text-yellow-500" : ""} />
                  </button>
                  
                  <button 
                    onClick={() => setActiveThread(msg.id)}
                    className="p-1.5 rounded-lg bg-[#2a2a2a] border border-white/5 text-gray-400 hover:text-white hover:bg-[#333] transition-all shadow-lg flex items-center gap-1.5"
                    title="Open thread"
                  >
                    <MessageCircle size={14} />
                    <span className="text-xs font-medium pr-1">Reply</span>
                  </button>

                  <button 
                    onClick={() => setForwardModalMessage(msg)}
                    className="p-1.5 rounded-lg bg-[#2a2a2a] border border-white/5 text-gray-400 hover:text-white hover:bg-[#333] transition-all shadow-lg flex items-center gap-1.5"
                    title="Forward message"
                  >
                    <Send size={14} />
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

      {forwardModalMessage && (
        <ForwardModal 
          isOpen={!!forwardModalMessage}
          onClose={() => setForwardModalMessage(null)}
          message={forwardModalMessage}
        />
      )}
    </div>
  );
};
