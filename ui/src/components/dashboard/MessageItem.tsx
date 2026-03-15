import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { MessageCircle, Edit2, SmilePlus, Pin, Bookmark, Quote, Send, Clock } from 'lucide-react';
import { useMessageStore } from '../../stores/messageStore';
import { useAuthStore } from '../../stores/authStore';
import { FormattedMessage } from '../common/FormattedMessage';
import { PresenceAvatar } from '../common/PresenceAvatar';
import { ReactionBubble } from './ReactionBubble';
import { EmojiPicker } from './EmojiPicker';
import type { Message } from '../../stores/messageStore';

const Countdown: React.FC<{ date: string; onExpire?: () => void }> = ({ date, onExpire }) => {
  const [timeLeft, setTimeLeft] = useState<string>('');

  useEffect(() => {
    const update = () => {
      const diff = new Date(date).getTime() - Date.now();
      if (diff <= 0) {
        setTimeLeft('Expired');
        if (onExpire) onExpire();
        return;
      }

      const totalSeconds = Math.floor(diff / 1000);
      const h = Math.floor(totalSeconds / 3600);
      const m = Math.floor((totalSeconds % 3600) / 60);
      const s = totalSeconds % 60;

      if (h > 0) setTimeLeft(`${h}h ${m}m`);
      else if (m > 0) setTimeLeft(`${m}m ${s}s`);
      else setTimeLeft(`${s}s`);
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [date, onExpire]);

  return <span>{timeLeft}</span>;
};

interface MessageItemProps {
  message: Message;
  channelId: string;
  isConsecutive?: boolean;
  hideReply?: boolean;
  className?: string;
  onEdit?: (content: string) => void;
  onForward?: () => void;
  onShowHistory?: () => void;
}

export const MessageItem: React.FC<MessageItemProps> = ({ 
  message: msg, 
  channelId,
  isConsecutive = false, 
  hideReply = false,
  className = "",
  onEdit,
  onForward,
  onShowHistory
}) => {
  const currentUserId = useAuthStore((state) => state.user?.id);
  const { setActiveThread, toggleReaction, toggleBookmark, togglePin, deleteMessage } = useMessageStore();
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const isCurrentUser = msg.user_id === currentUserId;

  return (
    <motion.div 
      data-testid="message-item"
      data-message-id={msg.id}
      data-user-id={msg.user_id}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`message-item group relative flex items-start gap-4 hover:bg-white/[0.02] py-2 rounded-2xl transition-colors ${isConsecutive ? 'mt-1' : 'mt-6'} ${isCurrentUser ? 'flex-row-reverse' : ''} ${className}`}
    >
      <div className="w-10 flex-shrink-0 flex justify-center">
        {!isConsecutive ? (
          <PresenceAvatar userId={msg.user_id} username={msg.username || 'U'} size="md" />
        ) : (
          <span className="text-[10px] text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity mt-2">
            {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
      </div>

      <div className={`flex-1 min-w-0 flex flex-col ${isCurrentUser ? 'items-end' : 'items-start'}`}>
        {!isConsecutive && (
          <div className={`flex items-baseline gap-2 mb-1 ${isCurrentUser ? 'flex-row-reverse' : ''}`}>
            <span className="text-[15px] font-semibold text-gray-100">{isCurrentUser ? 'You' : msg.username || 'Unknown'}</span>
            <span className="text-xs text-gray-500 font-medium flex items-center gap-1">
              {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              {msg.is_edited && onShowHistory && (
                <button 
                  onClick={onShowHistory}
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
            className={`mb-2 p-2 rounded-lg bg-white/5 border-l-2 border-blue-500/50 cursor-pointer hover:bg-white/10 transition-colors max-w-full ${isCurrentUser ? 'self-end' : 'self-start'}`}
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
                Original Message
              </span>
            </div>
            <p className="text-xs text-gray-400 truncate line-clamp-1">
              Scroll to see original message
            </p>
          </div>
        )}
        
        <div className={`flex items-end gap-2 ${isCurrentUser ? 'flex-row-reverse' : 'flex-row'}`}>
          <div className={`flex flex-col gap-1 items-start ${isCurrentUser ? 'items-end' : 'items-start'}`}>
            <div 
              className={`max-w-full ${
                isCurrentUser 
                  ? 'bg-blue-600/20 px-4 py-2.5 rounded-2xl rounded-tr-sm border border-blue-500/20' 
                  : ''
              } ${msg.status === 'sending' ? 'opacity-50' : ''}`}
            >
              <FormattedMessage 
                content={msg.content_md} 
                className={isCurrentUser ? 'text-blue-100' : 'text-gray-300'}
              />
            </div>
            
            {msg.expires_at && (
              <div className="flex items-center gap-1 text-[10px] text-orange-400 font-medium">
                <Clock size={10} />
                <span>Vanishing in</span>
                <Countdown 
                  date={msg.expires_at} 
                  onExpire={() => deleteMessage(msg.channel_id, msg.id)} 
                />
              </div>
            )}
            
            <div className={`flex flex-col gap-1 items-start ${isCurrentUser ? 'mr-2' : 'ml-2'} mb-1`}>
              {msg.status === 'sending' && (
                <span className="text-[10px] text-gray-500 animate-pulse">Sending...</span>
              )}
              {msg.status === 'error' && (
                <span className="text-[10px] text-red-500">Failed to send</span>
              )}
              {msg.is_edited && isConsecutive && onShowHistory && (
                <button 
                  onClick={onShowHistory}
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
        </div>

        {msg.reactions && Object.keys(msg.reactions).length > 0 && (
          <div className={`flex flex-wrap gap-1 mt-1.5 ${isCurrentUser ? 'justify-end' : 'justify-start'}`}>
            {Object.entries(msg.reactions).map(([emoji, count]) => (
              <ReactionBubble
                key={emoji}
                emoji={emoji}
                count={count}
                hasReacted={!!msg.user_reactions?.includes(emoji)}
                onClick={() => toggleReaction(channelId, msg.id, emoji)}
              />
            ))}
          </div>
        )}

        {msg.reply_count && msg.reply_count > 0 && !hideReply ? (
          <div
            className={`mt-2 flex items-center gap-2 text-sm text-blue-400/80 w-max ${isCurrentUser ? 'flex-row-reverse' : ''}`}
          >
            <MessageCircle size={14} className="opacity-80" />
            <span className="font-medium">{msg.reply_count} {msg.reply_count === 1 ? 'reply' : 'replies'}</span>
          </div>
        ) : null}
      </div>

      <div className={`absolute top-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2 ${isCurrentUser ? 'left-4' : 'right-4'}`}>
        {isCurrentUser && onEdit && (
          <button 
            onClick={() => onEdit(msg.content_md)}
            className="p-1.5 rounded-lg bg-[#2a2a2a] border border-white/5 text-gray-400 hover:text-white hover:bg-[#333] transition-all shadow-lg"
            title="Edit message"
          >
            <Edit2 size={14} />
          </button>
        )}
        
        <div className="relative">
          <button 
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            className="p-1.5 rounded-lg bg-[#2a2a2a] border border-white/5 text-gray-400 hover:text-white hover:bg-[#333] transition-all shadow-lg"
            title="Add reaction"
          >
            <SmilePlus size={14} />
          </button>
          {showEmojiPicker && (
            <EmojiPicker 
              onSelect={(emoji) => {
                toggleReaction(channelId, msg.id, emoji);
                setShowEmojiPicker(false);
              }}
              onClose={() => setShowEmojiPicker(false)}
            />
          )}
        </div>

        <button 
          onClick={() => toggleBookmark(channelId, msg.id)}
          className="p-1.5 rounded-lg bg-[#2a2a2a] border border-white/5 text-gray-400 hover:text-blue-400 hover:bg-[#333] transition-all shadow-lg"
          title={msg.is_bookmarked ? "Remove bookmark" : "Bookmark"}
        >
          <Bookmark size={14} className={msg.is_bookmarked ? "fill-blue-400 text-blue-400" : ""} />
        </button>

        <button 
          onClick={() => togglePin(channelId, msg.id)}
          className="p-1.5 rounded-lg bg-[#2a2a2a] border border-white/5 text-gray-400 hover:text-yellow-500 hover:bg-[#333] transition-all shadow-lg"
          title={msg.is_pinned ? "Unpin message" : "Pin to channel"}
        >
          <Pin size={14} className={msg.is_pinned ? "fill-yellow-500 text-yellow-500" : ""} />
        </button>
        
        {!hideReply && (
          <button
            onClick={() => setActiveThread(msg.id)}
            className="p-1.5 rounded-lg bg-[#2a2a2a] border border-white/5 text-gray-400 hover:text-white hover:bg-[#333] transition-all shadow-lg"
            title="Reply in thread"
            data-tour="thread-hint"
          >
            <MessageCircle size={14} />
          </button>
        )}

        {onForward && (
          <button 
            onClick={onForward}
            className="p-1.5 rounded-lg bg-[#2a2a2a] border border-white/5 text-gray-400 hover:text-white hover:bg-[#333] transition-all shadow-lg"
            title="Forward message"
          >
            <Send size={14} />
          </button>
        )}
      </div>
    </motion.div>
  );
};
