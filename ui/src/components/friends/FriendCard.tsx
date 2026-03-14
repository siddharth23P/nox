import React from 'react';
import { motion } from 'framer-motion';
import { MessageSquare, UserMinus, Ban, Check, X, Unlock } from 'lucide-react';
import type { FriendUser } from '../../stores/friendStore';

interface FriendCardProps {
  friend: FriendUser;
  onAccept?: (friendshipId: string) => void;
  onDecline?: (friendshipId: string) => void;
  onRemove?: (friendshipId: string) => void;
  onBlock?: (userId: string) => void;
  onUnblock?: (userId: string) => void;
  onMessage?: (userId: string) => void;
}

export const FriendCard: React.FC<FriendCardProps> = ({
  friend,
  onAccept,
  onDecline,
  onRemove,
  onBlock,
  onUnblock,
  onMessage,
}) => {
  const initials = (friend.full_name || friend.username || '?')
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="flex items-center justify-between p-3 rounded-xl bg-white/[0.03] border border-white/5 hover:bg-white/[0.06] transition-colors group"
      data-testid={`friend-card-${friend.user_id}`}
    >
      <div className="flex items-center gap-3 min-w-0">
        {friend.avatar_url ? (
          <img
            src={friend.avatar_url}
            alt={friend.username}
            className="w-10 h-10 rounded-full object-cover"
          />
        ) : (
          <div className="w-10 h-10 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold text-sm border border-blue-500/20">
            {initials}
          </div>
        )}
        <div className="min-w-0">
          <div className="text-sm font-medium text-white truncate">
            {friend.full_name || friend.username}
          </div>
          <div className="text-xs text-gray-500 truncate">@{friend.username}</div>
        </div>
      </div>

      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {/* Pending received: Accept / Decline */}
        {friend.status === 'pending' && friend.direction === 'received' && (
          <>
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => onAccept?.(friend.friendship_id)}
              className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-colors"
              title="Accept"
              data-testid={`accept-${friend.user_id}`}
            >
              <Check size={16} />
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => onDecline?.(friend.friendship_id)}
              className="p-2 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
              title="Decline"
              data-testid={`decline-${friend.user_id}`}
            >
              <X size={16} />
            </motion.button>
          </>
        )}

        {/* Pending sent: Cancel */}
        {friend.status === 'pending' && friend.direction === 'sent' && (
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => onDecline?.(friend.friendship_id)}
            className="p-2 rounded-lg bg-gray-500/20 text-gray-400 hover:bg-gray-500/30 transition-colors"
            title="Cancel Request"
            data-testid={`cancel-${friend.user_id}`}
          >
            <X size={16} />
          </motion.button>
        )}

        {/* Accepted friends: Message, Remove, Block */}
        {friend.status === 'accepted' && (
          <>
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => onMessage?.(friend.user_id)}
              className="p-2 rounded-lg bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 transition-colors"
              title="Message"
              data-testid={`message-${friend.user_id}`}
            >
              <MessageSquare size={16} />
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => onRemove?.(friend.friendship_id)}
              className="p-2 rounded-lg bg-gray-500/20 text-gray-400 hover:bg-gray-500/30 transition-colors"
              title="Remove Friend"
              data-testid={`remove-${friend.user_id}`}
            >
              <UserMinus size={16} />
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => onBlock?.(friend.user_id)}
              className="p-2 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
              title="Block"
              data-testid={`block-${friend.user_id}`}
            >
              <Ban size={16} />
            </motion.button>
          </>
        )}

        {/* Blocked: Unblock */}
        {friend.status === 'blocked' && (
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => onUnblock?.(friend.user_id)}
            className="p-2 rounded-lg bg-gray-500/20 text-gray-400 hover:bg-gray-500/30 transition-colors"
            title="Unblock"
            data-testid={`unblock-${friend.user_id}`}
          >
            <Unlock size={16} />
          </motion.button>
        )}
      </div>
    </motion.div>
  );
};
