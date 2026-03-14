import React, { useMemo } from 'react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import CodeBlock from './CodeBlock';
import { renderMentionsInHTML } from '../../utils/mentions';

interface FormattedMessageProps {
  content: string;
  className?: string;
}

/**
 * Renders message content with syntax-highlighted code blocks (via CodeBlock)
 * and GFM markdown for everything else. All HTML is sanitized with DOMPurify
 * to prevent XSS attacks before rendering.
 */
export const FormattedMessage: React.FC<FormattedMessageProps> = ({ content, className }) => {
  const parts = useMemo(() => content.split(/(```[\s\S]*?```)/), [content]);

  return (
    <div className={className} data-testid="message-content">
      {parts.map((part, index) => {
        if (part.startsWith('```')) {
          const match = part.match(/```(\w+)?\n?([\s\S]*?)```/);
          if (match) {
            return (
              <CodeBlock
                key={index}
                language={match[1]}
                code={match[2]}
              />
            );
          }
        }

        // Render non-code text as GFM markdown, sanitized via DOMPurify
        if (!part.trim()) return null;

        const rawHtml = marked.parse(part, { async: false, gfm: true, breaks: true }) as string;
        const withMentions = renderMentionsInHTML(rawHtml);
        const safeHtml = DOMPurify.sanitize(withMentions, { ADD_ATTR: ['data-mention'] });

        return (
          <MarkdownSpan key={index} html={safeHtml} />
        );
      })}
    </div>
  );
};

/** Renders pre-sanitized HTML for inline markdown content */
const MarkdownSpan: React.FC<{ html: string }> = ({ html }) => (
  <span
    className="whitespace-pre-wrap prose-invert prose-sm max-w-none [&>p]:m-0 [&>p]:leading-relaxed [&_code]:bg-white/10 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-[13px] [&_code]:font-mono [&_code]:text-pink-300"
    dangerouslySetInnerHTML={{ __html: html }}
  />
);
