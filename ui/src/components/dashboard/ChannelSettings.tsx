import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Archive, ArchiveRestore, Trash2, Save } from 'lucide-react';
import { useChannelStore, type Channel } from '../../stores/channelStore';
import { useMessageStore } from '../../stores/messageStore';

interface ChannelSettingsProps {
  channel: Channel;
  isOpen: boolean;
  onClose: () => void;
}

const ChannelSettings: React.FC<ChannelSettingsProps> = ({ channel, isOpen, onClose }) => {
  const { updateChannel, archiveChannel, unarchiveChannel, deleteChannel } = useChannelStore();
  const { fetchChannels } = useMessageStore();
  const [name, setName] = useState(channel.name);
  const [description, setDescription] = useState(channel.description || '');
  const [topic, setTopic] = useState(channel.topic || '');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const isArchived = !!channel.archived_at;

  useEffect(() => {
    setName(channel.name);
    setDescription(channel.description || '');
    setTopic(channel.topic || '');
  }, [channel]);

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    try {
      await updateChannel(channel.id, {
        name: name.trim() !== channel.name ? name.trim() : undefined,
        description: description.trim() !== (channel.description || '') ? description.trim() : undefined,
        topic: topic.trim() !== (channel.topic || '') ? topic.trim() : undefined,
      });
      await fetchChannels();
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleArchiveToggle = async () => {
    setError(null);
    try {
      if (isArchived) {
        await unarchiveChannel(channel.id);
      } else {
        await archiveChannel(channel.id);
      }
      await fetchChannels();
      onClose();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleDelete = async () => {
    setError(null);
    try {
      await deleteChannel(channel.id);
      await fetchChannels();
      onClose();
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
              <h3 className="text-lg font-semibold text-white">Channel Settings</h3>
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

              {isArchived && (
                <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-xl text-sm text-yellow-400">
                  This channel is archived. Unarchive it to resume messaging.
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Channel Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-gray-500 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/25"
                  data-testid="settings-channel-name"
                  disabled={isArchived}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-gray-500 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/25 resize-none"
                  data-testid="settings-channel-description"
                  disabled={isArchived}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Topic</label>
                <input
                  type="text"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="Current discussion topic"
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-gray-500 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/25"
                  data-testid="settings-channel-topic"
                  disabled={isArchived}
                />
              </div>

              {/* Save button */}
              {!isArchived && (
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="w-full px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 rounded-xl text-white text-sm font-medium flex items-center justify-center gap-2 transition-colors"
                  data-testid="settings-save-btn"
                >
                  <Save size={16} />
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </button>
              )}

              {/* Danger zone */}
              <div className="pt-2 border-t border-white/5 space-y-2">
                <p className="text-xs font-bold uppercase tracking-wider text-gray-500">Danger Zone</p>

                <button
                  onClick={handleArchiveToggle}
                  className={`w-full px-4 py-2 rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
                    isArchived
                      ? 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20'
                      : 'bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-400 border border-yellow-500/20'
                  }`}
                  data-testid="settings-archive-btn"
                >
                  {isArchived ? <ArchiveRestore size={16} /> : <Archive size={16} />}
                  {isArchived ? 'Unarchive Channel' : 'Archive Channel'}
                </button>

                {!showDeleteConfirm ? (
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="w-full px-4 py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-xl text-red-400 text-sm font-medium flex items-center justify-center gap-2 transition-colors"
                    data-testid="settings-delete-btn"
                  >
                    <Trash2 size={16} />
                    Delete Channel
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowDeleteConfirm(false)}
                      className="flex-1 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-gray-300 text-sm font-medium transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleDelete}
                      className="flex-1 px-4 py-2 bg-red-500 hover:bg-red-600 rounded-xl text-white text-sm font-medium transition-colors"
                      data-testid="settings-confirm-delete-btn"
                    >
                      Confirm Delete
                    </button>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default ChannelSettings;
