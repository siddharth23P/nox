import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PresenceAvatar } from '../common/PresenceAvatar';

interface ReadReceiptsLineProps {
  userIds: string[];
}

export const ReadReceiptsLine: React.FC<ReadReceiptsLineProps> = ({ userIds }) => {
  if (!userIds || userIds.length === 0) return null;

  // Render max 5 avatars, then +N
  const maxAvatars = 5;
  const displayIds = userIds.slice(0, maxAvatars);
  const overflowCount = userIds.length - maxAvatars;

  return (
    <div className="flex items-center gap-1 mt-1 justify-end">
      <AnimatePresence>
        {displayIds.map((uid, index) => {
          const username = 'User';
          return (
            <motion.div
              key={uid}
              initial={{ opacity: 0, scale: 0.5, x: 10 }}
              animate={{ opacity: 1, scale: 1, x: 0 }}
              exit={{ opacity: 0, scale: 0.5 }}
              transition={{ delay: index * 0.05, type: 'spring', stiffness: 300, damping: 20 }}
              title={`Read by ${username}`}
            >
              <PresenceAvatar userId={uid} username={username} size="xs" hideStatus={true} />
            </motion.div>
          );
        })}
      </AnimatePresence>
      {overflowCount > 0 && (
        <span className="text-[10px] text-gray-500 ml-1 font-medium bg-[#2a2a2a] px-1.5 py-0.5 rounded-full border border-white/5">
          +{overflowCount}
        </span>
      )}
    </div>
  );
};
