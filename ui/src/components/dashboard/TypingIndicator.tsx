import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMessageStore } from '../../stores/messageStore';

interface TypingIndicatorProps {
  channelId: string;
}

const EMPTY_ARRAY: string[] = [];

const TypingDots: React.FC = () => (
  <div className="flex gap-[3px] items-center ml-1">
    {[0, 0.2, 0.4].map((delay, i) => (
      <motion.div
        key={i}
        animate={{ y: [0, -3, 0] }}
        transition={{ repeat: Infinity, duration: 0.8, delay }}
        className="w-[5px] h-[5px] bg-blue-400 rounded-full"
      />
    ))}
  </div>
);

const AvatarBubble: React.FC<{ username: string; offset: number }> = ({ username, offset }) => {
  const initial = username.charAt(0).toUpperCase();
  return (
    <motion.div
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0, opacity: 0 }}
      style={{ marginLeft: offset > 0 ? -6 : 0, zIndex: 10 - offset }}
      className="w-6 h-6 rounded-full bg-slate-700 border-2 border-[#030712] flex items-center justify-center text-[10px] font-semibold text-slate-200 shrink-0"
    >
      {initial}
    </motion.div>
  );
};

export const TypingIndicator: React.FC<TypingIndicatorProps> = ({ channelId }) => {
  const typingUsers = useMessageStore((state) => state.typingUsers[channelId] || EMPTY_ARRAY);

  if (typingUsers.length === 0) return null;

  const visible = typingUsers.slice(0, 2);
  const overflow = typingUsers.length - 2;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 5 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 5 }}
        data-testid="typing-indicator"
        className="px-4 py-1 flex items-center gap-1.5"
      >
        <div className="flex items-center">
          {visible.map((username, i) => (
            <AvatarBubble key={username} username={username} offset={i} />
          ))}
          {overflow > 0 && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              style={{ marginLeft: -6, zIndex: 8 }}
              className="w-6 h-6 rounded-full bg-slate-600 border-2 border-[#030712] flex items-center justify-center text-[9px] font-bold text-slate-300 shrink-0"
            >
              +{overflow}
            </motion.div>
          )}
        </div>
        <TypingDots />
      </motion.div>
    </AnimatePresence>
  );
};
