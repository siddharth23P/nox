import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Send, Smile, AtSign, Paperclip } from 'lucide-react';
import { useMessageStore } from '../../stores/messageStore';
import { TypingIndicator } from './TypingIndicator';
import { useWebSocket } from '../../hooks/useWebSocket';

interface MessageInputProps {
  channelId: string | undefined;
}

export const MessageInput: React.FC<MessageInputProps> = ({ channelId }) => {
  const [content, setContent] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const sendMessage = useMessageStore((state) => state.sendMessage);
  const activeChannel = useMessageStore((state) => state.activeChannel);
  const placeholderSuffix = activeChannel?.name || "general";
  const { sendTyping } = useWebSocket();
  const lastTypingSent = React.useRef<number>(0);

  const handleTyping = () => {
    if (!channelId) return;
    const now = Date.now();
    if (now - lastTypingSent.current > 3000) {
      sendTyping(channelId, true);
      lastTypingSent.current = now;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || !channelId) return;

    try {
      await sendMessage(channelId, content);
      setContent('');
    } catch (err) {
      console.error("Failed to send", err);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as unknown as React.FormEvent);
    }
  };

  if (!channelId) {
    return (
      <div className="p-4 bg-[#030712]">
        <div className="max-w-4xl mx-auto">
          <div className="h-14 rounded-2xl bg-[#0d0d0d] border border-white/5 flex items-center px-4 opacity-50 cursor-not-allowed">
            <span className="text-gray-500 text-sm">Select a channel to send a message...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-gradient-to-t from-[#030712] via-[#030712] to-transparent shrink-0">
      <div className="max-w-4xl mx-auto relative group">
        <TypingIndicator channelId={channelId} />
        
        {/* Glow effect when focused */}
        <div className={`absolute -inset-1 bg-blue-500/20 rounded-3xl blur transition-opacity duration-300 pointer-events-none ${isFocused ? 'opacity-100' : 'opacity-0'}`} />
        
        <form 
          onSubmit={handleSubmit}
          className={`relative rounded-2xl bg-[#0d0d0d] border transition-colors duration-200 flex flex-col ${isFocused ? 'border-blue-500/30' : 'border-white/5 group-hover:border-white/10'}`}
        >
          <textarea
            value={content}
            onChange={(e) => {
              setContent(e.target.value);
              handleTyping();
            }}
            onKeyDown={handleKeyDown}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder={`Message #${placeholderSuffix}...`}
            className="w-full bg-transparent text-white px-4 py-4 resize-none outline-none min-h-[56px] max-h-[40vh] text-[15px] placeholder:text-gray-500 rounded-t-2xl custom-scrollbar"
            rows={1}
          />

          {/* Action formatting bar */}
          <div className="flex items-center justify-between px-3 py-2 bg-white/[0.02] border-t border-white/5 rounded-b-2xl">
            <div className="flex items-center gap-1">
              <button type="button" title="Attach file" className="p-1.5 text-gray-500 hover:text-white hover:bg-white/10 rounded-lg transition-colors">
                <Paperclip size={18} />
              </button>
              <button type="button" title="Mention user" className="p-1.5 text-gray-500 hover:text-white hover:bg-white/10 rounded-lg transition-colors">
                <AtSign size={18} />
              </button>
              <button type="button" title="Add emoji" className="p-1.5 text-gray-500 hover:text-white hover:bg-white/10 rounded-lg transition-colors">
                <Smile size={18} />
              </button>
            </div>

            <motion.button
              type="submit"
              disabled={!content.trim()}
              whileHover={content.trim() ? { scale: 1.05 } : {}}
              whileTap={content.trim() ? { scale: 0.95 } : {}}
              className={`p-1.5 rounded-lg flex items-center justify-center transition-colors ${
                content.trim() 
                  ? 'bg-blue-500 text-white shadow-[0_0_15px_rgba(59,130,246,0.5)]' 
                  : 'bg-white/5 text-gray-600 cursor-not-allowed'
              }`}
            >
              <Send size={16} className={content.trim() ? 'ml-0.5' : ''} />
            </motion.button>
          </div>
        </form>
      </div>
    </div>
  );
};
