import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, UserPlus, UserMinus, Users, Loader2 } from 'lucide-react';
import { useChannelStore, type ChannelMember } from '../../stores/channelStore';
import type { Channel } from '../../stores/channelStore';

interface ChannelMembersProps {
  channel: Channel;
  isOpen: boolean;
  onClose: () => void;
}

const ChannelMembers: React.FC<ChannelMembersProps> = ({ channel, isOpen, onClose }) => {
  const { members, membersLoading, fetchMembers, addMember, removeMember } = useChannelStore();
  const [newUserId, setNewUserId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  const currentUserStr = localStorage.getItem('nox_user');
  const currentUserId = currentUserStr ? JSON.parse(currentUserStr).id : '';

  useEffect(() => {
    if (isOpen && channel.id) {
      fetchMembers(channel.id);
    }
  }, [isOpen, channel.id, fetchMembers]);

  const handleAddMember = async () => {
    if (!newUserId.trim()) return;
    setIsAdding(true);
    setError(null);
    try {
      await addMember(channel.id, newUserId.trim());
      setNewUserId('');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsAdding(false);
    }
  };

  const handleRemoveMember = async (member: ChannelMember) => {
    setError(null);
    try {
      await removeMember(channel.id, member.user_id);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="w-full max-w-md bg-[#1a1a1a] border border-white/10 rounded-2xl overflow-hidden shadow-2xl"
          >
            <div className="flex items-center justify-between p-4 border-b border-white/5 bg-white/5">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <Users size={18} />
                Members
                <span className="text-sm font-normal text-gray-400">#{channel.name}</span>
              </h3>
              <button
                onClick={onClose}
                title="Close"
                className="p-1 hover:bg-white/10 rounded-full transition-colors text-gray-400 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-4 space-y-4">
              {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-sm text-red-400">
                  {error}
                </div>
              )}

              {/* Add member input */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newUserId}
                  onChange={(e) => setNewUserId(e.target.value)}
                  placeholder="User ID to add..."
                  className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-gray-500 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/25 text-sm"
                  data-testid="member-add-input"
                  onKeyDown={(e) => e.key === 'Enter' && handleAddMember()}
                />
                <button
                  onClick={handleAddMember}
                  disabled={isAdding || !newUserId.trim()}
                  className="px-3 py-2 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 rounded-xl text-white text-sm font-medium flex items-center gap-1.5 transition-colors"
                  data-testid="member-add-btn"
                >
                  <UserPlus size={14} />
                  {isAdding ? 'Adding...' : 'Add'}
                </button>
              </div>

              {/* Member list */}
              <div className="space-y-1 max-h-64 overflow-y-auto">
                {membersLoading ? (
                  <div className="flex items-center justify-center py-8 text-gray-400">
                    <Loader2 size={20} className="animate-spin mr-2" />
                    Loading members...
                  </div>
                ) : members.length === 0 ? (
                  <div className="text-center py-8 text-gray-500 text-sm">
                    No members yet
                  </div>
                ) : (
                  members.map((member) => (
                    <div
                      key={member.user_id}
                      className="flex items-center justify-between p-2 rounded-xl hover:bg-white/5 transition-colors group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500/30 to-purple-500/30 flex items-center justify-center text-sm text-white font-medium">
                          {(member.username || member.user_id.slice(0, 2)).charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-white">
                            {member.username || member.user_id.slice(0, 8)}
                          </p>
                          {member.user_id === channel.created_by && (
                            <span className="text-xs text-blue-400">Creator</span>
                          )}
                          {member.user_id === currentUserId && (
                            <span className="text-xs text-green-400 ml-1">You</span>
                          )}
                        </div>
                      </div>
                      {member.user_id !== currentUserId && (
                        <button
                          onClick={() => handleRemoveMember(member)}
                          className="p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all"
                          title="Remove member"
                          data-testid={`member-remove-${member.user_id}`}
                        >
                          <UserMinus size={14} />
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>

              <div className="text-xs text-gray-500 pt-2 border-t border-white/5">
                {members.length} member{members.length !== 1 ? 's' : ''} in this private channel
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default ChannelMembers;
