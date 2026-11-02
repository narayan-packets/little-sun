import React, { useEffect, useState } from 'react';
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

interface MessageItemProps {
  message: MessageRow;
  isLastAssistant: boolean;
}

export const MessageItem: React.FC<MessageItemProps> = ({ message, isLastAssistant }) => {
  const { session, laptopStatus, isStreaming, regenerateLastReply } = useAppState();
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

  const isOffline = laptopStatus === 'offline';

  const handleCopy = async () => {
    const ok = await copyTextToClipboard(message.content);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  const handleReadAloud = () => {
    if (isOffline || !session) return;
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
        <div
          className="max-w-[88%] sm:max-w-[78%] px-4 py-2.5 text-base whitespace-pre-wrap break-words border shadow-xs"
          style={{
            backgroundColor: 'var(--surface-2)',
            borderColor: 'var(--border)',
            color: 'var(--text)',
            borderRadius: '18px 18px 4px 18px',
          }}
        >
          {message.content}
        </div>
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
        className={`mt-1 flex items-center gap-1 transition-opacity ${
          isThisPlaying || isThisLoading || copied
            ? 'opacity-100'
            : 'opacity-100 md:opacity-65 md:group-hover:opacity-100'
        }`}
      >
        {/* Copy button */}
        <button
          type="button"
          onClick={handleCopy}
          className="min-h-[38px] px-2 inline-flex items-center justify-center gap-1.5 text-xs transition-colors cursor-pointer"
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
          className="min-h-[38px] px-2.5 inline-flex items-center justify-center gap-1.5 text-xs transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
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
            className="min-h-[38px] px-2 inline-flex items-center justify-center gap-1.5 text-xs transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
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

