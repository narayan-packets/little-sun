import React, { useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowUp, Plus, RotateCcw, Square } from 'lucide-react';
import { useAppState } from '../state/store';

function formatCompactTokens(n: number): string {
  if (n >= 1000) {
    return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  }
  return String(n);
}

export const Composer: React.FC = () => {
  const {
    composerDraft,
    setComposerDraft,
    contextUsage,
    laptopStatus,
    isAccessRestricted,
    isStreaming,
    failedSend,
    sendMessage,
    stopGenerating,
    startNewChat,
    continueInNewChat,
    clearFailedSendError,
  } = useAppState();

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const isOffline = laptopStatus === 'offline';
  const {
    totalTokens,
    usableInputLimit,
    draftTokens,
    maxTurnTokens,
    usagePercent,
    isNearLimit,
    isChatLimitReached,
    isDraftOverTurnLimit,
  } = contextUsage;

  const isInputBlocked = isOffline || isChatLimitReached || isAccessRestricted;
  const isSendDisabled =
    isInputBlocked || isDraftOverTurnLimit || !composerDraft.trim();

  // Auto-grow textarea smoothly up to ~6 lines (approx 160px)
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const nextHeight = Math.min(160, Math.max(44, el.scrollHeight));
    el.style.height = `${nextHeight}px`;
  }, [composerDraft]);

  if (isAccessRestricted) {
    return null;
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== 'Enter') return;

    const isMobileViewport =
      typeof window !== 'undefined' &&
      (window.matchMedia('(max-width: 767px)').matches ||
        'ontouchstart' in window ||
        navigator.maxTouchPoints > 0);

    if (isMobileViewport) {
      return;
    }

    if (!e.shiftKey) {
      e.preventDefault();
      if (!isSendDisabled && !isStreaming) {
        sendMessage();
      }
    }
  };

  return (
    <div
      className="w-full px-3 sm:px-5 pt-2 shrink-0"
      style={{
        backgroundColor: 'var(--bg)',
        paddingBottom: 'calc(0.85rem + env(safe-area-inset-bottom))',
      }}
    >
      <div className="w-full max-w-[740px] mx-auto">
        {/* Minimal desktop & mobile optimized context window / token limit feedback */}
        <AnimatePresence initial={false}>
          {isNearLimit && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
              className="mb-2 px-3 py-2 border flex flex-col gap-1.5"
              style={{
                backgroundColor: 'var(--surface)',
                borderColor:
                  isChatLimitReached || isDraftOverTurnLimit
                    ? 'var(--danger)'
                    : 'var(--border)',
                borderRadius: '12px',
              }}
              role="status"
              aria-live="polite"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs md:text-[11px]">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="w-1.5 h-1.5 rounded-full shrink-0"
                    style={{
                      backgroundColor:
                        isChatLimitReached || isDraftOverTurnLimit
                          ? 'var(--danger)'
                          : 'var(--accent)',
                    }}
                  />
                  <span
                    className="font-medium truncate"
                    style={{
                      color:
                        isChatLimitReached || isDraftOverTurnLimit
                          ? 'var(--danger)'
                          : 'var(--text)',
                    }}
                  >
                    {isChatLimitReached
                      ? 'Context window limit reached'
                      : isDraftOverTurnLimit
                        ? 'Message exceeds single-turn token limit'
                        : `Context window · ${usagePercent}%`}
                  </span>
                </div>

                <div className="flex items-center gap-2 shrink-0 ml-auto">
                  <span
                    className="font-mono text-[11px]"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    {isDraftOverTurnLimit && !isChatLimitReached
                      ? `${formatCompactTokens(draftTokens)} / ${formatCompactTokens(maxTurnTokens)} tokens`
                      : `${formatCompactTokens(totalTokens)} / ${formatCompactTokens(usableInputLimit)} tokens`}
                  </span>

                  {isChatLimitReached && (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={continueInNewChat}
                        className="min-h-[30px] px-2.5 py-1 md:min-h-[26px] md:px-2 md:py-0.5 inline-flex items-center gap-1 text-xs md:text-[11px] font-medium border transition-transform active:scale-95 cursor-pointer"
                        style={{
                          backgroundColor: 'var(--surface-2)',
                          borderColor: 'var(--border)',
                          color: 'var(--text)',
                          borderRadius: '6px',
                        }}
                        title="Start a new chat carrying over the latest context"
                      >
                        <span>Continue</span>
                      </button>
                      <button
                        type="button"
                        onClick={startNewChat}
                        className="min-h-[30px] px-2.5 py-1 md:min-h-[26px] md:px-2 md:py-0.5 inline-flex items-center gap-1 text-xs md:text-[11px] font-medium transition-transform active:scale-95 cursor-pointer"
                        style={{
                          backgroundColor: 'var(--accent)',
                          color: 'var(--accent-contrast)',
                          borderRadius: '6px',
                        }}
                        title="Start a fresh chat (Ctrl+Shift+O)"
                      >
                        <Plus className="w-3.5 h-3.5 md:w-3 md:h-3" />
                        <span>New chat</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Ultra-thin context usage progress bar */}
              <div
                className="w-full h-1 overflow-hidden"
                style={{
                  backgroundColor: 'var(--surface-2)',
                  borderRadius: '9999px',
                }}
              >
                <div
                  className="h-full transition-all duration-200"
                  style={{
                    width: `${
                      isDraftOverTurnLimit && !isChatLimitReached
                        ? Math.min(100, Math.round((draftTokens / maxTurnTokens) * 100))
                        : usagePercent
                    }%`,
                    backgroundColor:
                      isChatLimitReached || isDraftOverTurnLimit
                        ? 'var(--danger)'
                        : 'var(--accent)',
                  }}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {failedSend && (
          <div
            className="mb-2.5 px-3.5 py-2 flex items-center justify-between gap-3 text-xs border"
            style={{
              backgroundColor: 'var(--surface)',
              borderColor: 'var(--danger)',
              color: 'var(--danger)',
              borderRadius: 'var(--radius-sm)',
            }}
            role="alert"
          >
            <span className="truncate">{failedSend.error}</span>
            <div className="flex items-center gap-2 shrink-0">
              {!isOffline && !isChatLimitReached && (
                <button
                  type="button"
                  onClick={() => {
                    const retryText = failedSend.text || composerDraft;
                    clearFailedSendError();
                    if (retryText.trim()) {
                      sendMessage(retryText);
                    }
                  }}
                  className="min-h-[34px] px-2.5 py-1 inline-flex items-center gap-1 font-medium border cursor-pointer"
                  style={{
                    borderColor: 'var(--border)',
                    backgroundColor: 'var(--surface-2)',
                    color: 'var(--text)',
                    borderRadius: '6px',
                  }}
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Retry</span>
                </button>
              )}
            </div>
          </div>
        )}

        <div
          className="composer-card flex items-end gap-2 px-3.5 py-2.5 border"
          style={{
            backgroundColor: isInputBlocked ? 'var(--surface-2)' : 'var(--surface)',
            borderColor:
              isChatLimitReached || isDraftOverTurnLimit
                ? 'var(--danger)'
                : 'var(--border)',
            borderRadius: '20px',
          }}
        >
          <textarea
            ref={textareaRef}
            rows={1}
            disabled={isInputBlocked}
            value={composerDraft}
            onChange={(e) => setComposerDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              isOffline
                ? 'Service currently offline'
                : isChatLimitReached
                  ? 'Chat limit reached — start a new chat'
                  : 'Reply to Little Sun…'
            }
            className="composer-textarea flex-1 min-h-[40px] max-h-[160px] py-1.5 px-1 bg-transparent border-0 resize-none disabled:cursor-not-allowed"
            style={{
              color: 'var(--text)',
              fontSize: '16px',
              lineHeight: '1.5',
            }}
          />

          {isStreaming ? (
            <button
              type="button"
              onClick={stopGenerating}
              className="h-10 w-10 inline-flex items-center justify-center shrink-0 transition-transform active:scale-95 cursor-pointer"
              style={{
                backgroundColor: 'var(--text)',
                color: 'var(--bg)',
                borderRadius: '9999px',
              }}
              aria-label="Stop generating"
              title="Stop generating"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
            </button>
          ) : (
            <button
              type="button"
              disabled={isSendDisabled}
              onClick={() => sendMessage()}
              className="h-10 w-10 inline-flex items-center justify-center shrink-0 transition-all active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
              style={{
                backgroundColor: 'var(--accent)',
                color: 'var(--accent-contrast)',
                borderRadius: '9999px',
              }}
              aria-label="Send message"
              title="Send message"
            >
              <ArrowUp className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

