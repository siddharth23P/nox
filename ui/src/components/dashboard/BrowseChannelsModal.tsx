import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Hash, Users, Search } from 'lucide-react';
import { useMessageStore, type BrowsableChannel } from '../../stores/messageStore';

interface BrowseChannelsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const BrowseChannelsModal: React.FC<BrowseChannelsModalProps> = ({ isOpen, onClose }) => {
  const { browseChannels, joinChannel, leaveChannel, setActiveChannel, fetchJoinedChannels } = useMessageStore();
  const [channels, setChannels] = useState<BrowsableChannel[]>([]);
  const [filteredChannels, setFilteredChannels] = useState<BrowsableChannel[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadChannels();
    }
    return () => {
      setSearchQuery('');
      setError(null);
    };
  }, [isOpen]);

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredChannels(channels);
    } else {
      const q = searchQuery.toLowerCase();
      setFilteredChannels(
        channels.filter(
          (ch) =>
            ch.name.toLowerCase().includes(q) ||
            (ch.description && ch.description.toLowerCase().includes(q))
        )
      );
    }
  }, [searchQuery, channels]);

  const loadChannels = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await browseChannels();
      setChannels(data);
      setFilteredChannels(data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleJoin = async (channel: BrowsableChannel) => {
    setJoiningId(channel.id);
    try {
      await joinChannel(channel.id);
      // Update local state to reflect the join
      setChannels((prev) =>
        prev.map((ch) =>
          ch.id === channel.id ? { ...ch, is_joined: true, member_count: ch.member_count + 1 } : ch
        )
      );
      // Auto-select the channel after joining
      setActiveChannel({
        id: channel.id,
        org_id: channel.org_id,
        name: channel.name,
        description: channel.description ?? undefined,
        topic: channel.topic ?? undefined,
        is_private: channel.is_private,
        created_by: channel.created_by ?? undefined,
        created_at: channel.created_at,
        updated_at: channel.updated_at,
      });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setJoiningId(null);
    }
  };

  const handleLeave = async (channel: BrowsableChannel) => {
    setJoiningId(channel.id);
    try {
      await leaveChannel(channel.id);
      // Update local state to reflect the leave
      setChannels((prev) =>
        prev.map((ch) =>
          ch.id === channel.id ? { ...ch, is_joined: false, member_count: Math.max(0, ch.member_count - 1) } : ch
        )
      );
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setJoiningId(null);
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
            className="w-full max-w-lg bg-[#1a1a1a] border border-white/10 rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[80vh]"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-white/5 bg-white/5">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <Hash size={18} className="text-blue-400" />
                Browse Channels
              </h3>
              <button
                onClick={onClose}
                title="Close"
                className="p-1 hover:bg-white/10 rounded-full transition-colors text-gray-400 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            {/* Search */}
            <div className="p-4 border-b border-white/5">
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search channels..."
                  className="w-full pl-9 pr-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-gray-500 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/25 text-sm"
                  data-testid="browse-channels-search"
                />
              </div>
            </div>

            {/* Channel List */}
            <div className="flex-1 overflow-y-auto p-2">
              {error && (
                <div className="p-3 m-2 bg-red-500/10 border border-red-500/20 rounded-xl text-sm text-red-400">
                  {error}
                </div>
              )}

              {isLoading ? (
                <div className="flex items-center justify-center py-12 text-gray-500 text-sm">
                  Loading channels...
                </div>
              ) : filteredChannels.length === 0 ? (
                <div className="flex items-center justify-center py-12 text-gray-500 text-sm">
                  {searchQuery ? 'No channels match your search' : 'No public channels available'}
                </div>
              ) : (
                filteredChannels.map((channel) => (
                  <motion.div
                    key={channel.id}
                    whileHover={{ backgroundColor: 'rgba(255,255,255,0.03)' }}
                    className="flex items-center justify-between p-3 rounded-xl group"
                  >
                    <div className="flex-1 min-w-0 mr-3">
                      <div className="flex items-center gap-2">
                        <Hash size={14} className="text-gray-500 flex-shrink-0" />
                        <span className="text-sm font-medium text-white truncate">{channel.name}</span>
                      </div>
                      {channel.description && (
                        <p className="text-xs text-gray-500 mt-0.5 truncate pl-5">{channel.description}</p>
                      )}
                      <div className="flex items-center gap-1 mt-1 pl-5">
                        <Users size={11} className="text-gray-600" />
                        <span className="text-[11px] text-gray-600">
                          {channel.member_count} {channel.member_count === 1 ? 'member' : 'members'}
                        </span>
                      </div>
                    </div>

                    <div className="flex-shrink-0">
                      {channel.is_joined ? (
                        <button
                          onClick={() => handleLeave(channel)}
                          disabled={joiningId === channel.id}
                          className="px-3 py-1.5 bg-white/5 hover:bg-red-500/10 border border-white/10 hover:border-red-500/20 rounded-lg text-xs font-medium text-gray-400 hover:text-red-400 transition-colors disabled:opacity-50"
                          data-testid={`leave-channel-${channel.id}`}
                        >
                          {joiningId === channel.id ? '...' : 'Joined'}
                        </button>
                      ) : (
                        <button
                          onClick={() => handleJoin(channel)}
                          disabled={joiningId === channel.id}
                          className="px-3 py-1.5 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-xs font-medium text-white transition-colors"
                          data-testid={`join-channel-${channel.id}`}
                        >
                          {joiningId === channel.id ? 'Joining...' : 'Join'}
                        </button>
                      )}
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default BrowseChannelsModal;
