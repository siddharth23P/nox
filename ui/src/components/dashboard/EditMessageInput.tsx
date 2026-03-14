import React, { useState } from 'react';

interface EditMessageInputProps {
  initialContent: string;
  onSave: (content: string) => void;
  onCancel: () => void;
}

export const EditMessageInput: React.FC<EditMessageInputProps> = ({ initialContent, onSave, onCancel }) => {
  const [editContent, setEditContent] = useState(initialContent);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSave(editContent.trim());
    }
    if (e.key === 'Escape') {
      onCancel();
    }
  };

  return (
    <div className="w-full max-w-lg mt-1 relative z-10 flex flex-col gap-2">
      <textarea
        value={editContent}
        onChange={(e) => setEditContent(e.target.value)}
        aria-label="Edit message"
        placeholder="Edit your message..."
        className={`w-full bg-[#2a2a2a] border border-white/10 rounded-xl p-3 text-sm text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none min-h-[80px] custom-scrollbar`}
        autoFocus
        onKeyDown={handleKeyDown}
      />
      <div className="flex items-center gap-2 text-xs">
        <button
          onClick={() => onCancel()}
          className="px-3 py-1.5 text-gray-400 hover:text-white transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={() => onSave(editContent.trim())}
          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium transition-colors"
          disabled={!editContent.trim()}
        >
          Save
        </button>
      </div>
    </div>
  );
};
