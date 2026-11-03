import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowDown,
  BookOpen,
  Calculator,
  Code2,
  Film,
  Menu,
  PanelLeft,
  PenLine,
  Settings,
} from 'lucide-react';
import { useAppState } from '../state/store';
import { Composer } from './Composer';
import { MarkdownRenderer } from './MarkdownRenderer';
import { MessageItem } from './MessageItem';
import { ModelPicker } from './ModelPicker';
import { StatusPill } from './StatusPill';
import { SunMark } from './SunMark';
import { CloudMark } from './CloudMark';

const SUGGESTION_PILLS = [
  { label: 'Write', icon: PenLine, prompt: 'Write a ' },
  { label: 'Learn', icon: BookOpen, prompt: 'Explain ' },
  { label: 'Code', icon: Code2, prompt: 'Write a program to ' },
  { label: 'Solve Math', icon: Calculator, prompt: 'Can you solve this math problem step-by-step with LaTeX: ' },
  { label: 'Media Demo', icon: Film, prompt: 'Preview media generated interface with image and video placeholders' },
];

function getHeroGreeting(name: string): string {
  const hour = new Date().getHours();
  let timeStr = 'Night';
  if (hour >= 5 && hour < 12) {
    timeStr = 'Morning';
  } else if (hour >= 12 && hour < 17) {
    timeStr = 'Afternoon';
  } else if (hour >= 17 && hour < 21) {
    timeStr = 'Evening';
  } else {
    timeStr = 'Night';
  }
  return name ? `${timeStr}, ${name}` : timeStr;
}

export const ChatView: React.FC = () => {
  const {
    session,
    userDisplayName,
    activeChatId,
    messages,
    laptopStatus,
    mode,
    isAccessRestricted,
    isStreaming,
    streamingStage,
    streamingContent,
    isDesktopSidebarCollapsed,
    setIsSidebarOpen,
    toggleDesktopSidebar,
    setIsSettingsOpen,
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
  const heroGreeting = getHeroGreeting(userDisplayName);

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
            onClick={() => setIsSettingsOpen(true)}
            className="min-h-[42px] min-w-[42px] inline-flex items-center justify-center transition-colors cursor-pointer hover:bg-[var(--surface-2)]"
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
      <AnimatePresence mode="wait" initial={false}>
        {isAccessRestricted ? (
          <motion.div
            key="restricted-access-state"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
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
            key="new-chat-hero"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="flex-1 flex flex-col items-center justify-center px-3.5 sm:px-4 pb-8 sm:pb-16 overflow-y-auto w-full"
          >
            <div className="w-full max-w-[720px] mx-auto flex flex-col items-center">
              {/* Claude-style Hero Greeting: SunMark/CloudMark + Time-aware Greeting in Editorial Serif */}
              <div className="inline-flex items-center justify-center gap-2.5 sm:gap-3.5 mb-5 sm:mb-7 select-none">
                {mode === 'cloud' ? (
                  <>
                    <CloudMark size={30} state="idle" className="sm:hidden" />
                    <CloudMark size={38} state="idle" className="hidden sm:inline-block" />
                  </>
                ) : (
                  <>
                    <SunMark size={30} state="waking" animated className="sm:hidden" />
                    <SunMark size={38} state="waking" animated className="hidden sm:inline-block" />
                  </>
                )}
                <h1
                  className="text-2xl sm:text-4xl font-normal tracking-tight text-center"
                  style={{
                    fontFamily: 'ui-serif, Georgia, Cambria, "Times New Roman", Times, serif',
                    color: 'var(--text)',
                  }}
                >
                  {heroGreeting}
                </h1>
              </div>

              {/* Centered Composer Card */}
              <div className="w-full mb-4">
                <Composer isHero />
              </div>

              {/* Starter Suggestion Pills (Claude style with icons) */}
              <div className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-2 max-w-[620px]">
                {SUGGESTION_PILLS.map((item) => {
                  const IconComponent = item.icon;
                  return (
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
                      className="min-h-[34px] px-3 sm:px-3.5 py-1.5 inline-flex items-center gap-1.5 sm:gap-2 text-xs font-medium border transition-all cursor-pointer hover:bg-[var(--surface-2)] active:scale-95 shadow-2xs"
                      style={{
                        backgroundColor: 'var(--surface)',
                        borderColor: 'var(--border)',
                        borderRadius: '9999px',
                      }}
                    >
                      <IconComponent className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--accent)' }} />
                      <span style={{ color: 'var(--text)' }}>{item.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Whisper-Quiet Desktop Keyboard Hint */}
              <div
                className="hidden sm:flex items-center justify-center gap-2 mt-5 text-[11px] select-none opacity-50 transition-opacity hover:opacity-85"
                style={{ color: 'var(--text-muted)' }}
              >
                <span>Press</span>
                <kbd
                  className="px-1.5 py-0.5 font-mono text-[10px] rounded border"
                  style={{ backgroundColor: 'var(--surface-2)', borderColor: 'var(--border)' }}
                >
                  ?
                </kbd>
                <span>for shortcuts</span>
                <span className="opacity-40">·</span>
                <kbd
                  className="px-1.5 py-0.5 font-mono text-[10px] rounded border"
                  style={{ backgroundColor: 'var(--surface-2)', borderColor: 'var(--border)' }}
                >
                  Ctrl+K
                </kbd>
                <span>for new chat</span>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="chat-active-flow"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="flex-1 flex flex-col min-h-0 overflow-hidden relative"
          >
            <div
              key={activeChatId || 'active-chat-instance'}
              ref={scrollContainerRef}
              onScroll={handleScroll}
              className="flex-1 overflow-y-auto px-3 sm:px-6 py-4 sm:py-6"
              style={{ WebkitOverflowScrolling: 'touch', overscrollBehaviorY: 'contain' }}
            >
              <div className="w-full max-w-[720px] mx-auto space-y-4 sm:space-y-6">
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
                      <div
                        className="inline-flex items-center gap-2 py-1.5 px-3 rounded-full border shadow-2xs select-none"
                        style={{
                          backgroundColor: 'var(--surface)',
                          borderColor: 'var(--border)',
                        }}
                      >
                        {mode === 'cloud' ? (
                          <>
                            <CloudMark size={16} state="generating" animated />
                            <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                              Generating…
                            </span>
                          </>
                        ) : (
                          <>
                            <SunMark size={16} state="waking" animated />
                            <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                              {streamingStage === 'loading_model' ? 'Waking model…' : 'Thinking…'}
                            </span>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Jump to latest button when user scrolled up */}
            <AnimatePresence>
              {userScrolledUp && (
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

            {/* Bottom Docked Composer */}
            <Composer />
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
};

