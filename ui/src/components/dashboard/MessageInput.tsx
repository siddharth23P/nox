import React, { useState, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Send, Smile, AtSign, Paperclip, Code, Bold, Italic, Strikethrough, List, ListOrdered, Quote, Eye, EyeOff } from 'lucide-react';
import { useMessageStore } from '../../stores/messageStore';
import { TypingIndicator } from './TypingIndicator';
import { useWebSocket } from '../../hooks/useWebSocket';
import { ReplyPreview } from './ReplyPreview';
import { MentionAutocomplete } from './MentionAutocomplete';
import { FormattedMessage } from '../common/FormattedMessage';
import { encodeMention } from '../../utils/mentions';
import type { MentionUser } from '../../utils/mentions';


interface MessageInputProps {
  channelId: string | undefined;
}

/**
 * Wraps selected text (or inserts at cursor) with markdown syntax.
 * For prefix-only formats (lists, blockquote), inserts at line start.
 */
function applyFormat(
  textarea: HTMLTextAreaElement,
  content: string,
  format: 'bold' | 'italic' | 'strikethrough' | 'code' | 'bullet' | 'numbered' | 'blockquote'
): { newContent: string; cursorPos: number } {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const selected = content.substring(start, end);
  const before = content.substring(0, start);
  const after = content.substring(end);

  let wrapper = '';
  let prefix = '';

  switch (format) {
    case 'bold': wrapper = '**'; break;
    case 'italic': wrapper = '_'; break;
    case 'strikethrough': wrapper = '~~'; break;
    case 'code': wrapper = '`'; break;
    case 'bullet': prefix = '- '; break;
    case 'numbered': prefix = '1. '; break;
    case 'blockquote': prefix = '> '; break;
  }

  if (prefix) {
    // Line-start format: apply prefix to each selected line or insert at current line start
    if (selected) {
      const formatted = selected.split('\n').map(line => `${prefix}${line}`).join('\n');
      return { newContent: before + formatted + after, cursorPos: start + formatted.length };
    }
    // Find start of current line
    const lineStart = before.lastIndexOf('\n') + 1;
    const beforeLine = content.substring(0, lineStart);
    const currentLine = content.substring(lineStart, start);
    return {
      newContent: beforeLine + prefix + currentLine + after,
      cursorPos: start + prefix.length,
    };
  }

  // Wrapper format
  if (selected) {
    // Check if already wrapped — toggle off
    if (before.endsWith(wrapper) && after.startsWith(wrapper)) {
      return {
        newContent: before.slice(0, -wrapper.length) + selected + after.slice(wrapper.length),
        cursorPos: start - wrapper.length + selected.length,
      };
    }
    return {
      newContent: before + wrapper + selected + wrapper + after,
      cursorPos: start + wrapper.length + selected.length,
    };
  }

  // No selection: insert wrapper pair and place cursor inside
  return {
    newContent: before + wrapper + wrapper + after,
    cursorPos: start + wrapper.length,
  };
}

