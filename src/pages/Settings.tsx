import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeft,
  Brain,
  Check,
  Cloud,
  Eye,
  EyeOff,
  LogOut,
  Plus,
  RefreshCw,
  RotateCcw,
  Server,
  Trash2,
  User,
  Volume2,
  Wifi,
  WifiOff,
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
import { MAX_MEMORIES } from '../lib/memory';

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
    allModels,
    selectedModelId,
    setSelectedModelId,
    settingsSection,
    openSettingsSection,
    setIsSettingsOpen,
    signOut,
    laptopStatus,
    customGatewayUrl,
    detectedFunnelUrl,
    activeGatewayEndpoint,
    updateGatewayUrl,
    testGatewayConnection,
    refreshGateway,
    memories,
    isMemoryEnabled,
    setIsMemoryEnabled,
    addMemory,
    removeMemory,
    clearMemories,
  } = useAppState();

  const [nameInput, setNameInput] = useState(userDisplayName);
  const [nameSaved, setNameSaved] = useState(false);
  const [voice, setVoice] = useState<PocketVoiceId>(() => getSavedVoice());
  const [speed, setSpeed] = useState<number>(() => getSavedSpeed());

  // Memory Form State
  const [newMemoryText, setNewMemoryText] = useState('');
  const [memoryAddedToast, setMemoryAddedToast] = useState(false);

  // Gateway Connection Form State
  const [gatewayInput, setGatewayInput] = useState(customGatewayUrl || '');
  const [isTestingGateway, setIsTestingGateway] = useState(false);
  const [isSavingGateway, setIsSavingGateway] = useState(false);
  const [gatewayTestResult, setGatewayTestResult] = useState<{
    ok: boolean;
    latencyMs?: number;
    message: string;
  } | null>(null);
  const [gatewaySavedBanner, setGatewaySavedBanner] = useState(false);

  useEffect(() => {
    setGatewayInput(customGatewayUrl || '');
  }, [customGatewayUrl]);

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

  const handleTestGateway = async () => {
    const target = gatewayInput.trim() || activeGatewayEndpoint || detectedFunnelUrl || 'http://127.0.0.1:8790';
    setIsTestingGateway(true);
    setGatewayTestResult(null);
    try {
      const res = await testGatewayConnection(target);
      if (res.ok) {
        setGatewayTestResult({
          ok: true,
          latencyMs: res.latencyMs,
          message: `Connected successfully (${res.latencyMs}ms)`,
        });
      } else {
        setGatewayTestResult({
          ok: false,
          message: res.error || 'Connection failed',
        });
      }
    } catch (err) {
      setGatewayTestResult({
        ok: false,
        message: err instanceof Error ? err.message : 'Connection failed',
      });
    } finally {
      setIsTestingGateway(false);
    }
  };

  const handleSaveGateway = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsSavingGateway(true);
    setGatewayTestResult(null);
    try {
      const ok = await updateGatewayUrl(gatewayInput.trim());
      setGatewaySavedBanner(true);
      setTimeout(() => setGatewaySavedBanner(false), 2400);
      if (ok) {
        setGatewayTestResult({
          ok: true,
          message: 'Saved & connected to Little Sun gateway',
        });
      } else {
        setGatewayTestResult({
          ok: false,
          message: 'Saved, but endpoint is unreachable. Verify that your laptop gateway is running.',
        });
      }
    } catch (err) {
      setGatewayTestResult({
        ok: false,
        message: err instanceof Error ? err.message : 'Failed to save gateway URL',
      });
    } finally {
      setIsSavingGateway(false);
    }
  };

  const handleUseDetectedFunnel = () => {
    if (detectedFunnelUrl) {
      setGatewayInput(detectedFunnelUrl);
    }
  };

  const handleResetGateway = async () => {
    setGatewayInput('');
    await updateGatewayUrl('');
    setGatewayTestResult({
      ok: true,
      message: 'Reset to auto-detection',
    });
  };

  const handleManualAddMemory = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newMemoryText.trim();
    if (!clean) return;
    const res = await addMemory(clean);
    if (res) {
      setNewMemoryText('');
      setMemoryAddedToast(true);
      setTimeout(() => setMemoryAddedToast(false), 2200);
    }
  };

  const handleClearAllMemories = async () => {
    if (window.confirm('Are you sure you want to clear all stored memories?')) {
      await clearMemories();
    }
  };

  const currentTab =
    settingsSection === 'voices'
      ? 'voices'
      : settingsSection === 'cloud'
      ? 'cloud'
      : settingsSection === 'gateway'
      ? 'gateway'
      : settingsSection === 'memory'
      ? 'memory'
      : 'account';
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
          {/* Centered Segmented Navigation (Account | Memory | Gateway | Cloud API | Voices) */}
          <div className="flex justify-center mb-6 sm:mb-8">
            <nav
              aria-label="Settings navigation"
              className="w-full max-w-[500px] grid grid-cols-5 p-1 border select-none rounded-full"
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
                className={`min-h-[38px] px-1 sm:px-2 py-1.5 inline-flex items-center justify-center gap-1 sm:gap-1.5 text-xs sm:text-sm font-medium rounded-full transition-all cursor-pointer no-underline active:scale-[0.98] ${
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
                href="/memory"
                onClick={(e) => {
                  e.preventDefault();
                  openSettingsSection('memory');
                }}
                className={`min-h-[38px] px-1 sm:px-2 py-1.5 inline-flex items-center justify-center gap-1 sm:gap-1.5 text-xs sm:text-sm font-medium rounded-full transition-all cursor-pointer no-underline active:scale-[0.98] ${
                  currentTab === 'memory'
                    ? 'shadow-xs font-semibold'
                    : 'hover:text-[var(--text)]'
                }`}
                style={{
                  backgroundColor: currentTab === 'memory' ? 'var(--surface)' : 'transparent',
                  color: currentTab === 'memory' ? 'var(--text)' : 'var(--text-muted)',
                }}
              >
                <Brain
                  className="w-3.5 h-3.5 shrink-0"
                  style={{ color: currentTab === 'memory' ? 'var(--accent)' : 'inherit' }}
                />
                <span>Memory</span>
              </a>

              <a
                href="/gateway"
                onClick={(e) => {
                  e.preventDefault();
                  openSettingsSection('gateway');
                }}
                className={`min-h-[38px] px-1 sm:px-2 py-1.5 inline-flex items-center justify-center gap-1 sm:gap-1.5 text-xs sm:text-sm font-medium rounded-full transition-all cursor-pointer no-underline active:scale-[0.98] ${
                  currentTab === 'gateway'
                    ? 'shadow-xs font-semibold'
                    : 'hover:text-[var(--text)]'
                }`}
                style={{
                  backgroundColor: currentTab === 'gateway' ? 'var(--surface)' : 'transparent',
                  color: currentTab === 'gateway' ? 'var(--text)' : 'var(--text-muted)',
                }}
              >
                <Server
                  className="w-3.5 h-3.5 shrink-0"
                  style={{ color: currentTab === 'gateway' ? 'var(--accent)' : 'inherit' }}
                />
                <span>Gateway</span>
              </a>

              <a
                href="/cloud"
                onClick={(e) => {
                  e.preventDefault();
                  openSettingsSection('cloud');
                }}
                className={`min-h-[38px] px-1 sm:px-2 py-1.5 inline-flex items-center justify-center gap-1 sm:gap-1.5 text-xs sm:text-sm font-medium rounded-full transition-all cursor-pointer no-underline active:scale-[0.98] ${
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
                <span>Cloud</span>
              </a>

              <a
                href="/voices"
                onClick={(e) => {
                  e.preventDefault();
                  openSettingsSection('voices');
                }}
                className={`min-h-[38px] px-1 sm:px-2 py-1.5 inline-flex items-center justify-center gap-1 sm:gap-1.5 text-xs sm:text-sm font-medium rounded-full transition-all cursor-pointer no-underline active:scale-[0.98] ${
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
            {/* TAB 2: Memory (Structural Facts, Preferences & Habits)  */}
            {/* ======================================================== */}
            {currentTab === 'memory' && (
              <motion.div
                key="tab-memory"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
                className="space-y-4"
              >
                {/* Card 1: Memory Master Toggle & Capacity Meter */}
                <div
                  className="border overflow-hidden divide-y shadow-xs"
                  style={{
                    backgroundColor: 'var(--surface)',
                    borderColor: 'var(--border)',
                    borderRadius: 'var(--radius-md)',
                  }}
                >
                  <div
                    className="p-4 sm:p-5 flex items-center justify-between gap-3"
                    style={{ borderColor: 'var(--border)' }}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
                        style={{ backgroundColor: 'var(--surface-2)', color: 'var(--accent)' }}
                      >
                        <Brain className="w-4.5 h-4.5" />
                      </div>
                      <div>
                        <h2 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
                          The Memory
                        </h2>
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                          Stores personal context, preferences, and facts across all models
                        </p>
                      </div>
                    </div>

                    {/* Master Toggle */}
                    <button
                      type="button"
                      role="switch"
                      aria-checked={isMemoryEnabled}
                      onClick={() => setIsMemoryEnabled(!isMemoryEnabled)}
                      className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors cursor-pointer shrink-0 ${
                        isMemoryEnabled ? 'bg-[var(--accent)]' : 'bg-[var(--surface-2)] border border-[var(--border)]'
                      }`}
                      title={isMemoryEnabled ? 'Disable memory' : 'Enable memory'}
                    >
                      <div
                        className={`w-4 h-4 rounded-full bg-white transition-transform ${
                          isMemoryEnabled ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  {/* Storage Capacity Bar & Info */}
                  <div className="p-4 sm:p-5" style={{ borderColor: 'var(--border)' }}>
                    <div className="flex items-center justify-between text-xs mb-2">
                      <span style={{ color: 'var(--text-muted)' }}>Memory capacity</span>
                      <span className="font-mono font-medium" style={{ color: 'var(--text)' }}>
                        {memories.length} / {MAX_MEMORIES} slots
                      </span>
                    </div>
                    <div
                      className="w-full h-2 rounded-full overflow-hidden"
                      style={{ backgroundColor: 'var(--surface-2)' }}
                    >
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{
                          width: `${Math.min(100, (memories.length / MAX_MEMORIES) * 100)}%`,
                          backgroundColor:
                            memories.length >= MAX_MEMORIES
                              ? 'var(--danger)'
                              : memories.length >= MAX_MEMORIES * 0.8
                              ? '#f59e0b'
                              : 'var(--accent)',
                        }}
                      />
                    </div>
                    <p className="text-xs mt-2.5" style={{ color: 'var(--text-muted)' }}>
                      Local (GGUF) and Cloud models access these facts automatically to personalize answers.
                    </p>
                  </div>

                  {/* Manual Add Memory Row */}
                  <div className="p-4 sm:p-5" style={{ borderColor: 'var(--border)' }}>
                    <label
                      htmlFor="ls-new-memory-input"
                      className="block text-xs font-medium mb-1.5"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      Add Memory Manually
                    </label>
                    <form onSubmit={handleManualAddMemory} className="flex gap-2">
                      <input
                        id="ls-new-memory-input"
                        type="text"
                        value={newMemoryText}
                        onChange={(e) => setNewMemoryText(e.target.value)}
                        placeholder="e.g. Prefers TypeScript, building Little Sun project"
                        maxLength={280}
                        disabled={!isMemoryEnabled || memories.length >= MAX_MEMORIES}
                        className="flex-1 h-10 px-3.5 text-xs sm:text-sm border transition-colors focus:outline-none focus:border-[var(--accent)] disabled:opacity-50"
                        style={{
                          backgroundColor: 'var(--bg)',
                          borderColor: 'var(--border)',
                          borderRadius: 'var(--radius-sm)',
                          color: 'var(--text)',
                        }}
                      />
                      <button
                        type="submit"
                        disabled={!newMemoryText.trim() || !isMemoryEnabled || memories.length >= MAX_MEMORIES}
                        className="min-h-[40px] px-3.5 py-1.5 text-xs font-semibold rounded transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-1.5 shrink-0 active:scale-[0.98] shadow-xs"
                        style={{
                          backgroundColor: 'var(--accent)',
                          color: 'var(--accent-contrast)',
                        }}
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add</span>
                      </button>
                    </form>

                    {memoryAddedToast && (
                      <div className="mt-2 text-xs font-medium text-emerald-600 dark:text-emerald-400 inline-flex items-center gap-1">
                        <Check className="w-3.5 h-3.5" />
                        <span>Memory saved</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Card 2: Memory Items List */}
                <div
                  className="border overflow-hidden divide-y shadow-xs"
                  style={{
                    backgroundColor: 'var(--surface)',
                    borderColor: 'var(--border)',
                    borderRadius: 'var(--radius-md)',
                  }}
                >
                  <div
                    className="p-4 sm:p-5 flex items-center justify-between gap-3"
                    style={{ borderColor: 'var(--border)' }}
                  >
                    <div>
                      <h3 className="text-xs font-semibold" style={{ color: 'var(--text)' }}>
                        Stored Facts & Preferences ({memories.length})
                      </h3>
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        Say &quot;Remember that...&quot; in any chat, or delete entries below
                      </p>
                    </div>

                    {memories.length > 0 && (
                      <button
                        type="button"
                        onClick={handleClearAllMemories}
                        className="text-xs text-[var(--danger)] hover:underline cursor-pointer transition-colors"
                      >
                        Clear all
                      </button>
                    )}
                  </div>

                  <div className="p-4 sm:p-5 space-y-2.5" style={{ borderColor: 'var(--border)' }}>
                    {memories.length === 0 ? (
                      <div className="py-6 text-center">
                        <Brain className="w-7 h-7 mx-auto mb-2 opacity-30" style={{ color: 'var(--text-muted)' }} />
                        <p className="text-xs font-medium" style={{ color: 'var(--text)' }}>
                          No memories stored yet
                        </p>
                        <p className="text-xs mt-1 max-w-[320px] mx-auto" style={{ color: 'var(--text-muted)' }}>
                          Tell Little Sun &quot;Remember that I live in Tokyo&quot; in any chat, or add a preference above.
                        </p>
                      </div>
                    ) : (
                      memories.map((m) => (
                        <div
                          key={m.id}
                          className="p-3 rounded-lg border flex items-start justify-between gap-3 transition-colors group"
                          style={{
                            backgroundColor: 'var(--surface-2)',
                            borderColor: 'var(--border)',
                          }}
                        >
                          <div className="min-w-0 flex-1">
                            <p
                              className="text-xs sm:text-sm font-medium leading-relaxed"
                              style={{ color: 'var(--text)' }}
                            >
                              {m.content}
                            </p>
                            <div className="flex items-center gap-2 mt-1.5">
                              <span
                                className="text-[10px] px-1.5 py-0.5 rounded font-mono uppercase tracking-wider"
                                style={{
                                  backgroundColor: 'var(--surface)',
                                  color: 'var(--accent)',
                                }}
                              >
                                {m.category || 'general'}
                              </span>
                              <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                                {new Date(m.created_at).toLocaleDateString(undefined, {
                                  month: 'short',
                                  day: 'numeric',
                                })}
                              </span>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => removeMemory(m.id)}
                            className="p-1.5 rounded text-[var(--text-muted)] hover:text-[var(--danger)] hover:bg-[var(--surface)] transition-colors cursor-pointer shrink-0"
                            title="Delete memory"
                            aria-label="Delete memory"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {/* ======================================================== */}
            {/* TAB 2: Gateway (Local Inference & Tailscale Funnel)     */}
            {/* ======================================================== */}
            {currentTab === 'gateway' && (
              <motion.div
                key="tab-gateway"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
                className="space-y-4"
              >
                {/* Card 1: Connection Status & Endpoint Configuration */}
                <div
                  className="border overflow-hidden divide-y shadow-xs"
                  style={{
                    backgroundColor: 'var(--surface)',
                    borderColor: 'var(--border)',
                    borderRadius: 'var(--radius-md)',
                  }}
                >
                  {/* Header Row */}
                  <div
                    className="p-4 sm:p-5 flex items-center justify-between gap-3"
                    style={{ borderColor: 'var(--border)' }}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
                        style={{ backgroundColor: 'var(--surface-2)', color: 'var(--accent)' }}
                      >
                        <Server className="w-4.5 h-4.5" />
                      </div>
                      <div>
                        <h2 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
                          Inference Gateway
                        </h2>
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                          Self-hosted LLMs & TTS over LAN or Tailscale Funnel
                        </p>
                      </div>
                    </div>

                    {/* Live Status Badge */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span
                        className={`w-2 h-2 rounded-full ${
                          laptopStatus === 'ready' || laptopStatus === 'busy'
                            ? 'bg-emerald-500 ring-2 ring-emerald-500/20'
                            : laptopStatus === 'sleeping'
                            ? 'bg-amber-500 ring-2 ring-amber-500/20'
                            : laptopStatus === 'waking'
                            ? 'bg-blue-500 animate-pulse'
                            : 'bg-neutral-400'
                        }`}
                      />
                      <span className="text-xs font-medium capitalize" style={{ color: 'var(--text)' }}>
                        {laptopStatus === 'ready' || laptopStatus === 'busy'
                          ? 'Online'
                          : laptopStatus === 'sleeping'
                          ? 'Standby'
                          : laptopStatus === 'waking'
                          ? 'Waking'
                          : 'Offline'}
                      </span>
                    </div>
                  </div>

                  {/* Active Endpoint Info */}
                  <div className="p-4 sm:p-5" style={{ borderColor: 'var(--border)' }}>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                      <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                        Active Connection Endpoint
                      </span>
                      <span
                        className="text-xs font-mono px-2 py-0.5 rounded border max-w-full truncate"
                        style={{
                          backgroundColor: 'var(--surface-2)',
                          borderColor: 'var(--border)',
                          color: activeGatewayEndpoint ? 'var(--text)' : 'var(--text-muted)',
                        }}
                      >
                        {activeGatewayEndpoint || 'None (probing candidates)'}
                      </span>
                    </div>

                    {/* Detected Tailscale Funnel URL from Local Laptop */}
                    {detectedFunnelUrl && (
                      <div
                        className="mb-4 p-3 rounded-lg border flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
                        style={{
                          backgroundColor: 'var(--surface-2)',
                          borderColor: 'var(--border)',
                        }}
                      >
                        <div className="min-w-0 flex-1">
                          <span className="text-[11px] font-semibold text-[var(--accent)] uppercase tracking-wider block mb-0.5">
                            Laptop Tailscale Funnel Detected
                          </span>
                          <p className="text-xs font-mono truncate" style={{ color: 'var(--text)' }}>
                            {detectedFunnelUrl}
                          </p>
                        </div>
                        {gatewayInput.trim() !== detectedFunnelUrl && (
                          <button
                            type="button"
                            onClick={handleUseDetectedFunnel}
                            className="px-2.5 py-1 text-xs font-medium rounded border transition-colors cursor-pointer shrink-0 hover:bg-[var(--surface)] active:scale-[0.98]"
                            style={{
                              borderColor: 'var(--border)',
                              color: 'var(--text)',
                            }}
                          >
                            Use Funnel URL
                          </button>
                        )}
                      </div>
                    )}

                    {/* Input Form */}
                    <form onSubmit={handleSaveGateway} className="space-y-3">
                      <div>
                        <label
                          htmlFor="ls-gateway-url-input"
                          className="block text-xs font-medium mb-1.5"
                          style={{ color: 'var(--text-muted)' }}
                        >
                          Gateway URL (Public Funnel or Local Host)
                        </label>
                        <input
                          id="ls-gateway-url-input"
                          type="text"
                          value={gatewayInput}
                          onChange={(e) => setGatewayInput(e.target.value)}
                          placeholder="https://narayan.tail360362.ts.net or http://127.0.0.1:8790"
                          className="w-full h-11 sm:h-10 px-3.5 text-base sm:text-sm font-mono border transition-colors focus:outline-none focus:border-[var(--accent)]"
                          style={{
                            backgroundColor: 'var(--bg)',
                            borderColor: 'var(--border)',
                            borderRadius: 'var(--radius-sm)',
                            color: 'var(--text)',
                          }}
                        />
                        <p className="text-xs mt-1.5" style={{ color: 'var(--text-muted)' }}>
                          Saved to your Supabase profile and synced to your mobile phone automatically.
                        </p>
                      </div>

                      {/* Test / Save Banner Feedback */}
                      {gatewayTestResult && (
                        <div
                          className={`p-3 rounded-lg text-xs font-medium flex items-center gap-2 border ${
                            gatewayTestResult.ok
                              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400'
                              : 'bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-400'
                          }`}
                        >
                          {gatewayTestResult.ok ? (
                            <Check className="w-4 h-4 shrink-0" />
                          ) : (
                            <WifiOff className="w-4 h-4 shrink-0" />
                          )}
                          <span className="flex-1">{gatewayTestResult.message}</span>
                        </div>
                      )}

                      {gatewaySavedBanner && !gatewayTestResult && (
                        <div className="p-3 rounded-lg text-xs font-medium flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400">
                          <Check className="w-4 h-4 shrink-0" />
                          <span>Gateway preferences updated</span>
                        </div>
                      )}

                      {/* Action Buttons */}
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <button
                          type="submit"
                          disabled={isSavingGateway}
                          className="min-h-[38px] px-4 py-1.5 text-xs font-semibold rounded transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] inline-flex items-center gap-1.5 shadow-xs"
                          style={{
                            backgroundColor: 'var(--accent)',
                            color: 'var(--accent-contrast)',
                          }}
                        >
                          {isSavingGateway ? (
                            <>
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                              <span>Connecting...</span>
                            </>
                          ) : (
                            <>
                              <Check className="w-3.5 h-3.5" />
                              <span>Save & Connect</span>
                            </>
                          )}
                        </button>

                        <button
                          type="button"
                          disabled={isTestingGateway}
                          onClick={handleTestGateway}
                          className="min-h-[38px] px-3.5 py-1.5 text-xs font-medium rounded border transition-colors cursor-pointer hover:bg-[var(--surface-2)] active:scale-[0.98] inline-flex items-center gap-1.5 disabled:opacity-50"
                          style={{
                            borderColor: 'var(--border)',
                            color: 'var(--text)',
                          }}
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${isTestingGateway ? 'animate-spin' : ''}`} />
                          <span>{isTestingGateway ? 'Testing...' : 'Test Connection'}</span>
                        </button>

                        {(gatewayInput || customGatewayUrl) && (
                          <button
                            type="button"
                            onClick={handleResetGateway}
                            className="min-h-[38px] px-3 py-1.5 text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text)] transition-colors cursor-pointer inline-flex items-center gap-1 ml-auto"
                            title="Reset to default local & env candidates"
                          >
                            <RotateCcw className="w-3 h-3" />
                            <span>Reset</span>
                          </button>
                        )}
                      </div>
                    </form>
                  </div>
                </div>

                {/* Card 2: Connected Local Models */}
                <div
                  className="border overflow-hidden divide-y shadow-xs"
                  style={{
                    backgroundColor: 'var(--surface)',
                    borderColor: 'var(--border)',
                    borderRadius: 'var(--radius-md)',
                  }}
                >
                  <div
                    className="p-4 sm:p-5 flex items-center justify-between gap-3"
                    style={{ borderColor: 'var(--border)' }}
                  >
                    <div>
                      <h3 className="text-xs font-semibold" style={{ color: 'var(--text)' }}>
                        Detected Local Models ({allModels.filter((m) => m.available).length})
                      </h3>
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        GGUF files hosted in your laptop&apos;s models directory
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => refreshGateway()}
                      className="p-1.5 rounded hover:bg-[var(--surface-2)] transition-colors cursor-pointer text-[var(--text-muted)] hover:text-[var(--text)]"
                      title="Refresh models list"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="p-4 sm:p-5 space-y-2" style={{ borderColor: 'var(--border)' }}>
                    {allModels.filter((m) => m.available).length === 0 ? (
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        {laptopStatus === 'offline'
                          ? 'Connect to your gateway to view installed models.'
                          : 'No .gguf files currently loaded. Add GGUF models into your gateway models/ folder.'}
                      </p>
                    ) : (
                      allModels
                        .filter((m) => m.available)
                        .map((m) => (
                          <div
                            key={m.id}
                            className="p-3 rounded-lg border flex items-center justify-between gap-3 text-xs"
                            style={{
                              backgroundColor: 'var(--surface-2)',
                              borderColor: 'var(--border)',
                            }}
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5">
                                <span className="font-semibold truncate" style={{ color: 'var(--text)' }}>
                                  {m.name}
                                </span>
                                {m.isDefault && (
                                  <span className="text-[10px] px-1.5 py-0.2 rounded font-medium bg-[var(--accent)] text-[var(--accent-contrast)]">
                                    Default
                                  </span>
                                )}
                              </div>
                              <span className="text-[11px] font-mono text-[var(--text-muted)]">
                                {m.id} · {Math.round((m.contextSize || 16384) / 1024)}k context
                              </span>
                            </div>
                            <span className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                              Ready
                            </span>
                          </div>
                        ))
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {/* ======================================================== */}
            {/* TAB 3: Cloud API (Vertical, Multi-Key max 5, Minimal)   */}
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
