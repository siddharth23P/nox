import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Send, Smile, AtSign, Paperclip, Code } from 'lucide-react';
import { useMessageStore } from '../../stores/messageStore';
import { TypingIndicator } from './TypingIndicator';
import { useWebSocket } from '../../hooks/useWebSocket';
import { ReplyPreview } from './ReplyPreview';

const CODE_LANGUAGES = [
  'javascript', 'typescript', 'python', 'rust', 'go', 'java',
  'c', 'cpp', 'csharp', 'html', 'css', 'json', 'yaml', 'sql',
  'bash', 'ruby', 'php', 'swift', 'kotlin', 'plaintext',
];

interface MessageInputProps {
  channelId: string | undefined;
}

export const MessageInput: React.FC<MessageInputProps> = ({ channelId }) => {
  const [content, setContent] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [showCodeLangPicker, setShowCodeLangPicker] = useState(false);
  const codeLangRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const sendMessage = useMessageStore((state) => state.sendMessage);
  const activeChannel = useMessageStore((state) => state.activeChannel);
  const replyTo = useMessageStore((state) => state.replyTo);
  const setReplyTo = useMessageStore((state) => state.setReplyTo);
  const placeholderSuffix = activeChannel?.name || "general";
  const { sendTyping } = useWebSocket();
  const lastTypingSent = React.useRef<number>(0);

  // Close language picker on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (codeLangRef.current && !codeLangRef.current.contains(e.target as Node)) {
        setShowCodeLangPicker(false);
      }
    };
    if (showCodeLangPicker) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showCodeLangPicker]);

  const insertCodeBlock = (language: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = content.substring(start, end);
    const codeTemplate = `\`\`\`${language}\n${selectedText || ''}\n\`\`\``;

    const before = content.substring(0, start);
    const after = content.substring(end);
    const newContent = before + codeTemplate + after;
    setContent(newContent);
    setShowCodeLangPicker(false);

    // Place cursor inside the code block
    requestAnimationFrame(() => {
      textarea.focus();
      const cursorPos = start + language.length + 4 + (selectedText?.length || 0);
      textarea.selectionStart = cursorPos;
      textarea.selectionEnd = cursorPos;
    });
  };

  const handleTyping = () => {
    if (!channelId) return;
    const now = Date.now();
    if (now - lastTypingSent.current > 3000) {
      sendTyping(channelId, true);
      lastTypingSent.current = now;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || !channelId) return;

    try {
      await sendMessage(channelId, content, undefined, replyTo?.id);
      sendTyping(channelId, false);
      setContent('');
      setReplyTo(null);
    } catch (err) {
      console.error("Failed to send", err);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as unknown as React.FormEvent);
    }
  };

  if (!channelId) {
    return (
      <div className="p-4 bg-[#030712]">
        <div className="max-w-4xl mx-auto">
          <div className="h-14 rounded-2xl bg-[#0d0d0d] border border-white/5 flex items-center px-4 opacity-50 cursor-not-allowed">
            <span className="text-gray-500 text-sm">Select a channel to send a message...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-gradient-to-t from-[#030712] via-[#030712] to-transparent shrink-0">
      <div className="max-w-4xl mx-auto relative group">
        <TypingIndicator channelId={channelId} />
        <ReplyPreview />

        {/* Glow effect when focused */}
        <div className={`absolute -inset-1 bg-blue-500/20 rounded-3xl blur transition-opacity duration-300 pointer-events-none ${isFocused ? 'opacity-100' : 'opacity-0'}`} />

        <form
          onSubmit={handleSubmit}
          className={`relative rounded-2xl bg-[#0d0d0d] border transition-colors duration-200 flex flex-col ${isFocused ? 'border-blue-500/30' : 'border-white/5 group-hover:border-white/10'}`}
        >
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => {
              setContent(e.target.value);
              handleTyping();
            }}
            onKeyDown={handleKeyDown}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder={`Message #${placeholderSuffix}...`}
            className="w-full bg-transparent text-white px-4 py-4 resize-none outline-none min-h-[56px] max-h-[40vh] text-[15px] placeholder:text-gray-500 rounded-t-2xl custom-scrollbar"
            rows={1}
          />

          {/* Action formatting bar */}
          <div className="flex items-center justify-between px-3 py-2 bg-white/[0.02] border-t border-white/5 rounded-b-2xl">
            <div className="flex items-center gap-1">
              <button type="button" title="Attach file" className="p-1.5 text-gray-500 hover:text-white hover:bg-white/10 rounded-lg transition-colors">
                <Paperclip size={18} />
              </button>
              <button type="button" title="Mention user" className="p-1.5 text-gray-500 hover:text-white hover:bg-white/10 rounded-lg transition-colors">
                <AtSign size={18} />
              </button>
              <button type="button" title="Add emoji" className="p-1.5 text-gray-500 hover:text-white hover:bg-white/10 rounded-lg transition-colors">
                <Smile size={18} />
              </button>
              <div className="relative" ref={codeLangRef}>
                <button
                  type="button"
                  title="Insert code block"
                  onClick={() => setShowCodeLangPicker(!showCodeLangPicker)}
                  className={`p-1.5 rounded-lg transition-colors ${
                    showCodeLangPicker
                      ? 'text-blue-400 bg-blue-500/10'
                      : 'text-gray-500 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <Code size={18} />
                </button>
                {showCodeLangPicker && (
                  <div className="absolute bottom-full left-0 mb-2 w-48 max-h-64 overflow-y-auto rounded-xl bg-[#1a1a2e] border border-white/10 shadow-2xl backdrop-blur-xl z-50 custom-scrollbar">
                    <div className="px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-gray-500 border-b border-white/5">
                      Select language
                    </div>
                    {CODE_LANGUAGES.map((lang) => (
                      <button
                        key={lang}
                        type="button"
                        onClick={() => insertCodeBlock(lang)}
                        className="w-full text-left px-3 py-1.5 text-sm text-gray-300 hover:bg-white/10 hover:text-white transition-colors"
                      >
                        {lang}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <motion.button
              type="submit"
              disabled={!content.trim()}
              whileHover={content.trim() ? { scale: 1.05 } : {}}
              whileTap={content.trim() ? { scale: 0.95 } : {}}
              className={`p-1.5 rounded-lg flex items-center justify-center transition-colors ${
                content.trim()
                  ? 'bg-blue-500 text-white shadow-[0_0_15px_rgba(59,130,246,0.5)]'
                  : 'bg-white/5 text-gray-600 cursor-not-allowed'
              }`}
            >
              <Send size={16} className={content.trim() ? 'ml-0.5' : ''} />
            </motion.button>
          </div>
        </form>
      </div>
    </div>
  );
};
