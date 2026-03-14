import React from 'react';
import CodeBlock from './CodeBlock';

interface FormattedMessageProps {
  content: string;
  className?: string;
}

export const FormattedMessage: React.FC<FormattedMessageProps> = ({ content, className }) => {
  // Regex to match code blocks: ```[language]\n[code]```
  const parts = content.split(/(```[\s\S]*?```)/);

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
        
        // Render regular text with preservation of whitespace/newlines
        return (
          <span key={index} className="whitespace-pre-wrap">
            {part}
          </span>
        );
      })}
    </div>
  );
};
