import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import DOMPurify from 'dompurify';
import { X, Clock } from 'lucide-react';
import { useMessageStore, type MessageEdit } from '../../stores/messageStore';

interface EditHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  channelId: string;
  messageId: string;
}

export const EditHistoryModal: React.FC<EditHistoryModalProps> = ({ isOpen, onClose, channelId, messageId }) => {
  const { getMessageHistory } = useMessageStore();
  const [history, setHistory] = useState<MessageEdit[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && channelId && messageId) {
      const fetchHistory = async () => {
        setIsLoading(true);
        setError(null);
        try {
          const data = await getMessageHistory(channelId, messageId);
          setHistory(data);
        } catch (err) {
          setError((err as Error).message);
        } finally {
          setIsLoading(false);
        }
      };
      fetchHistory();
    }
  }, [isOpen, channelId, messageId, getMessageHistory]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        />
        
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="relative w-full max-w-2xl bg-[#1e1e1e] rounded-2xl shadow-2xl overflow-hidden border border-white/10 flex flex-col max-h-[80vh]"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 shrink-0">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-blue-400" />
              <h2 className="text-lg font-semibold text-white">Edit History</h2>
            </div>
            <button
              onClick={onClose}
              aria-label="Close"
              className="p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
            {isLoading ? (
              <div className="flex justify-center py-8 text-gray-400">Loading history...</div>
            ) : error ? (
              <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
                {error}
              </div>
            ) : history.length === 0 ? (
              <div className="text-center py-8 text-gray-500">No edits found for this message.</div>
            ) : (
              <div className="space-y-6">
                {history.map((edit) => (
                  <div key={edit.id} className="relative pl-6 border-l-2 border-white/5 pb-2">
                    <div className="absolute w-3 h-3 bg-blue-500 rounded-full -left-[7px] top-1.5 ring-4 ring-[#1e1e1e]" />
                    <div className="text-xs text-gray-400 font-medium mb-2">
                      {new Date(edit.created_at).toLocaleString()}
                    </div>
                    <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                      <div className="text-xs text-gray-500 mb-1 uppercase tracking-wider font-semibold">Previous Content</div>
                      <div 
                        className="text-gray-300 text-sm whitespace-pre-wrap"
                        dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(edit.old_content_html || edit.old_content_md) }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
