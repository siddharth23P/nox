import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Search, UserPlus, Loader2 } from 'lucide-react';
import { useFriendStore } from '../../stores/friendStore';

interface AddFriendModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AddFriendModal: React.FC<AddFriendModalProps> = ({ isOpen, onClose }) => {
  const { searchResults, searchUsers, sendFriendRequest, clearSearch, isLoading } = useFriendStore();
  const [query, setQuery] = useState('');
  const [sentTo, setSentTo] = useState<Set<string>>(new Set());
  const [successMessage, setSuccessMessage] = useState('');

  const handleClose = useCallback(() => {
    setQuery('');
    clearSearch();
    setSentTo(new Set());
    setSuccessMessage('');
    onClose();
  }, [onClose, clearSearch]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (query.length >= 1) {
        searchUsers(query);
      } else {
        clearSearch();
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query, searchUsers, clearSearch]);

  const handleSendRequest = async (userId: string, username: string) => {
    const success = await sendFriendRequest(userId);
    if (success) {
      setSentTo((prev) => new Set(prev).add(userId));
      setSuccessMessage(`Friend request sent to ${username}!`);
      setTimeout(() => setSuccessMessage(''), 3000);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={handleClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2 }}
            className="w-full max-w-md bg-[#1a1a1a] border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
            data-testid="add-friend-modal"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-white/5">
              <h2 className="text-lg font-semibold text-white">Add Friend</h2>
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleClose}
                className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
              >
                <X size={20} />
              </motion.button>
            </div>

            {/* Search Input */}
            <div className="p-4">
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <input
                  type="text"
                  placeholder="Search by username..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 text-sm focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20"
                  autoFocus
                  data-testid="friend-search-input"
                />
              </div>

              {/* Success Message */}
              <AnimatePresence>
                {successMessage && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="mt-3 px-3 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400 text-sm"
                  >
                    {successMessage}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Results */}
            <div className="px-4 pb-4 max-h-64 overflow-y-auto space-y-2">
              {isLoading && (
                <div className="flex items-center justify-center py-4">
                  <Loader2 size={20} className="animate-spin text-gray-500" />
                </div>
              )}

              {!isLoading && query.length >= 1 && searchResults.length === 0 && (
                <p className="text-center text-gray-500 text-sm py-4">No users found</p>
              )}

              {searchResults.map((user) => {
                const alreadySent = sentTo.has(user.user_id);
                const initials = (user.full_name || user.username || '?')
                  .split(' ')
                  .map((n) => n[0])
                  .join('')
                  .toUpperCase()
                  .slice(0, 2);

                return (
                  <motion.div
                    key={user.user_id}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center justify-between p-3 rounded-xl bg-white/[0.03] border border-white/5"
                    data-testid={`search-result-${user.user_id}`}
                  >
                    <div className="flex items-center gap-3">
                      {user.avatar_url ? (
                        <img
                          src={user.avatar_url}
                          alt={user.username}
                          className="w-9 h-9 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold text-xs border border-blue-500/20">
                          {initials}
                        </div>
                      )}
                      <div>
                        <div className="text-sm font-medium text-white">
                          {user.full_name || user.username}
                        </div>
                        <div className="text-xs text-gray-500">@{user.username}</div>
                      </div>
                    </div>

                    <motion.button
                      whileHover={{ scale: alreadySent ? 1 : 1.05 }}
                      whileTap={{ scale: alreadySent ? 1 : 0.95 }}
                      onClick={() => !alreadySent && handleSendRequest(user.user_id, user.username)}
                      disabled={alreadySent}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors ${
                        alreadySent
                          ? 'bg-gray-500/20 text-gray-500 cursor-default'
                          : 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30'
                      }`}
                      data-testid={`send-request-${user.user_id}`}
                    >
                      <UserPlus size={14} />
                      {alreadySent ? 'Sent' : 'Add'}
                    </motion.button>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
