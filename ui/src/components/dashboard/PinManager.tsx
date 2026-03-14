import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import DOMPurify from 'dompurify';
import { X, Pin, Bookmark } from 'lucide-react';
import { useMessageStore } from '../../stores/messageStore';

interface PinManagerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PinManager: React.FC<PinManagerProps> = ({ isOpen, onClose }) => {
  const { messages, threadMessages } = useMessageStore();
  const [activeTab, setActiveTab] = useState<'pins' | 'bookmarks'>('pins');

  // Gather all loaded messages
  const allMessages = [...messages, ...threadMessages].filter((v, i, a) => a.findIndex(t => t.id === v.id) === i);
  
  const pinnedMessages = allMessages.filter(m => m.is_pinned);
  const bookmarkedMessages = allMessages.filter(m => m.is_bookmarked);

  const displayList = activeTab === 'pins' ? pinnedMessages : bookmarkedMessages;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div 
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className="w-80 h-full bg-[#050914] border-l border-white/10 shrink-0 flex flex-col z-20 shadow-2xl relative"
        >
          <div className="h-14 border-b border-white/5 flex items-center justify-between px-4 shrink-0 bg-[#030712]/50 backdrop-blur-md">
            <h3 className="text-white font-medium flex items-center gap-2">
              <Pin size={16} className="text-yellow-500" />
              Saved Items
            </h3>
            <button 
              onClick={onClose}
              className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
              aria-label="Close Saved Items"
            >
              <X size={18} />
            </button>
          </div>

          <div className="flex border-b border-white/5 px-2 pt-2 gap-2">
            <button
              onClick={() => setActiveTab('pins')}
              className={`flex-1 pb-2 text-sm font-medium border-b-2 transition-colors flex items-center justify-center gap-1.5 ${
                activeTab === 'pins' ? 'border-yellow-500 text-yellow-500' : 'border-transparent text-gray-500 hover:text-gray-300'
              }`}
            >
              <Pin size={14} /> Channel Pins
            </button>
            <button
              onClick={() => setActiveTab('bookmarks')}
              className={`flex-1 pb-2 text-sm font-medium border-b-2 transition-colors flex items-center justify-center gap-1.5 ${
                activeTab === 'bookmarks' ? 'border-blue-500 text-blue-500' : 'border-transparent text-gray-500 hover:text-gray-300'
              }`}
            >
              <Bookmark size={14} /> My Bookmarks
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
            {displayList.length === 0 ? (
              <div className="text-center text-gray-500 mt-10 text-sm">
                No {activeTab === 'pins' ? 'pinned' : 'bookmarked'} messages yet.
              </div>
            ) : (
              <div className="space-y-4">
                {displayList.map(msg => (
                  <div key={msg.id} className="bg-white/5 p-3 rounded-lg border border-white/10 hover:border-white/20 transition-colors cursor-pointer text-sm">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-gray-200">{msg.username || 'User'}</span>
                      <span className="text-[10px] text-gray-500">
                        {new Date(msg.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="text-gray-300 line-clamp-3 leading-relaxed" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(msg.content_html || msg.content_md) }} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
