import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CornerDownRight } from 'lucide-react';
import { useMessageStore } from '../../stores/messageStore';

interface ThreadPanelProps {
  channelId: string;
}

export const ThreadPanel: React.FC<ThreadPanelProps> = ({ channelId }) => {
  const { 
    activeThreadId, 
    setActiveThread, 
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
          animate={{ width: 400, opacity: 1 }}
          exit={{ width: 0, opacity: 0 }}
          transition={{ type: "spring", bounce: 0, duration: 0.3 }}
          className="h-full border-l border-white/5 bg-[#030712] flex flex-col flex-shrink-0 relative overflow-hidden z-20 shadow-[-10px_0_30px_rgba(0,0,0,0.5)]"
        >
          {/* Header */}
          <div className="h-14 border-b border-white/5 flex items-center justify-between px-4 shrink-0 bg-white/[0.01] backdrop-blur-md w-[400px]">
            <h3 className="text-white font-semibold flex items-center gap-2">
              Thread
              <span className="text-xs font-normal text-gray-500 bg-white/5 px-2 py-0.5 rounded-full">
                general
              </span>
            </h3>
            <button 
              onClick={() => setActiveThread(null)}
              className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto w-[400px] flex flex-col custom-scrollbar">
            {/* Parent Message View */}
            {parentMessage && (
              <div className="p-4 border-b border-white/5 bg-white/[0.02]">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-500/20 to-purple-500/20 border border-white/10 flex items-center justify-center shrink-0">
                    <span className="text-white/70 font-medium text-sm">
                      {parentMessage.user_id.substring(0, 2).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <div className="flex items-baseline gap-2 mb-1">
                      <span className="text-[15px] font-semibold text-gray-100">User {parentMessage.user_id.substring(0, 4)}</span>
                      <span className="text-xs text-gray-500 font-medium">
                        {new Date(parentMessage.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <div 
                      className="text-[15px] text-gray-300 leading-relaxed font-light whitespace-pre-wrap"
                      dangerouslySetInnerHTML={{ __html: parentMessage.content_html || parentMessage.content_md }}
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
                <div className="text-center text-sm text-gray-500 py-4">Loading replies...</div>
              ) : (
                threadMessages.map((reply) => (
                  <div key={reply.id} className="group flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-green-500/20 to-emerald-500/20 border border-white/10 flex items-center justify-center shrink-0">
                      <span className="text-white/70 font-medium text-xs">
                        {reply.user_id.substring(0, 2).toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2 mb-1">
                        <span className="text-[14px] font-semibold text-gray-200">User {reply.user_id.substring(0, 4)}</span>
                        <span className="text-[11px] text-gray-500 font-medium">
                          {new Date(reply.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <div 
                        className="text-[14px] text-gray-400 leading-relaxed font-light whitespace-pre-wrap"
                        dangerouslySetInnerHTML={{ __html: reply.content_html || reply.content_md }}
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Simple Reply Input below the list */}
          <div className="p-4 w-[400px] border-t border-white/5 shrink-0 bg-white/[0.01]">
             <div className="bg-[#1a1a1a]/80 backdrop-blur border border-white/10 rounded-xl focus-within:border-white/20 transition-all p-3 flex flex-col gap-2 shadow-inner group">
               <textarea
                  value={replyInput}
                  onChange={(e) => setReplyInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  placeholder="Reply..."
                  className="w-full bg-transparent text-gray-200 placeholder-gray-500 text-sm focus:outline-none resize-none"
                  rows={3}
               />
               <div className="flex justify-between items-center mt-1">
                 <span className="text-[10px] text-gray-500 font-medium tracking-wide uppercase">
                   Return to send
                 </span>
                 <button
                   onClick={handleSend}
                   disabled={!replyInput.trim()}
                   className="w-7 h-7 flex items-center justify-center rounded-lg bg-blue-500 hover:bg-blue-400 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-[0_0_15px_rgba(59,130,246,0.5)]"
                 >
                   <CornerDownRight size={14} />
                 </button>
               </div>
             </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
