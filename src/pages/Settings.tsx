import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeft,
  Check,
  Copy,
  LogOut,
  Play,
  RotateCcw,
  Square,
  User,
  Volume2,
} from 'lucide-react';
import {
  getSavedSpeed,
  getSavedVoice,
  POCKET_VOICES,
  type PocketVoiceId,
  setSavedSpeed,
  setSavedVoice,
  ttsController,
} from '../lib/tts';
import { copyTextToClipboard } from '../lib/markdown';
import { useAppState } from '../state/store';
import { StatusPill } from '../components/StatusPill';

export const SettingsPage: React.FC = () => {
  const {
    session,
    userDisplayName,
    setUserDisplayName,
    settingsSection,
    openSettingsSection,
    setIsSettingsOpen,
    laptopStatus,
    signOut,
  } = useAppState();

  const [nameInput, setNameInput] = useState(userDisplayName);
  const [nameSaved, setNameSaved] = useState(false);
  const [voice, setVoice] = useState<PocketVoiceId>(() => getSavedVoice());
  const [speed, setSpeed] = useState<number>(() => getSavedSpeed());
  const [copiedId, setCopiedId] = useState(false);
  const [previewPlaying, setPreviewPlaying] = useState(false);

  useEffect(() => {
    setNameInput(userDisplayName);
  }, [userDisplayName]);

  // Keyboard shortcut: Escape exits settings back to chat
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsSettingsOpen(false);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [setIsSettingsOpen]);

  const handleNameChange = (val: string) => {
    setNameInput(val);
    const trimmed = val.trim();
    if (trimmed) {
      setUserDisplayName(trimmed);
      setNameSaved(true);
      setTimeout(() => setNameSaved(false), 1600);
    }
  };

  const handleVoiceChange = (nextVoice: PocketVoiceId) => {
    setVoice(nextVoice);
    setSavedVoice(nextVoice);
  };

  const handleSpeedChange = (nextSpeed: number) => {
    const rounded = Math.round(nextSpeed * 100) / 100;
    setSpeed(rounded);
    setSavedSpeed(rounded);
  };

  const handleResetSpeed = () => {
    setSpeed(1.0);
    setSavedSpeed(1.0);
  };

  const handleCopyUserId = async () => {
    if (!session?.user.id) return;
    const ok = await copyTextToClipboard(session.user.id);
    if (ok) {
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 1600);
    }
  };

  const handleToggleVoicePreview = () => {
    if (previewPlaying) {
      ttsController.stop();
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      setPreviewPlaying(false);
      return;
    }

    setPreviewPlaying(true);
    const sampleText = `Hello ${userDisplayName || 'there'}! I am Little Sun, speaking with the ${voice} voice.`;

    if (session?.accessToken && laptopStatus !== 'offline') {
      ttsController.toggleMessage({
        messageId: `preview-${Date.now()}`,
        markdown: sampleText,
        accessToken: session.accessToken,
      });
      setTimeout(() => setPreviewPlaying(false), 3200);
    } else if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(sampleText);
      utterance.rate = speed;
      utterance.onend = () => setPreviewPlaying(false);
      utterance.onerror = () => setPreviewPlaying(false);
      window.speechSynthesis.speak(utterance);
    } else {
      setTimeout(() => setPreviewPlaying(false), 2000);
    }
  };

  const currentTab = settingsSection === 'voices' ? 'voices' : 'account';

  return (
    <div
      className="w-full h-full flex flex-col overflow-hidden"
      style={{ backgroundColor: 'var(--bg)', color: 'var(--text)' }}
    >
      {/* Top Header Bar */}
      <header
        className="h-14 px-4 sm:px-6 border-b flex items-center justify-between gap-3 shrink-0"
        style={{
          backgroundColor: 'var(--bg)',
          borderColor: 'var(--border)',
          paddingTop: 'env(safe-area-inset-top)',
        }}
      >
        <button
          type="button"
          onClick={() => setIsSettingsOpen(false)}
          className="min-h-[38px] px-2.5 py-1.5 inline-flex items-center gap-2 text-sm font-medium transition-colors cursor-pointer hover:bg-[var(--surface-2)]"
          style={{
            color: 'var(--text)',
            borderRadius: 'var(--radius-sm)',
          }}
          aria-label="Back to chat (Esc)"
          title="Back to chat (Esc)"
        >
          <ArrowLeft className="w-4 h-4 shrink-0" style={{ color: 'var(--text-muted)' }} />
          <span>Back to chat</span>
          <kbd
            className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono border select-none"
            style={{
              borderColor: 'var(--border)',
              backgroundColor: 'var(--surface-2)',
              color: 'var(--text-muted)',
              borderRadius: '4px',
            }}
          >
            Esc
          </kbd>
        </button>

        <div className="flex items-center gap-2 shrink-0">
          <StatusPill />
        </div>
      </header>

      {/* Main Content: Centered and Top-Aligned */}
      <main
        className="flex-1 overflow-y-auto px-4 sm:px-6 pt-6 sm:pt-10 pb-16"
        style={{
          WebkitOverflowScrolling: 'touch',
          overscrollBehaviorY: 'contain',
        }}
      >
        <div className="w-full max-w-[500px] mx-auto">
          {/* Centered Horizontal Tabs (Account | Voices) */}
          <div className="flex justify-center mb-8">
            <nav
              aria-label="Settings navigation"
              className="inline-flex p-1 border select-none"
              style={{
                backgroundColor: 'var(--surface-2)',
                borderColor: 'var(--border)',
                borderRadius: '9999px',
              }}
            >
              <a
                href="/account"
                onClick={(e) => {
                  e.preventDefault();
                  openSettingsSection('account');
                }}
                className={`min-h-[36px] px-6 py-1.5 inline-flex items-center gap-2 text-sm font-medium rounded-full transition-all cursor-pointer no-underline ${
                  currentTab === 'account'
                    ? 'shadow-xs'
                    : 'hover:text-[var(--text)]'
                }`}
                style={{
                  backgroundColor: currentTab === 'account' ? 'var(--surface)' : 'transparent',
                  color: currentTab === 'account' ? 'var(--text)' : 'var(--text-muted)',
                }}
              >
                <User
                  className="w-4 h-4 shrink-0"
                  style={{ color: currentTab === 'account' ? 'var(--accent)' : 'inherit' }}
                />
                <span>Account</span>
              </a>

              <a
                href="/voices"
                onClick={(e) => {
                  e.preventDefault();
                  openSettingsSection('voices');
                }}
                className={`min-h-[36px] px-6 py-1.5 inline-flex items-center gap-2 text-sm font-medium rounded-full transition-all cursor-pointer no-underline ${
                  currentTab === 'voices'
                    ? 'shadow-xs'
                    : 'hover:text-[var(--text)]'
                }`}
                style={{
                  backgroundColor: currentTab === 'voices' ? 'var(--surface)' : 'transparent',
                  color: currentTab === 'voices' ? 'var(--text)' : 'var(--text-muted)',
                }}
              >
                <Volume2
                  className="w-4 h-4 shrink-0"
                  style={{ color: currentTab === 'voices' ? 'var(--accent)' : 'inherit' }}
                />
                <span>Voices</span>
              </a>
            </nav>
          </div>

          <AnimatePresence mode="wait">
            {/* ======================================================== */}
            {/* TAB 1: Account                                           */}
            {/* ======================================================== */}
            {currentTab === 'account' && (
              <motion.div
                key="tab-account"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
                className="space-y-4"
              >
                <div
                  className="border overflow-hidden divide-y"
                  style={{
                    backgroundColor: 'var(--surface)',
                    borderColor: 'var(--border)',
                    borderRadius: 'var(--radius-md)',
                  }}
                >
                  {/* Subdivision: Display Name */}
                  <div className="p-5" style={{ borderColor: 'var(--border)' }}>
                    <div className="flex items-center justify-between mb-2">
                      <label
                        htmlFor="ls-settings-name"
                        className="block text-xs font-medium"
                        style={{ color: 'var(--text-muted)' }}
                      >
                        Name
                      </label>
                      {nameSaved && (
                        <span className="inline-flex items-center gap-1 text-xs text-[var(--success)]">
                          <Check className="w-3.5 h-3.5" />
                          <span>Saved</span>
                        </span>
                      )}
                    </div>

                    <input
                      id="ls-settings-name"
                      type="text"
                      value={nameInput}
                      onChange={(e) => handleNameChange(e.target.value)}
                      placeholder="Your name"
                      maxLength={40}
                      className="w-full h-10 px-3.5 text-sm border transition-colors focus:outline-none focus:border-[var(--accent)]"
                      style={{
                        backgroundColor: 'var(--bg)',
                        borderColor: 'var(--border)',
                        borderRadius: 'var(--radius-sm)',
                        color: 'var(--text)',
                      }}
                    />
                    <p className="text-xs mt-1.5" style={{ color: 'var(--text-muted)' }}>
                      Shown in greetings and chat headers. Updates automatically.
                    </p>
                  </div>

                  {/* Subdivision: Email */}
                  <div
                    className="p-5 flex items-center justify-between gap-3"
                    style={{ borderColor: 'var(--border)' }}
                  >
                    <div>
                      <div className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                        Email
                      </div>
                      <div className="text-sm font-medium mt-0.5" style={{ color: 'var(--text)' }}>
                        {session?.user.email || 'you@example.com'}
                      </div>
                    </div>
                  </div>

                  {/* Subdivision: User ID */}
                  <div
                    className="p-5 flex items-center justify-between gap-3"
                    style={{ borderColor: 'var(--border)' }}
                  >
                    <div>
                      <div className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                        User ID
                      </div>
                      <div className="text-xs font-mono mt-0.5 truncate max-w-[220px] sm:max-w-[280px]" style={{ color: 'var(--text-muted)' }}>
                        {session?.user.id || 'UUID'}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleCopyUserId}
                      className="px-2.5 py-1 text-xs border inline-flex items-center gap-1.5 transition-colors cursor-pointer hover:bg-[var(--surface-2)]"
                      style={{
                        backgroundColor: 'var(--bg)',
                        borderColor: 'var(--border)',
                        color: copiedId ? 'var(--success)' : 'var(--text)',
                        borderRadius: 'var(--radius-sm)',
                      }}
                    >
                      {copiedId ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Subdivision: Sign out */}
                  <div className="p-5 flex items-center justify-between gap-3" style={{ borderColor: 'var(--border)' }}>
                    <div>
                      <div className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                        Session
                      </div>
                      <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                        Sign out of Little Sun on this device.
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={signOut}
                      className="px-3.5 py-1.5 inline-flex items-center gap-1.5 text-xs font-medium border transition-colors cursor-pointer hover:bg-red-500/10 active:scale-98"
                      style={{
                        backgroundColor: 'var(--surface-2)',
                        borderColor: 'var(--border)',
                        color: 'var(--danger)',
                        borderRadius: 'var(--radius-sm)',
                      }}
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Sign out</span>
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

            {/* ======================================================== */}
            {/* TAB 2: Voices                                            */}
            {/* ======================================================== */}
            {currentTab === 'voices' && (
              <motion.div
                key="tab-voices"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
                className="space-y-4"
              >
                <div
                  className="border overflow-hidden divide-y"
                  style={{
                    backgroundColor: 'var(--surface)',
                    borderColor: 'var(--border)',
                    borderRadius: 'var(--radius-md)',
                  }}
                >
                  {/* Subdivision 1: Available Voices */}
                  <div className="p-5" style={{ borderColor: 'var(--border)' }}>
                    <div className="text-xs font-medium mb-3" style={{ color: 'var(--text-muted)' }}>
                      Available Voices
                    </div>

                    <div className="flex flex-col gap-1.5">
                      {POCKET_VOICES.map((item) => {
                        const isSelected = item.id === voice;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => handleVoiceChange(item.id)}
                            className="w-full min-h-[42px] px-3.5 py-2 flex items-center justify-between text-left text-sm border transition-colors cursor-pointer"
                            style={{
                              backgroundColor: isSelected ? 'var(--surface-2)' : 'var(--bg)',
                              borderColor: isSelected ? 'var(--accent)' : 'var(--border)',
                              color: 'var(--text)',
                              borderRadius: 'var(--radius-sm)',
                            }}
                          >
                            <span className="font-medium">{item.label}</span>
                            {isSelected && (
                              <Check
                                className="w-4 h-4 shrink-0"
                                style={{ color: 'var(--accent)' }}
                              />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Subdivision 2: Speaking Speed */}
                  <div className="p-5" style={{ borderColor: 'var(--border)' }}>
                    <div className="flex items-center justify-between mb-2">
                      <label
                        htmlFor="ls-settings-tts-speed"
                        className="text-xs font-medium"
                        style={{ color: 'var(--text-muted)' }}
                      >
                        Speaking Speed
                      </label>
                      <div className="flex items-center gap-1.5">
                        <span
                          className="text-xs font-mono font-medium"
                          style={{ color: 'var(--text)' }}
                        >
                          {speed.toFixed(2).replace(/\.00$/, '.0')}x
                        </span>
                        {speed !== 1.0 && (
                          <button
                            type="button"
                            onClick={handleResetSpeed}
                            title="Reset to 1.0x"
                            className="p-1 text-xs text-[var(--text-muted)] hover:text-[var(--text)] transition-colors cursor-pointer"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    <input
                      id="ls-settings-tts-speed"
                      type="range"
                      min={0.75}
                      max={1.5}
                      step={0.05}
                      value={speed}
                      onChange={(e) => handleSpeedChange(Number(e.target.value))}
                      className="w-full h-2 cursor-pointer accent-[#D9822B]"
                      aria-label="Speaking Speed"
                    />

                    <div className="flex justify-between text-[11px] font-mono mt-2" style={{ color: 'var(--text-muted)' }}>
                      <span>0.75x</span>
                      <span>1.0x</span>
                      <span>1.5x</span>
                    </div>
                  </div>

                  {/* Subdivision 3: Voice Preview */}
                  <div
                    className="p-5 flex items-center justify-between gap-3"
                    style={{ borderColor: 'var(--border)' }}
                  >
                    <div>
                      <div className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                        Voice Preview
                      </div>
                      <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                        Test audio sample with current voice & speed.
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleToggleVoicePreview}
                      className="px-3.5 py-1.5 inline-flex items-center gap-1.5 text-xs font-medium border transition-colors cursor-pointer hover:bg-[var(--surface-2)] active:scale-98"
                      style={{
                        backgroundColor: previewPlaying ? 'var(--surface-2)' : 'var(--bg)',
                        borderColor: previewPlaying ? 'var(--accent)' : 'var(--border)',
                        color: previewPlaying ? 'var(--accent)' : 'var(--text)',
                        borderRadius: 'var(--radius-sm)',
                      }}
                    >
                      {previewPlaying ? (
                        <>
                          <Square className="w-3.5 h-3.5 fill-current" />
                          <span>Stop</span>
                        </>
                      ) : (
                        <>
                          <Play className="w-3.5 h-3.5 fill-current" />
                          <span>Preview</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
};
