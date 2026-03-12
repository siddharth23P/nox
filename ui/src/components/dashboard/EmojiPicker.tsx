
const STANDARD_EMOJIS = ['👍', '❤️', '😂', '🚀', '👀', '🎉'];

interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
  onClose: () => void;
}

export function EmojiPicker({ onSelect, onClose }: EmojiPickerProps) {
  return (
    <div data-testid="emoji-picker" className="absolute z-50 bg-white border border-gray-200 rounded-lg shadow-lg p-2 flex gap-1 -top-10 right-0 animate-in fade-in zoom-in duration-150">
      {STANDARD_EMOJIS.map(emoji => (
        <button
          key={emoji}
          data-emoji={emoji}
          onClick={() => {
            onSelect(emoji);
            onClose();
          }}
          className="w-8 h-8 flex items-center justify-center hover:bg-gray-100 rounded text-xl transition-colors"
        >
          {emoji}
        </button>
      ))}
    </div>
  );
}
