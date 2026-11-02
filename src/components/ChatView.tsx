import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowDown, Keyboard, Menu, PanelLeft, Settings } from 'lucide-react';
import { useAppState } from '../state/store';
import { Composer } from './Composer';
import { MarkdownRenderer } from './MarkdownRenderer';
import { MessageItem } from './MessageItem';
import { ModelPicker } from './ModelPicker';
import { StatusPill } from './StatusPill';
import { SunMark } from './SunMark';

export const ChatView: React.FC = () => {
  const {
    session,
    userDisplayName,
    activeChatId,
    messages,
    laptopStatus,
    isAccessRestricted,
    isStreaming,
    streamingStage,
    streamingContent,
    isDesktopSidebarCollapsed,
    setIsSidebarOpen,
    toggleDesktopSidebar,
    setIsSettingsOpen,
    setIsShortcutsOpen,
    signOut,
    setComposerDraft,
  } = useAppState();

  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const lastScrollHeightRef = useRef<number>(0);
  const scrollRafRef = useRef<number | null>(null);
  const [userScrolledUp, setUserScrolledUp] = useState(false);
  const [viewportHeight, setViewportHeight] = useState<string>('100dvh');

  // Keep composer above mobile on-screen keyboard using visualViewport
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    const handleResize = () => {
      setViewportHeight(`${Math.round(vv.height)}px`);
    };

    vv.addEventListener('resize', handleResize);
    return () => vv.removeEventListener('resize', handleResize);
  }, []);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    const el = scrollContainerRef.current;
    if (!el) return;
    el.scrollTo({
      top: el.scrollHeight,
      behavior,
    });
    lastScrollHeightRef.current = el.scrollHeight;
    setUserScrolledUp(false);
  }, []);

  const handleScroll = () => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setUserScrolledUp(distanceFromBottom > 96);
  };

  // Reset scroll tracking when switching chat instances
  useEffect(() => {
    lastScrollHeightRef.current = 0;
    setUserScrolledUp(false);
  }, [activeChatId]);

  // Jitter-free scroll-to-bottom: pin to bottom on RAF when content height increases
  useEffect(() => {
    if (userScrolledUp) return;

    if (scrollRafRef.current !== null) {
      cancelAnimationFrame(scrollRafRef.current);
    }
    scrollRafRef.current = requestAnimationFrame(() => {
      scrollRafRef.current = null;
      const container = scrollContainerRef.current;
      if (!container) return;
      if (Math.abs(container.scrollHeight - lastScrollHeightRef.current) > 2) {
        container.scrollTop = container.scrollHeight;
        lastScrollHeightRef.current = container.scrollHeight;
      }
    });

    return () => {
      if (scrollRafRef.current !== null) {
        cancelAnimationFrame(scrollRafRef.current);
      }
    };
  }, [messages.length, streamingContent, streamingStage, isStreaming, userScrolledUp]);

  let lastAssistantId: string | null = null;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === 'assistant') {
      lastAssistantId = messages[i].id;
      break;
    }
  }

  const isEmpty = messages.length === 0 && !isStreaming;

  return (
    <main
      className="flex-1 min-w-0 flex flex-col relative overflow-hidden"
      style={{
        backgroundColor: 'var(--bg)',
        backgroundImage: 'var(--ambient-glow)',
        height: viewportHeight,
      }}
    >
      {/* Thin Header: menu/expand sidebar button, model picker, sun state animation, settings */}
      <header
        className="h-14 px-3 sm:px-5 border-b flex items-center justify-between gap-2 shrink-0"
        style={{
          backgroundColor: 'var(--bg)',
          borderColor: 'var(--border)',
          paddingTop: 'env(safe-area-inset-top)',
        }}
      >
        <div className="flex items-center gap-1 min-w-0">
          {/* Mobile menu button */}
          <button
            type="button"
            onClick={() => setIsSidebarOpen(true)}
            className="md:hidden min-h-[44px] min-w-[44px] inline-flex items-center justify-center cursor-pointer"
            style={{ color: 'var(--text)' }}
            aria-label="Open menu"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Desktop expand sidebar button when collapsed */}
          <AnimatePresence initial={false}>
            {isDesktopSidebarCollapsed && (
              <motion.button
                type="button"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
                onClick={toggleDesktopSidebar}
                className="hidden md:inline-flex min-h-[38px] min-w-[38px] items-center justify-center transition-colors cursor-pointer mr-1"
                style={{
                  color: 'var(--text-muted)',
                  borderRadius: 'var(--radius-sm)',
                }}
                aria-label="Expand sidebar"
                title="Expand sidebar (Ctrl+Shift+O for New Chat)"
              >
                <PanelLeft className="w-4 h-4" />
              </motion.button>
            )}
          </AnimatePresence>

          <ModelPicker />
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <StatusPill />
          <button
            type="button"
            onClick={() => setIsShortcutsOpen(true)}
            className="hidden sm:inline-flex min-h-[40px] min-w-[40px] items-center justify-center transition-colors cursor-pointer hover:bg-[var(--surface-2)]"
            style={{
              color: 'var(--text-muted)',
              borderRadius: 'var(--radius-sm)',
            }}
            aria-label="Keyboard shortcuts (?)"
            title="Keyboard shortcuts (?)"
          >
            <Keyboard className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setIsSettingsOpen(true)}
            className="min-h-[42px] min-w-[42px] inline-flex items-center justify-center transition-colors cursor-pointer"
            style={{
              color: 'var(--text-muted)',
              borderRadius: 'var(--radius-sm)',
            }}
            aria-label="Open settings"
            title="Settings"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Clean 403 Restricted State if account is not in ALLOWED_EMAILS */}
      {isAccessRestricted ? (
        <motion.div
          key="restricted-access-state"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          className="flex-1 flex flex-col items-center justify-center px-4 select-none"
        >
          <div
            className="w-full max-w-[400px] p-6 border text-center flex flex-col items-center"
            style={{
              backgroundColor: 'var(--surface)',
              borderColor: 'var(--border)',
              borderRadius: 'var(--radius-md)',
            }}
          >
            <SunMark size={40} state="offline" className="mb-3.5" />
            <h1
              className="text-base sm:text-lg font-semibold tracking-tight mb-1.5"
              style={{ color: 'var(--text)' }}
            >
              Access not allocated for this account
            </h1>
            <p className="text-xs leading-relaxed mb-4" style={{ color: 'var(--text-muted)' }}>
              {session?.user.email
                ? `${session.user.email} is not authorized on this private host.`
                : 'This account is not authorized on this private host.'}
            </p>
            <button
              type="button"
              onClick={signOut}
              className="min-h-[38px] px-4 py-2 text-xs font-medium border transition-colors cursor-pointer active:scale-98"
              style={{
                backgroundColor: 'var(--surface-2)',
                borderColor: 'var(--border)',
                color: 'var(--text)',
                borderRadius: 'var(--radius-sm)',
              }}
            >
              Sign out
            </button>
          </div>
        </motion.div>
      ) : isEmpty ? (
        <motion.div
          key="new-chat-instance"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
          className="flex-1 flex flex-col items-center justify-center px-4 select-none"
        >
          <div className="flex flex-col items-center text-center max-w-[560px] mx-auto">
            <div className="mb-4">
              <SunMark size={42} state="waking" animated />
            </div>

            <h1
              className="text-2xl sm:text-3xl font-medium tracking-tight mb-6"
              style={{ color: 'var(--text)', letterSpacing: '-0.02em' }}
            >
              How can I help, {userDisplayName}?
            </h1>

            {/* Minimal Starter Suggestion Pills */}
            <div className="flex flex-wrap items-center justify-center gap-2 max-w-[480px]">
              {[
                { label: 'Explain a complex concept', prompt: 'Explain ' },
                { label: 'Write or review code', prompt: 'Write a program to ' },
                { label: 'Solve a math problem', prompt: 'Can you solve this math problem step-by-step with LaTeX: ' },
              ].map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => {
                    setComposerDraft(item.prompt);
                    const textarea = document.querySelector<HTMLTextAreaElement>('.composer-textarea');
                    if (textarea) {
                      textarea.focus();
                    }
                  }}
                  className="px-3.5 py-1.5 text-xs font-medium border transition-all cursor-pointer hover:bg-[var(--surface-2)] active:scale-95 shadow-xs"
                  style={{
                    backgroundColor: 'var(--surface)',
                    borderColor: 'var(--border)',
                    color: 'var(--text-muted)',
                    borderRadius: '9999px',
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </motion.div>
      ) : (
        <div
          key={activeChatId || 'active-chat-instance'}
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto px-4 sm:px-6 py-6"
          style={{ WebkitOverflowScrolling: 'touch', overscrollBehaviorY: 'contain' }}
        >
          <div className="w-full max-w-[720px] mx-auto space-y-6">
            {messages.map((msg) => (
              <MessageItem
                key={msg.id}
                message={msg}
                isLastAssistant={!isStreaming && msg.id === lastAssistantId}
              />
            ))}

            {/* Streaming Assistant Message */}
            {isStreaming && (
              <div className="w-full flex flex-col items-start">
                {streamingContent ? (
                  <div className="w-full max-w-full min-w-0 ls-markdown">
                    <MarkdownRenderer content={streamingContent} isStreaming />
                  </div>
                ) : (
                  <div className="flex items-center gap-2.5 py-1">
                    <SunMark size={22} state="waking" animated />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Jump to latest button when user scrolled up */}
      <AnimatePresence>
        {!isEmpty && userScrolledUp && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
            className="absolute bottom-24 left-0 right-0 flex justify-center pointer-events-none z-20"
          >
            <button
              type="button"
              onClick={() => scrollToBottom('smooth')}
              className="pointer-events-auto min-h-[38px] px-3.5 py-1.5 inline-flex items-center gap-1.5 text-xs font-medium border shadow-md transition-colors cursor-pointer"
              style={{
                backgroundColor: 'var(--surface)',
                borderColor: 'var(--border)',
                color: 'var(--text)',
                borderRadius: '9999px',
              }}
            >
              <span>Jump to latest</span>
              <ArrowDown className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom Composer */}
      <Composer />
    </main>
  );
};

