import React from 'react';
import { X, Quote } from 'lucide-react';
import { useMessageStore } from '../../stores/messageStore';

export const ReplyPreview: React.FC = () => {
  const replyTo = useMessageStore((state) => state.replyTo);
  const setReplyTo = useMessageStore((state) => state.setReplyTo);

  if (!replyTo) return null;

  return (
    <div className="absolute bottom-full left-0 right-0 mb-2 px-1">
      <div className="bg-[#0d0d0d] border border-blue-500/30 rounded-xl p-3 flex items-start gap-3 shadow-2xl glass-effect">
        <div className="bg-blue-500/10 p-2 rounded-lg shrink-0">
          <Quote size={14} className="text-blue-400" />
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-0.5">
            <span className="text-[12px] font-semibold text-blue-400">
              Replying to {replyTo.username || 'User'}
            </span>
            <button 
              type="button"
              onClick={() => setReplyTo(null)}
              className="p-1 hover:bg-white/10 rounded-md transition-colors text-gray-500 hover:text-white"
              title="Cancel reply"
            >
              <X size={14} />
            </button>
          </div>
          <p className="text-[13px] text-gray-400 truncate line-clamp-1">
            {replyTo.content_md}
          </p>
        </div>
      </div>
    </div>
  );
};
