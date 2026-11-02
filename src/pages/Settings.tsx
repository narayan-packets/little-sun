import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeft,
  Check,
  ChevronRight,
  Copy,
  Cpu,
  Globe,
  Keyboard,
  Laptop,
  LogOut,
  Play,
  Radio,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Sliders,
  Sparkles,
  Square,
  Sun,
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
import { useAppState, type SettingsRouteSection } from '../state/store';
import { StatusPill } from '../components/StatusPill';

const VOICE_PERSONAS: Record<PocketVoiceId, { description: string; gender: string }> = {
  alba: { description: 'Warm, balanced & conversational', gender: 'Neutral' },
  fantine: { description: 'Gentle, expressive & empathetic', gender: 'Feminine' },
  jean: { description: 'Calm, resonant & thoughtful', gender: 'Masculine' },
  marius: { description: 'Clear, dynamic & energetic', gender: 'Masculine' },
  javert: { description: 'Deep, steady & authoritative', gender: 'Masculine' },
  cosette: { description: 'Bright, articulate & cheerful', gender: 'Feminine' },
  eponine: { description: 'Crisp, natural & modern', gender: 'Feminine' },
  azelma: { description: 'Soft, melodic & intimate', gender: 'Feminine' },
};

export const SettingsPage: React.FC = () => {
  const {
    session,
    userDisplayName,
    setUserDisplayName,
    settingsSection,
    openSettingsSection,
    setIsSettingsOpen,
    laptopStatus,
    allModels,
    selectedModelId,
    refreshGateway,
    signOut,
  } = useAppState();

  const [nameInput, setNameInput] = useState(userDisplayName);
  const [nameSaved, setNameSaved] = useState(false);
  const [voice, setVoice] = useState<PocketVoiceId>(() => getSavedVoice());
  const [speed, setSpeed] = useState<number>(() => getSavedSpeed());
  const [copiedId, setCopiedId] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
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

  const handleRefreshConnection = async () => {
    setIsRefreshing(true);
    try {
      await refreshGateway();
    } finally {
      setTimeout(() => setIsRefreshing(false), 500);
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
    const sampleText = `Hello ${userDisplayName || 'there'}! I am Little Sun, speaking with the ${voice} voice at ${speed.toFixed(2)} speed.`;

    if (session?.accessToken && laptopStatus !== 'offline') {
      ttsController.toggleMessage({
        messageId: `preview-${Date.now()}`,
        markdown: sampleText,
        accessToken: session.accessToken,
      });
      setTimeout(() => setPreviewPlaying(false), 3600);
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

  const activeModel = allModels.find((m) => m.id === selectedModelId) || allModels[0];

  const NAV_TABS: {
    id: SettingsRouteSection;
    label: string;
    sublabel: string;
    icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
    href: string;
  }[] = [
    {
      id: 'index',
      label: 'General',
      sublabel: 'Atmosphere & shortcuts',
      icon: Sliders,
      href: '/settings',
    },
    {
      id: 'account',
      label: 'Account',
      sublabel: 'Profile & authentication',
      icon: User,
      href: '/account',
    },
    {
      id: 'voices',
      label: 'Voices',
      sublabel: 'Neural TTS & speech rate',
      icon: Volume2,
      href: '/voices',
    },
    {
      id: 'gateway',
      label: 'Gateway & Model',
      sublabel: 'Local host & slot status',
      icon: Cpu,
      href: '/settings/gateway',
    },
  ];

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
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            onClick={() => setIsSettingsOpen(false)}
            className="min-h-[38px] px-2.5 py-1.5 inline-flex items-center gap-2 text-sm font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 hover:bg-[var(--surface-2)]"
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

          <span className="hidden sm:inline text-xs text-[var(--text-muted)] select-none">/</span>
          <span className="hidden sm:inline text-xs font-medium text-[var(--text-muted)] select-none">
            {NAV_TABS.find((t) => t.id === settingsSection)?.label || 'General'}
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <StatusPill />
        </div>
      </header>

      {/* Modern Desktop Two-Column Split Layout */}
      <div className="flex-1 min-h-0 flex flex-col md:flex-row overflow-hidden">
        {/* Left Column: Horizontal Navigation Sidebar on Desktop */}
        <aside
          className="w-full md:w-64 lg:w-72 shrink-0 border-b md:border-b-0 md:border-r flex flex-col overflow-y-auto"
          style={{
            backgroundColor: 'var(--surface)',
            borderColor: 'var(--border)',
          }}
        >
          {/* Section Header */}
          <div className="p-4 md:p-5 border-b select-none" style={{ borderColor: 'var(--border)' }}>
            <h2 className="text-base font-semibold tracking-tight" style={{ color: 'var(--text)' }}>
              Settings
            </h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
              Preferences & environment
            </p>
          </div>

          {/* Navigation Tab Links (Separated routes for /settings, /account, /voices, /settings/gateway) */}
          <nav
            aria-label="Settings navigation"
            className="flex-1 p-2 md:p-3 flex md:flex-col gap-1 overflow-x-auto md:overflow-x-visible"
          >
            {NAV_TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = settingsSection === tab.id;

              return (
                <a
                  key={tab.id}
                  href={tab.href}
                  onClick={(e) => {
                    e.preventDefault();
                    openSettingsSection(tab.id);
                  }}
                  className={`min-h-[46px] md:min-h-[50px] px-3.5 py-2.5 flex items-center justify-between text-left border transition-all cursor-pointer no-underline whitespace-nowrap rounded-[var(--radius-sm)] ${
                    isActive ? 'font-medium shadow-xs' : 'font-normal hover:bg-[var(--surface-2)]'
                  }`}
                  style={{
                    backgroundColor: isActive ? 'var(--surface-2)' : 'transparent',
                    borderColor: isActive ? 'var(--border)' : 'transparent',
                    color: isActive ? 'var(--text)' : 'var(--text-muted)',
                  }}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Icon
                      className="w-4 h-4 shrink-0 transition-colors"
                      style={{ color: isActive ? 'var(--accent)' : 'var(--text-muted)' }}
                    />
                    <div className="min-w-0">
                      <div
                        className="text-sm truncate"
                        style={{ color: isActive ? 'var(--text)' : 'inherit' }}
                      >
                        {tab.label}
                      </div>
                      <div className="hidden lg:block text-[11px] truncate opacity-75">
                        {tab.sublabel}
                      </div>
                    </div>
                  </div>

                  {isActive && (
                    <div
                      className="w-1.5 h-1.5 rounded-full shrink-0"
                      style={{ backgroundColor: 'var(--accent)' }}
                    />
                  )}
                </a>
              );
            })}
          </nav>

          {/* User Mini-Profile & Sign Out Footer */}
          <div
            className="p-3.5 border-t hidden md:flex flex-col gap-2 select-none"
            style={{ borderColor: 'var(--border)' }}
          >
            <div className="flex items-center gap-2.5 px-2 py-1 min-w-0">
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center font-medium text-xs shrink-0 select-none"
                style={{
                  backgroundColor: 'var(--surface-2)',
                  color: 'var(--accent)',
                  border: '1px solid var(--border)',
                }}
              >
                {(userDisplayName || session?.user.email || 'U')[0].toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-medium truncate" style={{ color: 'var(--text)' }}>
                  {userDisplayName || 'User'}
                </div>
                <div className="text-[11px] truncate" style={{ color: 'var(--text-muted)' }}>
                  {session?.user.email || 'Authenticated'}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={signOut}
              className="w-full min-h-[36px] px-3 py-1.5 flex items-center justify-center gap-2 text-xs font-medium border transition-colors cursor-pointer hover:bg-[var(--surface-2)]"
              style={{
                borderColor: 'var(--border)',
                color: 'var(--danger)',
                borderRadius: 'var(--radius-sm)',
              }}
            >
              <LogOut className="w-3.5 h-3.5 shrink-0" />
              <span>Sign out</span>
            </button>
          </div>
        </aside>

        {/* Right Column: Expansive Content Stage with Divisions and Subdivisions */}
        <main
          className="flex-1 min-w-0 overflow-y-auto px-5 sm:px-8 md:px-12 py-6 md:py-10"
          style={{
            WebkitOverflowScrolling: 'touch',
            overscrollBehaviorY: 'contain',
            paddingBottom: 'calc(3rem + env(safe-area-inset-bottom))',
          }}
        >
          <div className="w-full max-w-[720px] mx-auto">
            <AnimatePresence mode="wait">
              {/* ======================================================== */}
              {/* TAB 1: /settings — General & Environment                 */}
              {/* ======================================================== */}
              {settingsSection === 'index' && (
                <motion.div
                  key="section-general"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                  className="space-y-8"
                >
                  {/* Page Title & Subtitle */}
                  <div>
                    <h1 className="text-xl sm:text-2xl font-semibold tracking-tight" style={{ color: 'var(--text)' }}>
                      General Settings
                    </h1>
                    <p className="text-xs sm:text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
                      Customize atmosphere, visual density, and keyboard navigation.
                    </p>
                  </div>

                  {/* Division 1: Interface & Atmosphere */}
                  <section aria-labelledby="heading-atmosphere" className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Sun className="w-4 h-4" style={{ color: 'var(--accent)' }} />
                      <h2 id="heading-atmosphere" className="text-sm font-semibold tracking-tight" style={{ color: 'var(--text)' }}>
                        Atmosphere & Theme
                      </h2>
                    </div>

                    <div
                      className="border overflow-hidden"
                      style={{
                        backgroundColor: 'var(--surface)',
                        borderColor: 'var(--border)',
                        borderRadius: 'var(--radius-md)',
                      }}
                    >
                      <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <div className="text-sm font-medium" style={{ color: 'var(--text)' }}>
                            Solar Ambient Palette
                          </div>
                          <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                            Automatically synchronizes with your operating system’s dark and light appearance.
                          </div>
                        </div>
                        <div
                          className="px-3 py-1.5 text-xs font-medium border shrink-0 inline-flex items-center gap-1.5"
                          style={{
                            backgroundColor: 'var(--surface-2)',
                            borderColor: 'var(--border)',
                            color: 'var(--accent)',
                            borderRadius: 'var(--radius-sm)',
                          }}
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>System Adaptive</span>
                        </div>
                      </div>

                      <div className="p-4 sm:p-5 border-t flex flex-col sm:flex-row sm:items-center justify-between gap-3" style={{ borderColor: 'var(--border)' }}>
                        <div>
                          <div className="text-sm font-medium" style={{ color: 'var(--text)' }}>
                            Typography & Typesetting
                          </div>
                          <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                            Editorial typography with high-fidelity KaTeX math rendering and code blocks.
                          </div>
                        </div>
                        <div
                          className="px-3 py-1.5 text-xs font-mono border shrink-0"
                          style={{
                            backgroundColor: 'var(--surface-2)',
                            borderColor: 'var(--border)',
                            color: 'var(--text-muted)',
                            borderRadius: 'var(--radius-sm)',
                          }}
                        >
                          KaTeX 0.19 + Markdown
                        </div>
                      </div>
                    </div>
                  </section>

                  {/* Division 2: Keyboard Shortcuts */}
                  <section aria-labelledby="heading-shortcuts" className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Keyboard className="w-4 h-4" style={{ color: 'var(--accent)' }} />
                      <h2 id="heading-shortcuts" className="text-sm font-semibold tracking-tight" style={{ color: 'var(--text)' }}>
                        Keyboard Navigation
                      </h2>
                    </div>

                    <div
                      className="border overflow-hidden divide-y"
                      style={{
                        backgroundColor: 'var(--surface)',
                        borderColor: 'var(--border)',
                        borderRadius: 'var(--radius-md)',
                      }}
                    >
                      <div className="p-3.5 sm:p-4 flex items-center justify-between gap-3" style={{ borderColor: 'var(--border)' }}>
                        <div className="text-xs sm:text-sm" style={{ color: 'var(--text)' }}>
                          New conversation & sleep model slot
                        </div>
                        <kbd
                          className="px-2 py-1 text-xs font-mono border shrink-0"
                          style={{
                            backgroundColor: 'var(--surface-2)',
                            borderColor: 'var(--border)',
                            color: 'var(--text)',
                            borderRadius: '6px',
                          }}
                        >
                          Ctrl / Cmd + Shift + O
                        </kbd>
                      </div>

                      <div className="p-3.5 sm:p-4 flex items-center justify-between gap-3" style={{ borderColor: 'var(--border)' }}>
                        <div className="text-xs sm:text-sm" style={{ color: 'var(--text)' }}>
                          Toggle sidebar navigation
                        </div>
                        <kbd
                          className="px-2 py-1 text-xs font-mono border shrink-0"
                          style={{
                            backgroundColor: 'var(--surface-2)',
                            borderColor: 'var(--border)',
                            color: 'var(--text)',
                            borderRadius: '6px',
                          }}
                        >
                          Ctrl / Cmd + K
                        </kbd>
                      </div>

                      <div className="p-3.5 sm:p-4 flex items-center justify-between gap-3" style={{ borderColor: 'var(--border)' }}>
                        <div className="text-xs sm:text-sm" style={{ color: 'var(--text)' }}>
                          Exit settings / close modals
                        </div>
                        <kbd
                          className="px-2 py-1 text-xs font-mono border shrink-0"
                          style={{
                            backgroundColor: 'var(--surface-2)',
                            borderColor: 'var(--border)',
                            color: 'var(--text)',
                            borderRadius: '6px',
                          }}
                        >
                          Esc
                        </kbd>
                      </div>

                      <div className="p-3.5 sm:p-4 flex items-center justify-between gap-3" style={{ borderColor: 'var(--border)' }}>
                        <div className="text-xs sm:text-sm" style={{ color: 'var(--text)' }}>
                          Send prompt / newline
                        </div>
                        <kbd
                          className="px-2 py-1 text-xs font-mono border shrink-0"
                          style={{
                            backgroundColor: 'var(--surface-2)',
                            borderColor: 'var(--border)',
                            color: 'var(--text)',
                            borderRadius: '6px',
                          }}
                        >
                          Enter / Shift + Enter
                        </kbd>
                      </div>
                    </div>
                  </section>

                  {/* Division 3: Software & Version */}
                  <section aria-labelledby="heading-system" className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Globe className="w-4 h-4" style={{ color: 'var(--accent)' }} />
                      <h2 id="heading-system" className="text-sm font-semibold tracking-tight" style={{ color: 'var(--text)' }}>
                        Environment
                      </h2>
                    </div>

                    <div
                      className="p-4 sm:p-5 border flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      style={{
                        backgroundColor: 'var(--surface)',
                        borderColor: 'var(--border)',
                        borderRadius: 'var(--radius-md)',
                      }}
                    >
                      <div>
                        <div className="text-sm font-medium" style={{ color: 'var(--text)' }}>
                          Little Sun Client
                        </div>
                        <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                          Interactive 2D math plotter, KaTeX typesetting & neural voice synthesis.
                        </div>
                      </div>
                      <span
                        className="px-2.5 py-1 text-xs font-mono border self-start sm:self-auto"
                        style={{
                          backgroundColor: 'var(--surface-2)',
                          borderColor: 'var(--border)',
                          color: 'var(--accent)',
                          borderRadius: 'var(--radius-sm)',
                        }}
                      >
                        v1.3.0 (Fork Ready)
                      </span>
                    </div>
                  </section>
                </motion.div>
              )}

              {/* ======================================================== */}
              {/* TAB 2: /account — Profile & Authentication               */}
              {/* ======================================================== */}
              {settingsSection === 'account' && (
                <motion.div
                  key="section-account"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                  className="space-y-8"
                >
                  {/* Page Title & Subtitle */}
                  <div>
                    <h1 className="text-xl sm:text-2xl font-semibold tracking-tight" style={{ color: 'var(--text)' }}>
                      Account & Identity
                    </h1>
                    <p className="text-xs sm:text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
                      Manage your profile display name, session authentication, and database security.
                    </p>
                  </div>

                  {/* Subdivision 1: Profile Information */}
                  <section aria-labelledby="account-profile" className="space-y-3">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4" style={{ color: 'var(--accent)' }} />
                      <h2 id="account-profile" className="text-sm font-semibold tracking-tight" style={{ color: 'var(--text)' }}>
                        Profile Information
                      </h2>
                    </div>

                    <div
                      className="p-5 sm:p-6 border space-y-5"
                      style={{
                        backgroundColor: 'var(--surface)',
                        borderColor: 'var(--border)',
                        borderRadius: 'var(--radius-md)',
                      }}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label
                            htmlFor="ls-settings-name"
                            className="block text-xs font-medium"
                            style={{ color: 'var(--text-muted)' }}
                          >
                            Display Name
                          </label>
                          {nameSaved && (
                            <span className="inline-flex items-center gap-1 text-xs text-[var(--success)] animate-pulse">
                              <Check className="w-3.5 h-3.5" />
                              <span>Saved automatically</span>
                            </span>
                          )}
                        </div>

                        <input
                          id="ls-settings-name"
                          type="text"
                          value={nameInput}
                          onChange={(e) => handleNameChange(e.target.value)}
                          placeholder="Your display name"
                          maxLength={40}
                          className="w-full h-11 px-3.5 text-sm border transition-colors focus:outline-none focus:border-[var(--accent)]"
                          style={{
                            backgroundColor: 'var(--bg)',
                            borderColor: 'var(--border)',
                            borderRadius: 'var(--radius-sm)',
                            color: 'var(--text)',
                          }}
                        />
                        <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
                          Used in greetings, assistant headers, and voice synthesis personalization.
                        </p>
                      </div>
                    </div>
                  </section>

                  {/* Subdivision 2: Authentication & Row-Level Security */}
                  <section aria-labelledby="account-security" className="space-y-3">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4" style={{ color: 'var(--accent)' }} />
                      <h2 id="account-security" className="text-sm font-semibold tracking-tight" style={{ color: 'var(--text)' }}>
                        Authentication & Security
                      </h2>
                    </div>

                    <div
                      className="border overflow-hidden divide-y"
                      style={{
                        backgroundColor: 'var(--surface)',
                        borderColor: 'var(--border)',
                        borderRadius: 'var(--radius-md)',
                      }}
                    >
                      <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3" style={{ borderColor: 'var(--border)' }}>
                        <div>
                          <div className="text-sm font-medium" style={{ color: 'var(--text)' }}>
                            Email Address
                          </div>
                          <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                            Authenticated through invite-only Supabase provider.
                          </div>
                        </div>
                        <div className="text-sm font-mono" style={{ color: 'var(--text)' }}>
                          {session?.user.email || 'you@example.com'}
                        </div>
                      </div>

                      <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3" style={{ borderColor: 'var(--border)' }}>
                        <div>
                          <div className="text-sm font-medium" style={{ color: 'var(--text)' }}>
                            User Reference ID
                          </div>
                          <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                            Unique identifier used for Postgres Row-Level Security (RLS).
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={handleCopyUserId}
                          className="px-2.5 py-1 text-xs font-mono border inline-flex items-center gap-1.5 transition-colors cursor-pointer self-start sm:self-auto hover:bg-[var(--surface-2)]"
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
                              <span>Copied UUID</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              <span className="truncate max-w-[150px]">{session?.user.id || 'UUID'}</span>
                            </>
                          )}
                        </button>
                      </div>

                      <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3" style={{ borderColor: 'var(--border)' }}>
                        <div>
                          <div className="text-sm font-medium" style={{ color: 'var(--text)' }}>
                            Database Isolation
                          </div>
                          <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                            Postgres Row-Level Security ensures only your authenticated UID can query or decrypt messages.
                          </div>
                        </div>
                        <span
                          className="px-2.5 py-1 text-xs font-medium border shrink-0 inline-flex items-center gap-1 text-[var(--success)]"
                          style={{
                            backgroundColor: 'var(--surface-2)',
                            borderColor: 'var(--border)',
                            borderRadius: 'var(--radius-sm)',
                          }}
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>RLS Active</span>
                        </span>
                      </div>
                    </div>
                  </section>

                  {/* Subdivision 3: Danger Zone */}
                  <section aria-labelledby="account-danger" className="space-y-3">
                    <div className="flex items-center gap-2">
                      <LogOut className="w-4 h-4 text-[var(--danger)]" />
                      <h2 id="account-danger" className="text-sm font-semibold tracking-tight text-[var(--danger)]">
                        Session & Danger Zone
                      </h2>
                    </div>

                    <div
                      className="p-5 border flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                      style={{
                        backgroundColor: 'var(--surface)',
                        borderColor: 'var(--border)',
                        borderRadius: 'var(--radius-md)',
                      }}
                    >
                      <div>
                        <div className="text-sm font-medium" style={{ color: 'var(--text)' }}>
                          Sign out of this browser
                        </div>
                        <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                          Clears local session tokens. Your synced conversations remain preserved in Supabase.
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={signOut}
                        className="px-4 py-2 inline-flex items-center justify-center gap-2 text-xs font-medium border transition-colors cursor-pointer active:scale-98 hover:bg-red-500/10"
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
                  </section>
                </motion.div>
              )}

              {/* ======================================================== */}
              {/* TAB 3: /voices — Neural Voice & Speech Settings          */}
              {/* ======================================================== */}
              {settingsSection === 'voices' && (
                <motion.div
                  key="section-voices"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                  className="space-y-8"
                >
                  {/* Page Title & Subtitle */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <h1 className="text-xl sm:text-2xl font-semibold tracking-tight" style={{ color: 'var(--text)' }}>
                        Voice & Speech
                      </h1>
                      <p className="text-xs sm:text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
                        Configure Piper neural speech streaming from your laptop or browser Web Speech fallback.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={handleToggleVoicePreview}
                      className="px-3.5 py-2 inline-flex items-center justify-center gap-2 text-xs font-medium border shadow-xs transition-all cursor-pointer self-start sm:self-auto hover:bg-[var(--surface-2)] active:scale-98"
                      style={{
                        backgroundColor: previewPlaying ? 'var(--surface-2)' : 'var(--surface)',
                        borderColor: previewPlaying ? 'var(--accent)' : 'var(--border)',
                        color: previewPlaying ? 'var(--accent)' : 'var(--text)',
                        borderRadius: 'var(--radius-sm)',
                      }}
                    >
                      {previewPlaying ? (
                        <>
                          <Square className="w-3.5 h-3.5 fill-current" />
                          <span>Stop Preview</span>
                        </>
                      ) : (
                        <>
                          <Play className="w-3.5 h-3.5 fill-current" />
                          <span>Preview {POCKET_VOICES.find((v) => v.id === voice)?.label || voice}</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Subdivision 1: Voice Persona Selection */}
                  <section aria-labelledby="voices-selection" className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Volume2 className="w-4 h-4" style={{ color: 'var(--accent)' }} />
                        <h2 id="voices-selection" className="text-sm font-semibold tracking-tight" style={{ color: 'var(--text)' }}>
                          Available Personalities
                        </h2>
                      </div>
                      <span className="text-xs font-mono text-[var(--text-muted)]">
                        {POCKET_VOICES.length} Neural Voices
                      </span>
                    </div>

                    {/* Responsive Grid of Voice Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {POCKET_VOICES.map((item) => {
                        const isSelected = item.id === voice;
                        const persona = VOICE_PERSONAS[item.id] || { description: 'Natural neural voice', gender: 'Voice' };

                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => handleVoiceChange(item.id)}
                            className="p-3.5 flex flex-col justify-between text-left border transition-all cursor-pointer rounded-[var(--radius-md)] relative overflow-hidden group hover:border-[var(--accent)]"
                            style={{
                              backgroundColor: isSelected ? 'var(--surface-2)' : 'var(--surface)',
                              borderColor: isSelected ? 'var(--accent)' : 'var(--border)',
                              color: 'var(--text)',
                            }}
                          >
                            <div className="flex items-center justify-between gap-2 mb-1.5">
                              <span className="font-semibold text-sm tracking-tight flex items-center gap-2">
                                <span>{item.label}</span>
                                <span
                                  className="text-[10px] px-1.5 py-0.5 border font-normal"
                                  style={{
                                    borderColor: 'var(--border)',
                                    color: 'var(--text-muted)',
                                    borderRadius: '4px',
                                  }}
                                >
                                  {persona.gender}
                                </span>
                              </span>

                              {isSelected ? (
                                <div
                                  className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
                                  style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-contrast)' }}
                                >
                                  <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                                </div>
                              ) : (
                                <div
                                  className="w-5 h-5 rounded-full border shrink-0 opacity-40 group-hover:opacity-80"
                                  style={{ borderColor: 'var(--border)' }}
                                />
                              )}
                            </div>

                            <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                              {persona.description}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  </section>

                  {/* Subdivision 2: Speech Rate & Speed Control */}
                  <section aria-labelledby="voices-rate" className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Sliders className="w-4 h-4" style={{ color: 'var(--accent)' }} />
                      <h2 id="voices-rate" className="text-sm font-semibold tracking-tight" style={{ color: 'var(--text)' }}>
                        Playback Speed
                      </h2>
                    </div>

                    <div
                      className="p-5 sm:p-6 border space-y-4"
                      style={{
                        backgroundColor: 'var(--surface)',
                        borderColor: 'var(--border)',
                        borderRadius: 'var(--radius-md)',
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-sm font-medium" style={{ color: 'var(--text)' }}>
                            Speaking Rate
                          </div>
                          <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                            Adjust synthesis speed between 0.75x (deliberate) and 1.50x (accelerated).
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <span
                            className="px-2.5 py-1 text-xs font-mono font-medium border"
                            style={{
                              backgroundColor: 'var(--surface-2)',
                              borderColor: 'var(--border)',
                              color: 'var(--accent)',
                              borderRadius: 'var(--radius-sm)',
                            }}
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

                      <div className="flex justify-between text-[11px] font-mono" style={{ color: 'var(--text-muted)' }}>
                        <span>0.75x</span>
                        <span>1.00x (Standard)</span>
                        <span>1.25x</span>
                        <span>1.50x</span>
                      </div>
                    </div>
                  </section>
                </motion.div>
              )}

              {/* ======================================================== */}
              {/* TAB 4: /settings/gateway — Local Gateway & Inference     */}
              {/* ======================================================== */}
              {settingsSection === 'gateway' && (
                <motion.div
                  key="section-gateway"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                  className="space-y-8"
                >
                  {/* Page Title & Subtitle */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <h1 className="text-xl sm:text-2xl font-semibold tracking-tight" style={{ color: 'var(--text)' }}>
                        Gateway & Models
                      </h1>
                      <p className="text-xs sm:text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
                        Local laptop supervisor, GGUF slot eviction & Tailscale Funnel health.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={handleRefreshConnection}
                      disabled={isRefreshing}
                      className="px-3.5 py-2 inline-flex items-center justify-center gap-2 text-xs font-medium border shadow-xs transition-all cursor-pointer self-start sm:self-auto hover:bg-[var(--surface-2)] active:scale-98 disabled:opacity-50"
                      style={{
                        backgroundColor: 'var(--surface)',
                        borderColor: 'var(--border)',
                        color: 'var(--text)',
                        borderRadius: 'var(--radius-sm)',
                      }}
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                      <span>Ping Gateway</span>
                    </button>
                  </div>

                  {/* Subdivision 1: Active Model & Zero Leakage */}
                  <section aria-labelledby="gateway-models" className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Cpu className="w-4 h-4" style={{ color: 'var(--accent)' }} />
                      <h2 id="gateway-models" className="text-sm font-semibold tracking-tight" style={{ color: 'var(--text)' }}>
                        Inference Slot Configuration
                      </h2>
                    </div>

                    <div
                      className="border overflow-hidden divide-y"
                      style={{
                        backgroundColor: 'var(--surface)',
                        borderColor: 'var(--border)',
                        borderRadius: 'var(--radius-md)',
                      }}
                    >
                      <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3" style={{ borderColor: 'var(--border)' }}>
                        <div>
                          <div className="text-sm font-medium" style={{ color: 'var(--text)' }}>
                            Active Model Persona
                          </div>
                          <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                            Clean alias mapped in your laptop’s models.json.
                          </div>
                        </div>
                        <span
                          className="px-3 py-1.5 text-xs font-semibold border inline-flex items-center gap-1.5"
                          style={{
                            backgroundColor: 'var(--surface-2)',
                            borderColor: 'var(--border)',
                            color: 'var(--accent)',
                            borderRadius: 'var(--radius-sm)',
                          }}
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>{activeModel?.name || 'Sun Core'}</span>
                        </span>
                      </div>

                      <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3" style={{ borderColor: 'var(--border)' }}>
                        <div>
                          <div className="text-sm font-medium" style={{ color: 'var(--text)' }}>
                            Zero Model Leakage
                          </div>
                          <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                            Raw GGUF filenames and file system locations remain private to your local device.
                          </div>
                        </div>
                        <span
                          className="px-2.5 py-1 text-xs font-medium border text-[var(--success)] shrink-0 inline-flex items-center gap-1"
                          style={{
                            backgroundColor: 'var(--surface-2)',
                            borderColor: 'var(--border)',
                            borderRadius: 'var(--radius-sm)',
                          }}
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Hardware Sovereign</span>
                        </span>
                      </div>

                      <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3" style={{ borderColor: 'var(--border)' }}>
                        <div>
                          <div className="text-sm font-medium" style={{ color: 'var(--text)' }}>
                            Per-Chat Memory Isolation
                          </div>
                          <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                            Switching or closing conversations immediately signals the supervisor to sleep KV slots.
                          </div>
                        </div>
                        <span className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>
                          60s Idle Auto-Unload
                        </span>
                      </div>
                    </div>
                  </section>

                  {/* Subdivision 2: Connection Status */}
                  <section aria-labelledby="gateway-connection" className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Radio className="w-4 h-4" style={{ color: 'var(--accent)' }} />
                      <h2 id="gateway-connection" className="text-sm font-semibold tracking-tight" style={{ color: 'var(--text)' }}>
                        Network & Tunnel
                      </h2>
                    </div>

                    <div
                      className="p-5 border space-y-4"
                      style={{
                        backgroundColor: 'var(--surface)',
                        borderColor: 'var(--border)',
                        borderRadius: 'var(--radius-md)',
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Laptop className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                          <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>
                            Hardware Supervisor
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span
                            className="w-2 h-2 rounded-full"
                            style={{
                              backgroundColor:
                                laptopStatus === 'ready'
                                  ? 'var(--success)'
                                  : laptopStatus === 'sleeping' || laptopStatus === 'waking'
                                  ? 'var(--accent)'
                                  : 'var(--danger)',
                            }}
                          />
                          <span className="text-xs font-mono capitalize" style={{ color: 'var(--text)' }}>
                            {laptopStatus}
                          </span>
                        </div>
                      </div>

                      <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                        The Little Sun Web client connects directly to your laptop over an end-to-end encrypted
                        Tailscale Funnel. You can run inference and voice from anywhere without cloud subscription dependencies.
                      </p>
                    </div>
                  </section>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </main>
      </div>
    </div>
  );
};
