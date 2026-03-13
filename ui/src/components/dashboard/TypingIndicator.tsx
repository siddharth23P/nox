import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMessageStore } from '../../stores/messageStore';

interface TypingIndicatorProps {
  channelId: string;
}

const EMPTY_ARRAY: string[] = [];

export const TypingIndicator: React.FC<TypingIndicatorProps> = ({ channelId }) => {
  const typingUsers = useMessageStore((state) => state.typingUsers[channelId] || EMPTY_ARRAY);

  if (typingUsers.length === 0) return null;

  const text = typingUsers.length === 1 
    ? `${typingUsers[0]} is typing...`
    : typingUsers.length === 2
    ? `${typingUsers[0]} and ${typingUsers[1]} are typing...`
    : 'Multiple people are typing...';

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 5 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 5 }}
        className="px-4 py-1 text-[11px] text-gray-500 font-medium flex items-center gap-2"
      >
        <div className="flex gap-1">
          <motion.div 
            animate={{ opacity: [0.4, 1, 0.4] }}
            transition={{ repeat: Infinity, duration: 1.2, delay: 0 }}
            className="w-1 h-1 bg-gray-500 rounded-full" 
          />
          <motion.div 
            animate={{ opacity: [0.4, 1, 0.4] }}
            transition={{ repeat: Infinity, duration: 1.2, delay: 0.2 }}
            className="w-1 h-1 bg-gray-500 rounded-full" 
          />
          <motion.div 
            animate={{ opacity: [0.4, 1, 0.4] }}
            transition={{ repeat: Infinity, duration: 1.2, delay: 0.4 }}
            className="w-1 h-1 bg-gray-500 rounded-full" 
          />
        </div>
        <span>{text}</span>
      </motion.div>
    </AnimatePresence>
  );
};
