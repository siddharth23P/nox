import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Send, Hash, Lock } from 'lucide-react';
import { useMessageStore } from '../../stores/messageStore';
import type { Message } from '../../stores/messageStore';

interface ForwardModalProps {
  message: Message;
  isOpen: boolean;
  onClose: () => void;
}

const ForwardModal: React.FC<ForwardModalProps> = ({ message, isOpen, onClose }) => {
  const { channels, forwardMessage } = useMessageStore();
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);
  const [isForwarding, setIsForwarding] = useState(false);

  const handleForward = async () => {
    if (!selectedChannelId) return;
    
    setIsForwarding(true);
    try {
      await forwardMessage(message.id, selectedChannelId);
      onClose();
    } catch (err) {
      console.error('Forwarding failed:', err);
    } finally {
      setIsForwarding(false);
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
                <Send size={18} className="text-blue-400" />
                Forward Message
              </h3>
              <button 
                onClick={onClose}
                title="Close"
                className="p-1 hover:bg-white/10 rounded-full transition-colors text-gray-400 hover:text-white"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div className="bg-white/5 rounded-lg p-3 border border-white/5">
                <p className="text-xs text-gray-400 mb-1">Message Preview</p>
                <p className="text-sm text-gray-200 line-clamp-3 italic">
                  "{message.content_md}"
                </p>
              </div>

              <div>
                <p className="text-sm font-medium text-gray-300 mb-2">Select Channel</p>
                <div className="max-h-60 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                  {channels.map((channel) => (
                    <button
                      key={channel.id}
                      onClick={() => setSelectedChannelId(channel.id)}
                      className={`w-full flex items-center justify-between p-3 rounded-xl transition-all ${
                        selectedChannelId === channel.id
                          ? 'bg-blue-500/20 border-blue-500/50 text-white'
                          : 'bg-white/5 border-transparent text-gray-400 hover:bg-white/10 hover:text-gray-200'
                      } border`}
                    >
                      <div className="flex items-center gap-2">
                        {channel.is_private ? <Lock size={14} /> : <Hash size={14} />}
                        <span className="font-medium">{channel.name}</span>
                      </div>
                      {selectedChannelId === channel.id && (
                        <div className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-4 bg-black/20 border-t border-white/5 flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white font-medium transition-all"
              >
                Cancel
              </button>
              <button
                disabled={!selectedChannelId || isForwarding}
                onClick={handleForward}
                className={`flex-1 px-4 py-2.5 rounded-xl font-medium transition-all flex items-center justify-center gap-2 ${
                  !selectedChannelId || isForwarding
                    ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/20'
                }`}
              >
                {isForwarding ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <Send size={18} />
                    Forward
                  </>
                )}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default ForwardModal;
