import React, { useMemo, useState } from 'react';
import hljs from 'highlight.js';
import 'highlight.js/styles/github-dark.css';
import { Copy, Check, Code } from 'lucide-react';

interface CodeBlockProps {
  code: string;
  language?: string;
}

const CodeBlock: React.FC<CodeBlockProps> = ({ code, language }) => {
  const [copied, setCopied] = useState(false);

  const { highlightedCode, detectedLanguage } = useMemo(() => {
    // If language is provided and known to hljs, use it
    if (language && hljs.getLanguage(language)) {
      try {
        const result = hljs.highlight(code, { language });
        return {
          highlightedCode: result.value,
          detectedLanguage: language
        };
      } catch (e) {
        console.warn(`Failed to highlight with language: ${language}`, e);
      }
    }

    // Auto-detection fallback
    try {
      const result = hljs.highlightAuto(code);
      return {
        highlightedCode: result.value,
        detectedLanguage: result.language || 'plaintext'
      };
    } catch {
      return {
        highlightedCode: code,
        detectedLanguage: 'plaintext'
      };
    }
  }, [code, language]);
  const [isExpanded, setIsExpanded] = useState(false);
  const lineCount = useMemo(() => code.split('\n').length, [code]);
  const isExpandable = lineCount > 10;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group my-6 rounded-xl overflow-hidden border border-white/10 bg-[#0d1117]/80 backdrop-blur-sm shadow-2xl transition-all hover:border-white/20">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-white/5 border-b border-white/5 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <Code size={14} className="text-blue-400" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
            {detectedLanguage}
          </span>
        </div>
        
        <button
          onClick={handleCopy}
          title="Copy code"
          className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-all text-[10px] font-medium border border-white/5"
        >
          {copied ? (
            <>
              <Check size={12} className="text-green-400" />
              <span className="text-green-400">Copied!</span>
            </>
          ) : (
            <>
              <Copy size={12} />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>

      {/* Code Area */}
      <div 
        className={`relative transition-all duration-300 ease-in-out ${
          isExpandable && !isExpanded ? 'max-h-[300px] overflow-hidden' : 'max-h-none'
        }`}
      >
        <pre className="p-4 overflow-x-auto selection:bg-blue-500/30">
          <code
            className={`hljs language-${detectedLanguage} text-[13px] leading-relaxed block font-mono`}
            dangerouslySetInnerHTML={{ __html: highlightedCode }}
          />
        </pre>
        
        {isExpandable && !isExpanded && (
          <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-[#0d1117] to-transparent pointer-events-none" />
        )}
      </div>
      
      {isExpandable && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full py-2 bg-white/5 hover:bg-white/10 text-[11px] font-semibold text-gray-400 hover:text-white transition-all border-t border-white/5 flex items-center justify-center gap-1.5"
        >
          {isExpanded ? 'SHOW LESS' : `SHOW ALL (${lineCount} LINES)`}
        </button>
      )}

      {/* Subtle Terminal Bottom Bar */}
      {!isExpandable && <div className="h-1 bg-gradient-to-r from-blue-500/20 via-purple-500/20 to-blue-500/20 opacity-0 group-hover:opacity-100 transition-opacity" />}
    </div>
  );
};

export default CodeBlock;
