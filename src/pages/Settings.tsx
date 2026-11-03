import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeft,
  Check,
  Cloud,
  Eye,
  EyeOff,
  LogOut,
  RefreshCw,
  RotateCcw,
  Trash2,
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
import {
  CLOUD_PROVIDERS,
  type CloudProviderId,
  MAX_API_KEYS,
} from '../lib/cloudApi';

export const SettingsPage: React.FC = () => {
  const {
    session,
    userDisplayName,
    setUserDisplayName,
    cloudConfig,
    addCloudApiKey,
    unlinkCloudApiKey,
    refreshCloudApiKeyModels,
    models,
    selectedModelId,
    setSelectedModelId,
    settingsSection,
    openSettingsSection,
    setIsSettingsOpen,
    signOut,
  } = useAppState();

  const [nameInput, setNameInput] = useState(userDisplayName);
  const [nameSaved, setNameSaved] = useState(false);
  const [voice, setVoice] = useState<PocketVoiceId>(() => getSavedVoice());
  const [speed, setSpeed] = useState<number>(() => getSavedSpeed());

  // Cloud API Link Form State
  const [selectedProvider, setSelectedProvider] = useState<CloudProviderId>('openrouter');
  const [newKeyInput, setNewKeyInput] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [newBaseUrlInput, setNewBaseUrlInput] = useState(CLOUD_PROVIDERS.openrouter.defaultBaseUrl);
  const [isAddingKey, setIsAddingKey] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);

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

  const handleSelectProvider = (pid: CloudProviderId) => {
    setSelectedProvider(pid);
    setNewBaseUrlInput(CLOUD_PROVIDERS[pid].defaultBaseUrl);
    setLinkError(null);
  };

  const handleLinkKey = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanKey = newKeyInput.trim();
    if (!cleanKey && selectedProvider !== 'custom') return;

    setIsAddingKey(true);
    setLinkError(null);

    try {
      await addCloudApiKey({
        provider: selectedProvider,
        apiKey: cleanKey,
        baseUrl: newBaseUrlInput.trim() || CLOUD_PROVIDERS[selectedProvider].defaultBaseUrl,
      });
      setNewKeyInput('');
    } catch (err) {
      setLinkError(err instanceof Error ? err.message : 'Failed to link API key');
    } finally {
      setIsAddingKey(false);
    }
  };

  const currentTab = settingsSection === 'voices' ? 'voices' : settingsSection === 'cloud' ? 'cloud' : 'account';
  const canAddMoreKeys = cloudConfig.keys.length < MAX_API_KEYS;

  return (
    <div
      className="w-full h-full flex flex-col overflow-hidden"
      style={{
        backgroundColor: 'var(--bg)',
        backgroundImage: 'var(--ambient-glow)',
        color: 'var(--text)',
      }}
    >
      {/* Top Header Bar */}
      <header
        className="px-3.5 sm:px-6 border-b flex items-center justify-between gap-3 shrink-0"
        style={{
          backgroundColor: 'var(--bg)',
          borderColor: 'var(--border)',
          minHeight: '3.5rem',
          paddingTop: 'env(safe-area-inset-top, 0px)',
        }}
      >
        <button
          type="button"
          onClick={() => setIsSettingsOpen(false)}
          className="min-h-[40px] px-2.5 py-1.5 inline-flex items-center gap-2 text-sm font-medium transition-colors cursor-pointer hover:bg-[var(--surface-2)] active:scale-[0.98]"
          style={{
            color: 'var(--text)',
            borderRadius: 'var(--radius-sm)',
          }}
          aria-label="Back to chat (Esc)"
          title="Back to chat (Esc)"
        >
          <ArrowLeft className="w-4 h-4 shrink-0" style={{ color: 'var(--text-muted)' }} />
          <span>
            Back<span className="hidden sm:inline"> to chat</span>
          </span>
          <kbd
            className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono border select-none ml-0.5"
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

        {/* Mobile Page Title */}
        <h1
          className="text-sm font-semibold sm:hidden truncate"
          style={{ color: 'var(--text)' }}
        >
          Settings
        </h1>

        <div className="flex items-center gap-2 shrink-0">
          <StatusPill />
        </div>
      </header>

      {/* Main Content */}
      <main
        className="flex-1 overflow-y-auto px-4 sm:px-6 pt-5 sm:pt-8 pb-12 sm:pb-16"
        style={{
          WebkitOverflowScrolling: 'touch',
          overscrollBehaviorY: 'contain',
          paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 3rem)',
        }}
      >
        <div className="w-full max-w-[500px] mx-auto">
          {/* Centered Segmented Navigation (Account | Cloud API | Voices) */}
          <div className="flex justify-center mb-6 sm:mb-8">
            <nav
              aria-label="Settings navigation"
              className="w-full max-w-[400px] grid grid-cols-3 p-1 border select-none rounded-full"
              style={{
                backgroundColor: 'var(--surface-2)',
                borderColor: 'var(--border)',
              }}
            >
              <a
                href="/account"
                onClick={(e) => {
                  e.preventDefault();
                  openSettingsSection('account');
                }}
                className={`min-h-[38px] px-2 sm:px-4 py-1.5 inline-flex items-center justify-center gap-1.5 text-xs sm:text-sm font-medium rounded-full transition-all cursor-pointer no-underline active:scale-[0.98] ${
                  currentTab === 'account'
                    ? 'shadow-xs font-semibold'
                    : 'hover:text-[var(--text)]'
                }`}
                style={{
                  backgroundColor: currentTab === 'account' ? 'var(--surface)' : 'transparent',
                  color: currentTab === 'account' ? 'var(--text)' : 'var(--text-muted)',
                }}
              >
                <User
                  className="w-3.5 h-3.5 shrink-0"
                  style={{ color: currentTab === 'account' ? 'var(--accent)' : 'inherit' }}
                />
                <span>Account</span>
              </a>

              <a
                href="/cloud"
                onClick={(e) => {
                  e.preventDefault();
                  openSettingsSection('cloud');
                }}
                className={`min-h-[38px] px-2 sm:px-4 py-1.5 inline-flex items-center justify-center gap-1.5 text-xs sm:text-sm font-medium rounded-full transition-all cursor-pointer no-underline active:scale-[0.98] ${
                  currentTab === 'cloud'
                    ? 'shadow-xs font-semibold'
                    : 'hover:text-[var(--text)]'
                }`}
                style={{
                  backgroundColor: currentTab === 'cloud' ? 'var(--surface)' : 'transparent',
                  color: currentTab === 'cloud' ? 'var(--text)' : 'var(--text-muted)',
                }}
              >
                <Cloud
                  className="w-3.5 h-3.5 shrink-0"
                  style={{ color: currentTab === 'cloud' ? 'var(--accent)' : 'inherit' }}
                />
                <span>Cloud API</span>
              </a>

              <a
                href="/voices"
                onClick={(e) => {
                  e.preventDefault();
                  openSettingsSection('voices');
                }}
                className={`min-h-[38px] px-2 sm:px-4 py-1.5 inline-flex items-center justify-center gap-1.5 text-xs sm:text-sm font-medium rounded-full transition-all cursor-pointer no-underline active:scale-[0.98] ${
                  currentTab === 'voices'
                    ? 'shadow-xs font-semibold'
                    : 'hover:text-[var(--text)]'
                }`}
                style={{
                  backgroundColor: currentTab === 'voices' ? 'var(--surface)' : 'transparent',
                  color: currentTab === 'voices' ? 'var(--text)' : 'var(--text-muted)',
                }}
              >
                <Volume2
                  className="w-3.5 h-3.5 shrink-0"
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
                  className="border overflow-hidden divide-y shadow-xs"
                  style={{
                    backgroundColor: 'var(--surface)',
                    borderColor: 'var(--border)',
                    borderRadius: 'var(--radius-md)',
                  }}
                >
                  {/* Display Name */}
                  <div className="p-4 sm:p-5" style={{ borderColor: 'var(--border)' }}>
                    <div className="flex items-center justify-between mb-2">
                      <label
                        htmlFor="ls-settings-name"
                        className="block text-xs font-medium"
                        style={{ color: 'var(--text-muted)' }}
                      >
                        Name
                      </label>
                      {nameSaved && (
                        <span className="inline-flex items-center gap-1 text-xs text-[var(--success)] font-medium">
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
                      className="w-full h-11 sm:h-10 px-3.5 text-base sm:text-sm border transition-colors focus:outline-none focus:border-[var(--accent)]"
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

                  {/* Email */}
                  <div
                    className="p-4 sm:p-5 flex items-center justify-between gap-3"
                    style={{ borderColor: 'var(--border)' }}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                        Email
                      </div>
                      <div
                        className="text-sm font-medium mt-0.5 truncate break-all sm:break-normal"
                        style={{ color: 'var(--text)' }}
                        title={session?.user.email || ''}
                      >
                        {session?.user.email || 'you@example.com'}
                      </div>
                    </div>
                  </div>

                  {/* Sign out */}
                  <div
                    className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4"
                    style={{ borderColor: 'var(--border)' }}
                  >
                    <div className="min-w-0">
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
                      className="w-full sm:w-auto min-h-[40px] sm:min-h-[34px] px-4 py-2 inline-flex items-center justify-center gap-2 text-xs font-medium border transition-colors cursor-pointer hover:bg-red-500/10 active:scale-[0.98]"
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
            {/* TAB 2: Cloud API (Vertical, Multi-Key max 5, Minimal)   */}
            {/* ======================================================== */}
            {currentTab === 'cloud' && (
              <motion.div
                key="tab-cloud"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
                className="space-y-4"
              >
                <div
                  className="border overflow-hidden divide-y shadow-xs"
                  style={{
                    backgroundColor: 'var(--surface)',
                    borderColor: 'var(--border)',
                    borderRadius: 'var(--radius-md)',
                  }}
                >
                  {/* Linked API Keys Section (Vertical, Max 5) */}
                  <div className="p-4 sm:p-5">
                    <div className="flex items-center justify-between mb-3">
                      <div className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                        Linked API Keys ({cloudConfig.keys.length}/{MAX_API_KEYS})
                      </div>
                    </div>

                    {cloudConfig.keys.length === 0 ? (
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        No API keys linked yet. Add a key below to connect models.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {cloudConfig.keys.map((k) => (
                          <div
                            key={k.id}
                            className="p-3 rounded-lg border flex items-center justify-between gap-3 text-xs"
                            style={{
                              backgroundColor: 'var(--bg)',
                              borderColor: 'var(--border)',
                            }}
                          >
                            <div className="min-w-0 flex-1">
                              <div className="font-semibold text-sm" style={{ color: 'var(--text)' }}>
                                {k.label}
                              </div>
                              <div className="font-mono text-[11px] text-[var(--text-muted)] truncate">
                                {k.apiKey.length > 8
                                  ? `${k.apiKey.slice(0, 6)}...${k.apiKey.slice(-4)}`
                                  : '••••••••'}
                              </div>
                              <div className="text-[11px] font-medium text-[var(--accent)] mt-0.5">
                                {k.models?.length || 0} models available
                              </div>
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => refreshCloudApiKeyModels(k.id)}
                                className="p-2 rounded hover:bg-[var(--surface-2)] text-[var(--text-muted)] hover:text-[var(--text)] transition-colors cursor-pointer"
                                title="Refresh models for this key"
                              >
                                <RefreshCw className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => unlinkCloudApiKey(k.id)}
                                className="p-2 rounded hover:bg-red-500/10 text-[var(--danger)] transition-colors cursor-pointer"
                                title="Unlink this API key"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Vertical Add / Link API Key Form (if < 5 keys) */}
                  {canAddMoreKeys ? (
                    <div className="p-4 sm:p-5">
                      <div className="text-xs font-medium mb-3" style={{ color: 'var(--text-muted)' }}>
                        Link API Key
                      </div>

                      <form onSubmit={handleLinkKey} className="space-y-3">
                        {/* Provider Selector (Vertical Clean Select) */}
                        <div>
                          <label className="block text-[11px] font-medium mb-1" style={{ color: 'var(--text-muted)' }}>
                            API Provider
                          </label>
                          <select
                            value={selectedProvider}
                            onChange={(e) => handleSelectProvider(e.target.value as CloudProviderId)}
                            className="w-full h-11 sm:h-10 px-3 text-xs sm:text-sm border rounded transition-colors"
                            style={{
                              backgroundColor: 'var(--bg)',
                              borderColor: 'var(--border)',
                              color: 'var(--text)',
                            }}
                          >
                            {(Object.keys(CLOUD_PROVIDERS) as CloudProviderId[]).map((pid) => (
                              <option key={pid} value={pid}>
                                {CLOUD_PROVIDERS[pid].name}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* API Key Field */}
                        <div>
                          <label className="block text-[11px] font-medium mb-1" style={{ color: 'var(--text-muted)' }}>
                            API Key
                          </label>
                          <div className="relative flex items-center">
                            <input
                              type={showKey ? 'text' : 'password'}
                              value={newKeyInput}
                              onChange={(e) => setNewKeyInput(e.target.value)}
                              placeholder={CLOUD_PROVIDERS[selectedProvider].placeholderKey}
                              required={selectedProvider !== 'custom'}
                              autoComplete="off"
                              spellCheck="false"
                              className="w-full h-11 sm:h-10 pl-3 pr-10 text-base sm:text-sm font-mono border rounded transition-colors focus:outline-none focus:border-[var(--accent)]"
                              style={{
                                backgroundColor: 'var(--bg)',
                                borderColor: 'var(--border)',
                                color: 'var(--text)',
                              }}
                            />
                            <button
                              type="button"
                              onClick={() => setShowKey((v) => !v)}
                              className="absolute right-2 p-1.5 text-[var(--text-muted)] hover:text-[var(--text)] transition-colors cursor-pointer"
                              title={showKey ? 'Hide key' : 'Show key'}
                            >
                              {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>
                        </div>

                        {/* Base URL (Vertical, Minimal) */}
                        <div>
                          <label className="block text-[11px] font-medium mb-1" style={{ color: 'var(--text-muted)' }}>
                            API Base URL
                          </label>
                          <input
                            type="text"
                            value={newBaseUrlInput}
                            onChange={(e) => setNewBaseUrlInput(e.target.value)}
                            placeholder={CLOUD_PROVIDERS[selectedProvider].defaultBaseUrl}
                            className="w-full h-11 sm:h-10 px-3 text-xs sm:text-sm font-mono border rounded transition-colors focus:outline-none focus:border-[var(--accent)]"
                            style={{
                              backgroundColor: 'var(--bg)',
                              borderColor: 'var(--border)',
                              color: 'var(--text)',
                            }}
                          />
                        </div>

                        {linkError && (
                          <div className="p-2.5 rounded text-xs border border-red-500/20 text-[var(--danger)] bg-red-500/5">
                            {linkError}
                          </div>
                        )}

                        <button
                          type="submit"
                          disabled={isAddingKey || (!newKeyInput.trim() && selectedProvider !== 'custom')}
                          className="w-full h-11 sm:h-10 px-4 inline-flex items-center justify-center gap-2 text-xs font-medium rounded border transition-transform active:scale-98 cursor-pointer disabled:opacity-40"
                          style={{
                            backgroundColor: 'var(--accent)',
                            borderColor: 'var(--accent)',
                            color: 'var(--accent-contrast)',
                          }}
                        >
                          {isAddingKey ? (
                            <>
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                              <span>Linking & Fetching Models…</span>
                            </>
                          ) : (
                            <span>Link API Key</span>
                          )}
                        </button>
                      </form>
                    </div>
                  ) : (
                    <div className="p-4 sm:p-5 text-center text-xs" style={{ color: 'var(--text-muted)' }}>
                      Maximum of 5 API keys reached. Unlink a key above to add a new one.
                    </div>
                  )}

                  {/* Available Models (from Linked API Keys) */}
                  {cloudConfig.keys.length > 0 && (
                    <div className="p-4 sm:p-5">
                      <div className="text-xs font-medium mb-3" style={{ color: 'var(--text-muted)' }}>
                        Available Models ({models.length})
                      </div>

                      <div className="space-y-1.5 max-h-[260px] overflow-y-auto pr-0.5">
                        {models.map((m) => {
                          const isSelected = m.id === selectedModelId;
                          return (
                            <div
                              key={m.id}
                              onClick={() => setSelectedModelId(m.id)}
                              className={`p-2.5 flex items-center justify-between rounded-lg border text-xs transition-all cursor-pointer ${
                                isSelected
                                  ? 'border-[var(--accent)] bg-[var(--surface-2)] font-semibold'
                                  : 'border-[var(--border)] bg-[var(--bg)] hover:bg-[var(--surface-2)]'
                              }`}
                            >
                              <div className="min-w-0 flex-1 pr-2">
                                <div className="truncate font-medium" style={{ color: 'var(--text)' }}>
                                  {m.name}
                                </div>
                                <div className="text-[10px] font-mono text-[var(--text-muted)] truncate">
                                  {m.id}
                                </div>
                              </div>
                              {isSelected && <Check className="w-4 h-4 text-[var(--accent)] shrink-0" />}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {/* ======================================================== */}
            {/* TAB 3: Voices                                            */}
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
                  className="border overflow-hidden divide-y shadow-xs"
                  style={{
                    backgroundColor: 'var(--surface)',
                    borderColor: 'var(--border)',
                    borderRadius: 'var(--radius-md)',
                  }}
                >
                  {/* Available Voices */}
                  <div className="p-4 sm:p-5" style={{ borderColor: 'var(--border)' }}>
                    <div className="text-xs font-medium mb-3" style={{ color: 'var(--text-muted)' }}>
                      Available Voices
                    </div>

                    <div className="flex flex-col gap-2 sm:gap-1.5">
                      {POCKET_VOICES.map((item) => {
                        const isSelected = item.id === voice;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => handleVoiceChange(item.id)}
                            className="w-full min-h-[46px] sm:min-h-[42px] px-3.5 sm:px-4 py-2.5 flex items-center justify-between text-left text-sm border transition-all cursor-pointer active:scale-[0.99]"
                            style={{
                              backgroundColor: isSelected ? 'var(--surface-2)' : 'var(--bg)',
                              borderColor: isSelected ? 'var(--accent)' : 'var(--border)',
                              color: 'var(--text)',
                              borderRadius: 'var(--radius-sm)',
                            }}
                          >
                            <span className="font-medium truncate">{item.label}</span>
                            {isSelected && (
                              <Check
                                className="w-4 h-4 shrink-0 ml-2"
                                style={{ color: 'var(--accent)' }}
                              />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Speaking Speed */}
                  <div className="p-4 sm:p-5" style={{ borderColor: 'var(--border)' }}>
                    <div className="flex items-center justify-between mb-3">
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
                            className="p-1.5 -mr-1 text-xs text-[var(--text-muted)] hover:text-[var(--text)] transition-colors cursor-pointer"
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
                      className="w-full h-2 cursor-pointer accent-[#D9822B] touch-none"
                      aria-label="Speaking Speed"
                    />

                    <div className="flex justify-between text-[11px] font-mono mt-2 select-none" style={{ color: 'var(--text-muted)' }}>
                      <span>0.75x</span>
                      <span>1.0x (Normal)</span>
                      <span>1.5x</span>
                    </div>
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
