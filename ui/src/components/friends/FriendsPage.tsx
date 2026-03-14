import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Users, UserPlus, Loader2 } from 'lucide-react';
import { useFriendStore } from '../../stores/friendStore';
import { FriendCard } from './FriendCard';
import { AddFriendModal } from './AddFriendModal';

const TABS = [
  { key: 'all' as const, label: 'All' },
  { key: 'online' as const, label: 'Online' },
  { key: 'pending' as const, label: 'Pending' },
  { key: 'blocked' as const, label: 'Blocked' },
];

export const FriendsPage: React.FC = () => {
  const {
    friends,
    activeTab,
    isLoading,
    error,
    setActiveTab,
    fetchFriends,
    acceptFriendRequest,
    declineFriendRequest,
    removeFriend,
    blockUser,
    unblockUser,
  } = useFriendStore();

  const [showAddModal, setShowAddModal] = useState(false);

  useEffect(() => {
    const statusMap: Record<string, string> = {
      all: 'all',
      online: 'accepted',
      pending: 'pending',
      blocked: 'blocked',
    };
    fetchFriends(statusMap[activeTab]);
  }, [fetchFriends, activeTab]);

  const pendingCount = friends.filter(
    (f) => f.status === 'pending' && f.direction === 'received'
  ).length;

  return (
    <div className="flex-1 flex flex-col h-full bg-[#111111]" data-testid="friends-page">
      {/* Header */}
      <div className="px-6 py-4 border-b border-white/5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Users size={24} className="text-blue-400" />
            <h1 className="text-xl font-bold text-white">Friends</h1>
          </div>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 bg-blue-500/20 text-blue-400 rounded-xl text-sm font-medium hover:bg-blue-500/30 transition-colors flex items-center gap-2"
            data-testid="add-friend-button"
          >
            <UserPlus size={16} />
            Add Friend
          </motion.button>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 mt-4">
          {TABS.map((tab) => (
            <motion.button
              key={tab.key}
              whileHover={{ backgroundColor: 'rgba(255,255,255,0.05)' }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors relative ${
                activeTab === tab.key
                  ? 'bg-white/10 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
              data-testid={`tab-${tab.key}`}
            >
              {tab.label}
              {tab.key === 'pending' && pendingCount > 0 && (
                <span className="ml-1.5 px-1.5 py-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full">
                  {pendingCount}
                </span>
              )}
            </motion.button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {error && (
          <div className="mb-4 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
            {error}
          </div>
        )}

        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={24} className="animate-spin text-gray-500" />
          </div>
        )}

        {!isLoading && friends.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-gray-500">
            <Users size={48} className="mb-4 opacity-50" />
            <p className="text-lg font-medium">
              {activeTab === 'all' && 'No friends yet'}
              {activeTab === 'online' && 'No friends online'}
              {activeTab === 'pending' && 'No pending requests'}
              {activeTab === 'blocked' && 'No blocked users'}
            </p>
            {activeTab === 'all' && (
              <p className="text-sm mt-1">
                Click "Add Friend" to start connecting with people.
              </p>
            )}
          </div>
        )}

        <div className="space-y-2 max-w-2xl">
          {friends.map((friend) => (
            <FriendCard
              key={friend.friendship_id}
              friend={friend}
              onAccept={acceptFriendRequest}
              onDecline={declineFriendRequest}
              onRemove={removeFriend}
              onBlock={blockUser}
              onUnblock={unblockUser}
            />
          ))}
        </div>
      </div>

      {/* Add Friend Modal */}
      <AddFriendModal isOpen={showAddModal} onClose={() => setShowAddModal(false)} />
    </div>
  );
};
