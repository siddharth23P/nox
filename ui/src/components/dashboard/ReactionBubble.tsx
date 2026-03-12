
interface ReactionBubbleProps {
  emoji: string;
  count: number;
  hasReacted: boolean;
  onClick: () => void;
}

export function ReactionBubble({ emoji, count, hasReacted, onClick }: ReactionBubbleProps) {
  if (count <= 0) return null;

  return (
    <button
      onClick={onClick}
      data-testid="reaction-bubble"
      data-emoji={emoji}
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs font-medium border transition-colors ${
        hasReacted
          ? 'bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100'
          : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
      }`}
    >
      <span>{emoji}</span>
      <span className="reaction-count">{count}</span>
    </button>
  );
}
