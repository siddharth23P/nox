import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import DOMPurify from 'dompurify';
import { X, CornerDownRight, MessageCircle } from 'lucide-react';
import { useMessageStore } from '../../stores/messageStore';
import { renderMentionsInHTML } from '../../utils/mentions';
import { PresenceAvatar } from '../common/PresenceAvatar';

interface ThreadPanelProps {
  channelId: string;
}

export const ThreadPanel: React.FC<ThreadPanelProps> = ({ channelId }) => {
  const { 
    activeThreadId, 
    setActiveThread, 
    activeChannel,
    messages, 
    threadMessages, 
    fetchThread, 
    sendThreadReply, 
    isLoading 
  } = useMessageStore();
  
  const [replyInput, setReplyInput] = useState('');
  
  const parentMessage = messages.find((m) => m.id === activeThreadId);

  useEffect(() => {
    if (activeThreadId && channelId) {
      fetchThread(channelId, activeThreadId);
    }
  }, [activeThreadId, channelId, fetchThread]);

  const handleSend = async () => {
    if (!replyInput.trim() || !activeThreadId) return;
    await sendThreadReply(channelId, activeThreadId, replyInput);
    setReplyInput('');
  };

  return (
    <AnimatePresence>
      {activeThreadId && (
        <motion.div
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: 450, opacity: 1 }}
          exit={{ width: 0, opacity: 0 }}
          transition={{ type: "spring", bounce: 0, duration: 0.3 }}
          className="h-full border-l border-white/5 bg-[#030712] flex flex-col flex-shrink-0 relative overflow-hidden z-20 shadow-[-10px_0_30px_rgba(0,0,0,0.5)]"
          data-testid="thread-panel"
        >
          {/* Header */}
          <div className="h-14 border-b border-white/5 flex items-center justify-between px-4 shrink-0 bg-white/[0.01] backdrop-blur-md w-[450px]">
            <h3 className="text-white font-semibold flex items-center gap-2">
              <MessageCircle size={18} className="text-blue-400" />
              Thread
              <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500 bg-white/5 px-2 py-1 rounded-md">
                {activeChannel?.name || 'general'}
              </span>
            </h3>
            <button 
              onClick={() => setActiveThread(null)}
              className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
              title="Close thread"
            >
              <X size={18} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto w-[450px] flex flex-col custom-scrollbar">
            {/* Parent Message View */}
            {parentMessage && (
              <div className="p-4 border-b border-white/5 bg-white/[0.02] glass-effect">
                <div className="flex items-start gap-4">
                  <PresenceAvatar 
                    userId={parentMessage.user_id} 
                    username={parentMessage.username || 'U'} 
                    size="md" 
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2 mb-1">
                      <span className="text-[15px] font-semibold text-gray-100">
                        {parentMessage.username || `User ${parentMessage.user_id.substring(0, 4)}`}
                      </span>
                      <span className="text-xs text-gray-500 font-medium whitespace-nowrap">
                        {new Date(parentMessage.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <div 
                      className="text-[15px] text-gray-300 leading-relaxed font-light whitespace-pre-wrap"
                      dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(renderMentionsInHTML(parentMessage.content_html || parentMessage.content_md), { ADD_ATTR: ['data-mention'] }) }}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Replies List */}
            <div className="flex-1 p-4 space-y-6">
              <div className="flex items-center gap-4 py-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
                  {threadMessages.length} {threadMessages.length === 1 ? 'Reply' : 'Replies'}
                </span>
                <div className="flex-1 h-px bg-white/5" />
              </div>

              {isLoading && threadMessages.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3 text-gray-500">
                  <div className="w-6 h-6 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
                  <span className="text-sm">Loading replies...</span>
                </div>
              ) : (
                threadMessages.map((reply) => (
                  <div key={reply.id} className="group flex items-start gap-3 hover:bg-white/[0.01] -mx-2 px-2 py-1 rounded-xl transition-colors">
                    <PresenceAvatar 
                      userId={reply.user_id} 
                      username={reply.username || 'U'} 
                      size="sm" 
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2 mb-1">
                        <span className="text-[14px] font-semibold text-gray-200">
                          {reply.username || `User ${reply.user_id.substring(0, 4)}`}
                        </span>
                        <span className="text-[11px] text-gray-500 font-medium whitespace-nowrap">
                          {new Date(reply.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <div 
                        className={`text-[14px] text-gray-400 leading-relaxed font-light whitespace-pre-wrap ${reply.status === 'sending' ? 'opacity-50' : ''}`}
                        dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(renderMentionsInHTML(reply.content_html || reply.content_md), { ADD_ATTR: ['data-mention'] }) }}
                      />
                      {reply.status === 'sending' && (
                        <span className="text-[10px] text-gray-500 animate-pulse block mt-1">Sending...</span>
                      )}
                      {reply.status === 'error' && (
                        <span className="text-[10px] text-red-500 block mt-1">Failed to send</span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Simple Reply Input below the list */}
          <div className="p-4 w-[450px] border-t border-white/5 shrink-0 bg-[#030712]">
             <div className="bg-[#1a1a1a]/80 backdrop-blur border border-white/10 rounded-xl focus-within:border-blue-500/30 transition-all p-3 flex flex-col gap-2 shadow-2xl group relative">
                <div className={`absolute -inset-0.5 bg-blue-500/10 rounded-xl blur transition-opacity opacity-0 group-focus-within:opacity-100 pointer-events-none`} />
                <textarea
                  value={replyInput}
                  onChange={(e) => setReplyInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  placeholder="Reply to thread..."
                  data-testid="thread-reply-input"
                  className="w-full bg-transparent text-gray-200 placeholder-gray-500 text-sm focus:outline-none resize-none min-h-[80px] relative z-10 custom-scrollbar"
                />
                <div className="flex justify-between items-center mt-1 relative z-10">
                  <span className="text-[10px] text-gray-500 font-medium tracking-wide uppercase">
                    Return to send
                  </span>
                  <button
                    onClick={handleSend}
                    disabled={!replyInput.trim()}
                    className="w-8 h-8 flex items-center justify-center rounded-lg bg-blue-500 hover:bg-blue-400 text-white disabled:opacity-20 disabled:grayscale disabled:cursor-not-allowed transition-all shadow-[0_0_15px_rgba(59,130,246,0.5)]"
                  >
                    <CornerDownRight size={16} />
                  </button>
                </div>
             </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
