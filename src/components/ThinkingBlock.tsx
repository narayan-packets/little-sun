import React, { useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Brain, ChevronDown, Copy, Check } from 'lucide-react';
import { copyTextToClipboard } from '../lib/markdown';

interface ThinkingBlockProps {
  thinkingContent: string;
  isLiveStreaming?: boolean;
}

export const ThinkingBlock: React.FC<ThinkingBlockProps> = ({
  thinkingContent,
  isLiveStreaming = false,
}) => {
  // During live streaming, default to expanded so the user sees thoughts arriving;
  // once completed, default to collapsed to keep the chat uncluttered.
  const [isExpanded, setIsExpanded] = useState<boolean>(isLiveStreaming);
  const [copied, setCopied] = useState<boolean>(false);

  const cleanContent = thinkingContent.trim();
  if (!cleanContent && !isLiveStreaming) return null;

  // Preprocess HTML underline/ins tags so markdown parses them into styled spans
  const formattedContent = useMemo(() => {
    if (!cleanContent) return '';
    return cleanContent.replace(/<(?:u|ins)>([\s\S]*?)<\/(?:u|ins)>/gi, (_, inner) => `[${inner}](#underline)`);
  }, [cleanContent]);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const ok = await copyTextToClipboard(cleanContent);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  return (
    <div
      className="w-full my-2.5 rounded-xl border transition-all text-xs overflow-hidden select-text"
      style={{
        backgroundColor: 'var(--surface-2)',
        borderColor: 'var(--border)',
      }}
    >
      {/* Header bar / Toggle */}
      <button
        type="button"
        onClick={() => setIsExpanded((prev) => !prev)}
        className="w-full min-h-[38px] flex items-center justify-between px-3 py-2 text-left cursor-pointer transition-colors hover:bg-neutral-500/10 focus:outline-none select-none active:bg-neutral-500/15"
        aria-expanded={isExpanded}
        aria-label="Toggle thought process"
      >
        <div className="flex items-center gap-2 min-w-0">
          <Brain
            className={`w-3.5 h-3.5 shrink-0 transition-transform ${
              isLiveStreaming ? 'animate-pulse text-[var(--accent)]' : 'text-[var(--text-muted)]'
            }`}
          />
          <span
            className="font-medium tracking-tight text-xs truncate"
            style={{ color: isLiveStreaming ? 'var(--accent)' : 'var(--text-muted)' }}
          >
            {isLiveStreaming ? 'Thinking…' : 'Thought process'}
          </span>
          {isLiveStreaming && (
            <span
              className="inline-block w-1.5 h-1.5 rounded-full bg-[var(--accent)] animate-ping"
              title="Generating reasoning"
            />
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {isExpanded && cleanContent && (
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-normal transition-colors hover:bg-neutral-500/15 cursor-pointer"
              style={{ color: 'var(--text-muted)' }}
              title="Copy thought process"
              aria-label="Copy thought process"
            >
              {copied ? (
                <>
                  <Check className="w-3 h-3 text-emerald-500" />
                  <span className="text-emerald-500">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3" />
                  <span>Copy</span>
                </>
              )}
            </button>
          )}

          <div
            className="p-0.5 rounded text-[var(--text-muted)] transition-transform duration-200"
            style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
          >
            <ChevronDown className="w-3.5 h-3.5" />
          </div>
        </div>
      </button>

      {/* Collapsible Content with Rich Markdown Support (Bold, Italic, Underline, Lists, Code) */}
      {isExpanded && (
        <div
          className="px-3.5 py-3 border-t max-h-80 sm:max-h-96 overflow-y-auto select-text text-[11.5px] sm:text-xs leading-relaxed break-words"
          style={{
            borderColor: 'var(--border)',
            color: 'var(--text-muted)',
            backgroundColor: 'var(--surface-3)',
          }}
        >
          {formattedContent ? (
            <div className="ls-thinking-markdown space-y-1.5">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  a({ href, children }) {
                    if (href === '#underline') {
                      return <span className="underline underline-offset-2 font-medium">{children}</span>;
                    }
                    return (
                      <a
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline hover:text-[var(--text)]"
                      >
                        {children}
                      </a>
                    );
                  },
                  strong({ children }) {
                    return <strong className="font-semibold text-[var(--text)]">{children}</strong>;
                  },
                  em({ children }) {
                    return <em className="italic">{children}</em>;
                  },
                  p({ children }) {
                    return <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>;
                  },
                  ol({ children }) {
                    return <ol className="list-decimal pl-4 sm:pl-5 space-y-1 my-1.5">{children}</ol>;
                  },
                  ul({ children }) {
                    return <ul className="list-disc pl-4 sm:pl-5 space-y-1 my-1.5">{children}</ul>;
                  },
                  li({ children }) {
                    return <li className="pl-0.5 leading-relaxed">{children}</li>;
                  },
                  code({ children }) {
                    return (
                      <code
                        className="px-1 py-0.5 rounded font-mono text-[11px] bg-neutral-500/15"
                        style={{ color: 'var(--text)' }}
                      >
                        {children}
                      </code>
                    );
                  },
                }}
              >
                {formattedContent}
              </ReactMarkdown>
            </div>
          ) : (
            isLiveStreaming && <span className="inline-block animate-pulse">…</span>
          )}
        </div>
      )}
    </div>
  );
};