export const MessageInput: React.FC<MessageInputProps> = ({ channelId }) => {
  const [content, setContent] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [codeMode, setCodeMode] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const sendMessage = useMessageStore((state) => state.sendMessage);
  const activeChannel = useMessageStore((state) => state.activeChannel);
  const replyTo = useMessageStore((state) => state.replyTo);
  const setReplyTo = useMessageStore((state) => state.setReplyTo);
  const placeholderSuffix = activeChannel?.name || "general";
  const { sendTyping } = useWebSocket();
  const lastTypingSent = React.useRef<number>(0);

  // Mention autocomplete state
  const [mentionActive, setMentionActive] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionStartPos, setMentionStartPos] = useState<number>(0);

  const toggleCodeMode = () => {
    const textarea = textareaRef.current;
    if (!textarea) { setCodeMode(v => !v); return; }

    if (!codeMode) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const selectedText = content.substring(start, end);

      if (selectedText) {
        const before = content.substring(0, start);
        const after = content.substring(end);
        const newContent = `${before}\`\`\`\n${selectedText}\n\`\`\`${after}`;
        setContent(newContent);
        requestAnimationFrame(() => {
          textarea.focus();
          const cursorPos = start + 4 + selectedText.length;
          textarea.selectionStart = cursorPos;
          textarea.selectionEnd = cursorPos;
        });
      } else if (!content.includes('```')) {
        const newContent = content ? `\`\`\`\n${content}\n\`\`\`` : '```\n\n```';
        setContent(newContent);
        requestAnimationFrame(() => {
          textarea.focus();
          const cursorPos = 4 + (content ? content.length : 0);
          textarea.selectionStart = cursorPos;
          textarea.selectionEnd = cursorPos;
        });
      }
    } else {
      const stripped = content.replace(/^```\n?/, '').replace(/\n?```$/, '');
      setContent(stripped);
      requestAnimationFrame(() => {
        textarea.focus();
        textarea.selectionStart = stripped.length;
        textarea.selectionEnd = stripped.length;
      });
    }
    setCodeMode(v => !v);
  };

  const handleFormat = useCallback((format: 'bold' | 'italic' | 'strikethrough' | 'code' | 'bullet' | 'numbered' | 'blockquote') => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const { newContent, cursorPos } = applyFormat(textarea, content, format);
    setContent(newContent);
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.selectionStart = cursorPos;
      textarea.selectionEnd = cursorPos;
    });
  }, [content]);

  const handleTyping = () => {
    if (!channelId) return;
    const now = Date.now();
    if (now - lastTypingSent.current > 3000) {
      sendTyping(channelId, true);
      lastTypingSent.current = now;
    }
  };

  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    const cursorPos = e.target.selectionStart ?? value.length;
    setContent(value);
    handleTyping();

    const textBeforeCursor = value.slice(0, cursorPos);
    const atIdx = textBeforeCursor.lastIndexOf('@');

    if (atIdx >= 0) {
      const charBefore = atIdx > 0 ? textBeforeCursor[atIdx - 1] : ' ';
      const queryText = textBeforeCursor.slice(atIdx + 1);
      if ((/\s/.test(charBefore) || atIdx === 0) && !queryText.includes(' ') && queryText.length <= 30) {
        setMentionActive(true);
        setMentionQuery(queryText);
        setMentionStartPos(atIdx);
        return;
      }
    }
    if (mentionActive) {
      setMentionActive(false);
      setMentionQuery('');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mentionActive]);

  const handleMentionSelect = useCallback((user: MentionUser) => {
    const encoded = encodeMention(user);
    const before = content.slice(0, mentionStartPos);
    const after = content.slice(mentionStartPos + 1 + mentionQuery.length);
    const newContent = before + encoded + ' ' + after;
    setContent(newContent);
    setMentionActive(false);
    setMentionQuery('');

    requestAnimationFrame(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        const newPos = before.length + encoded.length + 1;
        textareaRef.current.setSelectionRange(newPos, newPos);
      }
    });
  }, [content, mentionStartPos, mentionQuery]);

  const handleMentionClose = useCallback(() => {
    setMentionActive(false);
    setMentionQuery('');
  }, []);

  const handleAtButtonClick = useCallback(() => {
    if (!textareaRef.current) return;
    const ta = textareaRef.current;
    const pos = ta.selectionStart ?? content.length;
    const before = content.slice(0, pos);
    const after = content.slice(pos);
    const needsSpace = before.length > 0 && !/\s$/.test(before);
    const insert = (needsSpace ? ' ' : '') + '@';
    const newContent = before + insert + after;
    setContent(newContent);

    const newPos = pos + insert.length;
    setMentionActive(true);
    setMentionQuery('');
    setMentionStartPos(newPos - 1);

    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(newPos, newPos);
    });
  }, [content]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || !channelId) return;

    if (mentionActive) {
      setMentionActive(false);
      setMentionQuery('');
    }

    try {
      await sendMessage(channelId, content, undefined, replyTo?.id);
      sendTyping(channelId, false);
      setContent('');
      setReplyTo(null);
      setShowPreview(false);
    } catch (err) {
      console.error("Failed to send", err);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Let the mention autocomplete handle navigation keys via its window listener
    if (mentionActive && ['ArrowDown', 'ArrowUp', 'Enter', 'Tab', 'Escape'].includes(e.key)) {
      return;
    }

    const mod = e.metaKey || e.ctrlKey;

    // Formatting shortcuts
    if (mod && e.key === 'b') {
      e.preventDefault();
      handleFormat('bold');
      return;
    }
    if (mod && e.key === 'i') {
      e.preventDefault();
      handleFormat('italic');
      return;
    }
    if (mod && e.shiftKey && e.key === 'x') {
      e.preventDefault();
      handleFormat('strikethrough');
      return;
    }
    if (mod && e.key === 'e') {
      e.preventDefault();
      handleFormat('code');
      return;
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as unknown as React.FormEvent);
    }
  };

  if (!channelId) {
    return (
      <div className="p-4" style={{ backgroundColor: 'var(--nox-bg-primary)' }}>
        <div className="max-w-4xl mx-auto">
          <div className="h-14 rounded-2xl flex items-center px-4 opacity-50 cursor-not-allowed" style={{ backgroundColor: 'var(--nox-input-bg)', border: '1px solid var(--nox-border)' }}>
            <span className="text-sm" style={{ color: 'var(--nox-text-muted)' }}>Select a channel to send a message...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-2 md:p-6 shrink-0" style={{ background: `linear-gradient(to top, var(--nox-bg-primary), var(--nox-bg-primary), transparent)` }}>
      <div className="max-w-4xl mx-auto relative group">
        <TypingIndicator channelId={channelId} />
        <ReplyPreview />

        {/* Glow effect when focused */}
        <div className={`absolute -inset-1 bg-blue-500/20 rounded-3xl blur transition-opacity duration-300 pointer-events-none ${isFocused ? 'opacity-100' : 'opacity-0'}`} />

        <form
          onSubmit={handleSubmit}
          className={`relative rounded-2xl border transition-colors duration-200 flex flex-col ${isFocused ? 'border-blue-500/30' : ''}`}
          style={{ backgroundColor: 'var(--nox-input-bg)', borderColor: isFocused ? undefined : 'var(--nox-input-border)' }}
        >
          {/* Mention Autocomplete Dropdown */}
          <MentionAutocomplete
            query={mentionQuery}
            onSelect={handleMentionSelect}
            onClose={handleMentionClose}
            visible={mentionActive}
          />

          {/* Formatting toolbar */}
          <div className="flex items-center gap-0.5 px-3 pt-2 pb-0.5">
            <button type="button" title="Bold (Cmd+B)" onClick={() => handleFormat('bold')} className="p-1 text-gray-500 hover:text-white hover:bg-white/10 rounded transition-colors">
              <Bold size={15} />
            </button>
            <button type="button" title="Italic (Cmd+I)" onClick={() => handleFormat('italic')} className="p-1 text-gray-500 hover:text-white hover:bg-white/10 rounded transition-colors">
              <Italic size={15} />
            </button>
            <button type="button" title="Strikethrough (Cmd+Shift+X)" onClick={() => handleFormat('strikethrough')} className="p-1 text-gray-500 hover:text-white hover:bg-white/10 rounded transition-colors">
              <Strikethrough size={15} />
            </button>
            <div className="w-px h-4 bg-white/10 mx-1" />
            <button type="button" title="Inline code (Cmd+E)" onClick={() => handleFormat('code')} className="p-1 text-gray-500 hover:text-white hover:bg-white/10 rounded transition-colors">
              <Code size={15} />
            </button>
            <button type="button" title="Bullet list" onClick={() => handleFormat('bullet')} className="p-1 text-gray-500 hover:text-white hover:bg-white/10 rounded transition-colors">
              <List size={15} />
            </button>
            <button type="button" title="Numbered list" onClick={() => handleFormat('numbered')} className="p-1 text-gray-500 hover:text-white hover:bg-white/10 rounded transition-colors">
              <ListOrdered size={15} />
            </button>
            <button type="button" title="Blockquote" onClick={() => handleFormat('blockquote')} className="p-1 text-gray-500 hover:text-white hover:bg-white/10 rounded transition-colors">
              <Quote size={15} />
            </button>
            <div className="flex-1" />
            <button
              type="button"
              title={showPreview ? 'Hide preview' : 'Preview markdown'}
              onClick={() => setShowPreview(v => !v)}
              className={`p-1 rounded transition-colors ${showPreview ? 'text-blue-400 bg-blue-500/10' : 'text-gray-500 hover:text-white hover:bg-white/10'}`}
            >
              {showPreview ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>

          {showPreview && content.trim() ? (
            <div className="px-4 py-3 min-h-[56px] max-h-[40vh] overflow-y-auto border-b border-white/5 custom-scrollbar">
              <FormattedMessage content={content} className="text-gray-300 text-[15px]" />
            </div>
          ) : null}

          <textarea
            ref={textareaRef}
            value={content}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder={codeMode ? 'Paste or type code...' : `Message #${placeholderSuffix}...`}
            className={`w-full bg-transparent px-4 py-3 resize-none outline-none min-h-[56px] max-h-[40vh] custom-scrollbar ${
              codeMode
                ? 'font-mono text-[13px] leading-relaxed bg-[#0d1117]/60'
                : 'text-[15px]'
            }`}
            rows={1}
          />

          {/* Action bar */}
          <div className="flex items-center justify-between px-3 py-2 bg-white/[0.02] border-t border-white/5 rounded-b-2xl">
            <div className="flex items-center gap-1">
              <button type="button" title="Attach file" className="p-1.5 text-gray-500 hover:text-white hover:bg-white/10 rounded-lg transition-colors">
                <Paperclip size={18} />
              </button>
              <button
                type="button"
                title="Mention user"
                onClick={handleAtButtonClick}
                className="p-1.5 text-gray-500 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
              >
                <AtSign size={18} />
              </button>
              <button type="button" title="Add emoji" className="p-1.5 text-gray-500 hover:text-white hover:bg-white/10 rounded-lg transition-colors">
                <Smile size={18} />
              </button>
              <button
                type="button"
                title={codeMode ? 'Exit code mode' : 'Code block'}
                onClick={toggleCodeMode}
                className={`p-1.5 rounded-lg transition-colors ${
                  codeMode
                    ? 'text-blue-400 bg-blue-500/10'
                    : 'text-gray-500 hover:text-white hover:bg-white/10'
                }`}
              >
                <Code size={18} />
              </button>
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
