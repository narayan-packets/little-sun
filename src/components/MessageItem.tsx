import React, { useEffect, useMemo, useState } from 'react';
import {
  Check,
  Copy,
  RotateCcw,
  Square,
  Volume2,
} from 'lucide-react';
import { copyTextToClipboard } from '../lib/markdown';
import type { MessageRow } from '../lib/supabase';
import { ttsController, type TtsQueueSnapshot } from '../lib/tts';
import { useAppState } from '../state/store';
import { MarkdownRenderer } from './MarkdownRenderer';
import { SunMark } from './SunMark';
import { ImageCard } from './MediaViewer';
import { FileText } from 'lucide-react';

interface ParsedUserContent {
  promptText: string;
  images: Array<{ alt: string; url: string }>;
  documents: Array<{ filename: string; text: string }>;
}

function parseUserMessage(content: string): ParsedUserContent {
  let remaining = content;
  const images: Array<{ alt: string; url: string }> = [];
  const documents: Array<{ filename: string; text: string }> = [];

  // Extract attached document blocks (supporting both \n and \r\n)
  const docRegex = /\*\*Attached `([^`]+)`:\*\*\r?\n```[^\r\n]*\r?\n([\s\S]*?)```(?:\r?\n)*/g;
  let docMatch: RegExpExecArray | null;
  while ((docMatch = docRegex.exec(content)) !== null) {
    documents.push({ filename: docMatch[1], text: docMatch[2] });
  }
  remaining = remaining.replace(docRegex, '').trim();

  // Extract markdown images
  const imgRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
  let imgMatch: RegExpExecArray | null;
  while ((imgMatch = imgRegex.exec(content)) !== null) {
    images.push({ alt: imgMatch[1], url: imgMatch[2] });
  }
  remaining = remaining.replace(imgRegex, '').trim();

  return {
    promptText: remaining,
    images,
    documents,
  };
}

const UserMessageContent: React.FC<{ content: string }> = ({ content }) => {
  const { promptText, images, documents } = useMemo(() => parseUserMessage(content), [content]);
  const [expandedDoc, setExpandedDoc] = useState<string | null>(null);

  const displayPrompt = promptText || (images.length === 0 && documents.length === 0 ? content : '');

  return (
    <div className="flex flex-col items-end gap-2 max-w-[88%] sm:max-w-[78%]">
      {/* Attached Images */}
      {images.map((img: { alt: string; url: string }, i: number) => (
        <div key={i} className="max-w-full">
          <ImageCard src={img.url} alt={img.alt} />
        </div>
      ))}

      {/* Attached Documents */}
      {documents.map((doc: { filename: string; text: string }, i: number) => {
        const isExpanded = expandedDoc === doc.filename;
        const lineCount = doc.text.split('\n').length;
        return (
          <div
            key={i}
            className="w-full max-w-sm rounded-xl border p-2.5 text-xs select-none shadow-xs"
            style={{
              backgroundColor: 'var(--surface-2)',
              borderColor: 'var(--border)',
              color: 'var(--text)',
            }}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <FileText className="w-4 h-4 text-[var(--accent)] shrink-0" />
                <span className="font-medium truncate">{doc.filename}</span>
              </div>
              <button
                type="button"
                onClick={() => setExpandedDoc(isExpanded ? null : doc.filename)}
                className="px-2 py-0.5 rounded-md border text-[11px] font-medium transition-colors hover:bg-[var(--surface)] cursor-pointer shrink-0"
                style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
              >
                {isExpanded ? 'Hide' : `Snippet (${lineCount} lines)`}
              </button>
            </div>
            {isExpanded && (
              <pre
                className="mt-2 p-2 rounded-lg text-[11px] font-mono overflow-x-auto max-h-48 select-text"
                style={{
                  backgroundColor: 'var(--bg)',
                  borderColor: 'var(--border)',
                  color: 'var(--text)',
                }}
              >
                {doc.text}
              </pre>
            )}
          </div>
        );
      })}

      {/* User Text Bubble */}
      {displayPrompt && (
        <div
          className="w-fit max-w-full px-4 py-2.5 text-base whitespace-pre-wrap break-words border shadow-xs"
          style={{
            backgroundColor: 'var(--surface-2)',
            borderColor: 'var(--border)',
            color: 'var(--text)',
            borderRadius: '18px 18px 4px 18px',
          }}
        >
          {displayPrompt}
        </div>
      )}
    </div>
  );
};

interface MessageItemProps {
  message: MessageRow;
  isLastAssistant: boolean;
}

export const MessageItem: React.FC<MessageItemProps> = ({ message, isLastAssistant }) => {
  const { session, laptopStatus, mode, isStreaming, regenerateLastReply } = useAppState();
  const [copied, setCopied] = useState(false);
  const [ttsSnapshot, setTtsSnapshot] = useState<TtsQueueSnapshot>(() =>
    ttsController.getSnapshot()
  );

  useEffect(() => {
    return ttsController.subscribe(setTtsSnapshot);
  }, []);

  const isUser = message.role === 'user';
  const isThisPlaying =
    ttsSnapshot.activeMessageId === message.id && ttsSnapshot.state === 'playing';
  const isThisLoading =
    ttsSnapshot.activeMessageId === message.id && ttsSnapshot.state === 'loading';
  const ttsErrorForThis =
    ttsSnapshot.errorMessageId === message.id ? ttsSnapshot.errorText : null;

  const isLocalOffline = laptopStatus === 'offline';
  const isOffline =
    mode === 'cloud'
      ? typeof navigator !== 'undefined' && !navigator.onLine
      : isLocalOffline;

  const handleCopy = async () => {
    const ok = await copyTextToClipboard(message.content);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  const handleReadAloud = () => {
    if (isLocalOffline || !session) return;
    ttsController.toggleMessage({
      messageId: message.id,
      markdown: message.content,
      accessToken: session.accessToken,
    });
  };

  return (
    <div
      className={`group w-full min-w-0 ${isUser ? 'flex flex-col items-end' : 'flex flex-col items-start'}`}
    >
      {isUser ? (
        <UserMessageContent content={message.content} />
      ) : (
        <div className="w-full max-w-full min-w-0 ls-markdown">
          <MarkdownRenderer content={message.content} />

          {message.status === 'stopped' && (
            <div className="mt-1.5 text-xs" style={{ color: 'var(--text-muted)' }}>
              Generation stopped
            </div>
          )}
          {message.status === 'error' && (
            <div className="mt-1.5 text-xs" style={{ color: 'var(--danger)' }}>
              Generation interrupted
            </div>
          )}
        </div>
      )}

      {/* Action Row under every message */}
      <div
        className={`mt-1 flex flex-wrap items-center gap-1 sm:gap-1.5 transition-opacity ${
          isThisPlaying || isThisLoading || copied
            ? 'opacity-100'
            : 'opacity-100 md:opacity-65 md:group-hover:opacity-100'
        }`}
      >
        {/* Copy button */}
        <button
          type="button"
          onClick={handleCopy}
          className="min-h-[34px] sm:min-h-[36px] px-2 sm:px-2.5 inline-flex items-center justify-center gap-1.5 text-xs transition-colors cursor-pointer active:scale-95"
          style={{
            color: copied ? 'var(--success)' : 'var(--text-muted)',
            borderRadius: 'var(--radius-sm)',
          }}
          aria-label={copied ? 'Copied message' : 'Copy message'}
          title="Copy full response"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 shrink-0" />
              <span>Copied</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5 shrink-0" />
              <span>Copy</span>
            </>
          )}
        </button>

        {/* Read aloud button with Rotating Sun Animation when loading */}
        <button
          type="button"
          disabled={isOffline}
          onClick={handleReadAloud}
          className="min-h-[34px] sm:min-h-[36px] px-2 sm:px-2.5 inline-flex items-center justify-center gap-1.5 text-xs transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer active:scale-95"
          style={{
            color: isThisPlaying || isThisLoading ? 'var(--accent)' : 'var(--text-muted)',
            backgroundColor: isThisPlaying || isThisLoading ? 'var(--surface-2)' : 'transparent',
            borderRadius: 'var(--radius-sm)',
          }}
          aria-label={isThisPlaying || isThisLoading ? 'Stop reading aloud' : 'Read aloud'}
          title={isThisPlaying || isThisLoading ? 'Click to stop' : 'Read aloud'}
        >
          {isThisLoading ? (
            <SunMark size={18} state="waking" animated />
          ) : isThisPlaying ? (
            <>
              <span
                className="audio-waveform inline-flex items-end gap-[2px] h-3.5 w-3.5 shrink-0"
                aria-hidden="true"
              >
                <span className="audio-wave-bar audio-bar-1 w-[2.5px] rounded-full bg-current" />
                <span className="audio-wave-bar audio-bar-2 w-[2.5px] rounded-full bg-current" />
                <span className="audio-wave-bar audio-bar-3 w-[2.5px] rounded-full bg-current" />
              </span>
              <span className="font-medium">Stop</span>
            </>
          ) : (
            <>
              <Volume2 className="w-3.5 h-3.5 shrink-0" />
              <span>Read aloud</span>
            </>
          )}
        </button>

        {/* Regenerate button (last AI message only) */}
        {!isUser && isLastAssistant && (
          <button
            type="button"
            disabled={isOffline || isStreaming}
            onClick={regenerateLastReply}
            className="min-h-[34px] sm:min-h-[36px] px-2 sm:px-2.5 inline-flex items-center justify-center gap-1.5 text-xs transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer active:scale-95"
            style={{
              color: 'var(--text-muted)',
              borderRadius: 'var(--radius-sm)',
            }}
            aria-label="Regenerate reply"
            title="Regenerate"
          >
            <RotateCcw className="w-3.5 h-3.5 shrink-0" />
            <span>Regenerate</span>
          </button>
        )}
      </div>

      {ttsErrorForThis && (
        <div className="mt-0.5 text-xs" style={{ color: 'var(--danger)' }} role="alert">
          {ttsErrorForThis}
        </div>
      )}
    </div>
  );
};

