import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import {
  ArrowLeft,
  Check,
  ChevronRight,
  LogOut,
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
} from '../lib/tts';
import { useAppState } from '../state/store';
import { StatusPill } from '../components/StatusPill';

export const SettingsPage: React.FC = () => {
  const {
    userDisplayName,
    setUserDisplayName,
    settingsSection,
    openSettingsSection,
    setIsSettingsOpen,
    signOut,
  } = useAppState();

  const [nameInput, setNameInput] = useState(userDisplayName);
  const [voice, setVoice] = useState<PocketVoiceId>(() => getSavedVoice());
  const [speed, setSpeed] = useState<number>(() => getSavedSpeed());

  useEffect(() => {
    setNameInput(userDisplayName);
  }, [userDisplayName]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (settingsSection !== 'index') {
          openSettingsSection('index');
        } else {
          setIsSettingsOpen(false);
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [settingsSection, openSettingsSection, setIsSettingsOpen]);

  const handleNameChange = (val: string) => {
    setNameInput(val);
    const trimmed = val.trim();
    if (trimmed) {
      setUserDisplayName(trimmed);
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

  const isSubPage = settingsSection === 'account' || settingsSection === 'voices';

  return (
    <motion.main
      key={settingsSection}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 4 }}
      transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
      className="w-full h-full flex flex-col overflow-hidden"
      style={{ backgroundColor: 'var(--bg)', color: 'var(--text)' }}
    >
      {/* Top Bar */}
      <header
        className="h-14 px-3 sm:px-5 border-b flex items-center justify-between gap-2 shrink-0"
        style={{
          backgroundColor: 'var(--bg)',
          borderColor: 'var(--border)',
          paddingTop: 'env(safe-area-inset-top)',
        }}
      >
        <div className="flex items-center gap-1.5 min-w-0">
          {isSubPage ? (
            <a
              href="/settings"
              onClick={(e) => {
                e.preventDefault();
                openSettingsSection('index');
              }}
              className="min-h-[42px] px-2.5 py-1.5 inline-flex items-center gap-2 text-sm font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 no-underline"
              style={{
                color: 'var(--text)',
                borderRadius: 'var(--radius-sm)',
              }}
              aria-label="Back to settings"
            >
              <ArrowLeft className="w-4 h-4 shrink-0" style={{ color: 'var(--text-muted)' }} />
              <span>Settings</span>
            </a>
          ) : (
            <button
              type="button"
              onClick={() => setIsSettingsOpen(false)}
              className="min-h-[42px] px-2.5 py-1.5 inline-flex items-center gap-2 text-sm font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0"
              style={{
                color: 'var(--text)',
                borderRadius: 'var(--radius-sm)',
              }}
              aria-label="Back to chat"
            >
              <ArrowLeft className="w-4 h-4 shrink-0" style={{ color: 'var(--text-muted)' }} />
              <span>Back to chat</span>
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <StatusPill />
        </div>
      </header>

      {/* Page Content */}
      <div
        className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 sm:py-10"
        style={{
          WebkitOverflowScrolling: 'touch',
          overscrollBehaviorY: 'contain',
          paddingBottom: 'calc(2.5rem + env(safe-area-inset-bottom))',
        }}
      >
        <div className="w-full max-w-[540px] mx-auto">
          {/* 1. /settings — Dedicated Vertical Links Hub */}
          {settingsSection === 'index' && (
            <div>
              <h1 className="text-xl sm:text-2xl font-semibold tracking-tight mb-5">Settings</h1>

              <nav aria-label="Settings pages" className="flex flex-col gap-2">
                <a
                  href="/account"
                  onClick={(e) => {
                    e.preventDefault();
                    openSettingsSection('account');
                  }}
                  className="w-full min-h-[54px] px-4 py-3 flex items-center justify-between gap-3 text-sm font-medium border transition-colors cursor-pointer no-underline"
                  style={{
                    backgroundColor: 'var(--surface)',
                    borderColor: 'var(--border)',
                    color: 'var(--text)',
                    borderRadius: 'var(--radius-md)',
                  }}
                >
                  <span className="flex items-center gap-3">
                    <User className="w-4 h-4 shrink-0" style={{ color: 'var(--text-muted)' }} />
                    <span>Account</span>
                  </span>
                  <ChevronRight className="w-4 h-4 shrink-0" style={{ color: 'var(--text-muted)' }} />
                </a>

                <a
                  href="/voices"
                  onClick={(e) => {
                    e.preventDefault();
                    openSettingsSection('voices');
                  }}
                  className="w-full min-h-[54px] px-4 py-3 flex items-center justify-between gap-3 text-sm font-medium border transition-colors cursor-pointer no-underline"
                  style={{
                    backgroundColor: 'var(--surface)',
                    borderColor: 'var(--border)',
                    color: 'var(--text)',
                    borderRadius: 'var(--radius-md)',
                  }}
                >
                  <span className="flex items-center gap-3">
                    <Volume2 className="w-4 h-4 shrink-0" style={{ color: 'var(--text-muted)' }} />
                    <span>Voices</span>
                  </span>
                  <ChevronRight className="w-4 h-4 shrink-0" style={{ color: 'var(--text-muted)' }} />
                </a>
              </nav>

              <div className="mt-8 pt-6 border-t" style={{ borderColor: 'var(--border)' }}>
                <button
                  type="button"
                  onClick={signOut}
                  className="w-full min-h-[46px] px-4 py-2.5 flex items-center justify-center gap-2 text-sm font-medium border transition-colors cursor-pointer"
                  style={{
                    backgroundColor: 'var(--surface)',
                    borderColor: 'var(--border)',
                    color: '#ef4444',
                    borderRadius: 'var(--radius-md)',
                  }}
                >
                  <LogOut className="w-4 h-4 shrink-0" />
                  <span>Sign out</span>
                </button>
              </div>
            </div>
          )}

          {/* 2. /account — Sub-page for Account > Name */}
          {settingsSection === 'account' && (
            <section aria-labelledby="settings-page-account">
              <div
                id="settings-page-account"
                className="flex items-center gap-1.5 text-base font-medium mb-5"
              >
                <span style={{ color: 'var(--text-muted)' }}>Account</span>
                <ChevronRight
                  className="w-4 h-4 shrink-0"
                  style={{ color: 'var(--text-muted)' }}
                />
                <span className="font-semibold" style={{ color: 'var(--text)' }}>
                  Name
                </span>
              </div>

              <div
                className="p-5 sm:p-6 border"
                style={{
                  backgroundColor: 'var(--surface)',
                  borderColor: 'var(--border)',
                  borderRadius: 'var(--radius-md)',
                }}
              >
                <div className="mb-6">
                  <label
                    htmlFor="ls-settings-name"
                    className="block text-xs font-medium mb-2"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    Name
                  </label>
                  <input
                    id="ls-settings-name"
                    type="text"
                    value={nameInput}
                    onChange={(e) => handleNameChange(e.target.value)}
                    placeholder="Your name"
                    maxLength={40}
                    className="w-full h-11 px-3.5 text-sm leading-normal border transition-colors focus:outline-none"
                    style={{
                      backgroundColor: 'var(--bg)',
                      borderColor: 'var(--border)',
                      borderRadius: 'var(--radius-sm)',
                      color: 'var(--text)',
                    }}
                  />
                  <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
                    Shown in greetings and chat headers. Updates automatically.
                  </p>
                </div>

                <div className="pt-4 border-t" style={{ borderColor: 'var(--border)' }}>
                  <button
                    type="button"
                    onClick={signOut}
                    className="inline-flex items-center gap-2 text-xs font-medium transition-colors cursor-pointer"
                    style={{ color: '#ef4444' }}
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Sign out of account</span>
                  </button>
                </div>
              </div>
            </section>
          )}

          {/* 3. /voices — Sub-page for Voices */}
          {settingsSection === 'voices' && (
            <section aria-labelledby="settings-page-voices">
              <div
                id="settings-page-voices"
                className="flex items-center gap-1.5 text-base font-medium mb-5"
              >
                <span style={{ color: 'var(--text-muted)' }}>Voices</span>
                <ChevronRight
                  className="w-4 h-4 shrink-0"
                  style={{ color: 'var(--text-muted)' }}
                />
                <span className="font-semibold" style={{ color: 'var(--text)' }}>
                  Selection & Speed
                </span>
              </div>

              <div
                className="p-5 sm:p-6 border"
                style={{
                  backgroundColor: 'var(--surface)',
                  borderColor: 'var(--border)',
                  borderRadius: 'var(--radius-md)',
                }}
              >
                <div className="mb-6">
                  <div className="text-xs font-medium mb-2.5" style={{ color: 'var(--text-muted)' }}>
                    Available Voices
                  </div>

                  <div className="flex flex-col gap-2">
                    {POCKET_VOICES.map((item) => {
                      const isSelected = item.id === voice;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => handleVoiceChange(item.id)}
                          className="w-full min-h-[44px] px-3.5 py-2.5 flex items-center justify-between text-left text-sm border transition-colors cursor-pointer"
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

                <div className="pt-5 border-t" style={{ borderColor: 'var(--border)' }}>
                  <div className="flex items-center justify-between mb-2">
                    <label
                      htmlFor="ls-settings-tts-speed"
                      className="text-xs font-medium"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      Speaking Speed
                    </label>
                    <span
                      className="text-xs font-medium"
                      style={{ color: 'var(--text)', fontFamily: 'var(--font-mono)' }}
                    >
                      {speed.toFixed(2).replace(/\.00$/, '.0')}x
                    </span>
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
                  />
                </div>
              </div>
            </section>
          )}
        </div>
      </div>
    </motion.main>
  );
};
