import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Keyboard } from 'lucide-react';
import { getRegisteredShortcuts } from '../../hooks/useKeyboardShortcuts';

interface ShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ShortcutsModal: React.FC<ShortcutsModalProps> = ({ isOpen, onClose }) => {
  const shortcuts = getRegisteredShortcuts();

  // Group by category
  const grouped = shortcuts.reduce<Record<string, typeof shortcuts>>((acc, s) => {
    if (!acc[s.category]) acc[s.category] = [];
    acc[s.category].push(s);
    return acc;
  }, {});

  useEffect(() => {
    if (!isOpen) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleEsc, true);
    return () => window.removeEventListener('keydown', handleEsc, true);
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.15 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg bg-[#111] border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-white/[0.02]">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <Keyboard size={20} className="text-blue-400" />
                Keyboard Shortcuts
              </h2>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
                title="Close"
              >
                <X size={18} />
              </button>
            </div>

            {/* Shortcuts List */}
            <div className="px-6 py-4 max-h-[60vh] overflow-y-auto space-y-6">
              {Object.entries(grouped).map(([category, items]) => (
                <div key={category}>
                  <h3 className="text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-3">
                    {category}
                  </h3>
                  <div className="space-y-2">
                    {items.map((shortcut) => (
                      <div
                        key={shortcut.key}
                        className="flex items-center justify-between py-1.5"
                      >
                        <span className="text-sm text-gray-300">{shortcut.description}</span>
                        <kbd className="px-2 py-1 text-xs font-mono bg-white/5 border border-white/10 rounded-md text-gray-400 min-w-[40px] text-center">
                          {shortcut.display}
                        </kbd>
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              {shortcuts.length === 0 && (
                <div className="text-center text-gray-500 text-sm py-8">
                  No shortcuts registered
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-3 border-t border-white/5 bg-white/[0.02]">
              <p className="text-[11px] text-gray-500 text-center">
                Press <kbd className="px-1.5 py-0.5 bg-white/5 border border-white/10 rounded text-gray-400 font-mono">?</kbd> to toggle this modal
              </p>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
