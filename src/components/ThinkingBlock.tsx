import React, { useState } from 'react';
import { Brain, ChevronDown, ChevronRight, Copy, Check } from 'lucide-react';
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
      className="w-full my-2 rounded-xl border transition-all text-xs overflow-hidden select-text"
      style={{
        backgroundColor: 'var(--surface-2)',
        borderColor: 'var(--border)',
      }}
    >
      {/* Header bar / Toggle */}
      <button
        type="button"
        onClick={() => setIsExpanded((prev) => !prev)}
        className="w-full flex items-center justify-between px-3 py-2 text-left cursor-pointer transition-colors hover:bg-neutral-500/10 focus:outline-none select-none"
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
            className="font-medium tracking-tight truncate"
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

      {/* Collapsible Content */}
      {isExpanded && (
        <div
          className="px-3.5 py-2.5 border-t max-h-80 sm:max-h-96 overflow-y-auto whitespace-pre-wrap font-mono text-[11.5px] leading-relaxed select-text"
          style={{
            borderColor: 'var(--border)',
            color: 'var(--text-muted)',
            backgroundColor: 'var(--surface-3)',
          }}
        >
          {cleanContent || (isLiveStreaming ? '…' : '')}
        </div>
      )}
    </div>
  );
};
