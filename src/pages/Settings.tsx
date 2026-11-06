import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeft,
  Brain,
  Check,
  ChevronRight,
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
import { sanitizeCandidateUrl } from '../lib/gateway';
import { MAX_MEMORIES } from '../lib/memory';
import { DeleteConfirmDialog } from '../components/DeleteConfirmDialog';

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
    const target =
      sanitizeCandidateUrl(gatewayInput) ||
      activeGatewayEndpoint ||
      detectedFunnelUrl ||
      'http://127.0.0.1:8790';
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
    const clean = sanitizeCandidateUrl(gatewayInput);
    setGatewayInput(clean);
    setIsSavingGateway(true);
    setGatewayTestResult(null);
    try {
      const ok = await updateGatewayUrl(clean);
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
      setGatewayInput(sanitizeCandidateUrl(detectedFunnelUrl));
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

  // Custom Delete Confirm Dialog states (replacing browser default confirm)
  const [isClearAllMemoriesOpen, setIsClearAllMemoriesOpen] = useState(false);
  const [memoryToDelete, setMemoryToDelete] = useState<{ id: string; content: string } | null>(null);
  const [keyToUnlink, setKeyToUnlink] = useState<{ id: string; label: string } | null>(null);
  const [isDeletingAction, setIsDeletingAction] = useState(false);

  const handleConfirmClearAllMemories = async () => {
    setIsDeletingAction(true);
    try {
      await clearMemories();
      setIsClearAllMemoriesOpen(false);
    } finally {
      setIsDeletingAction(false);
    }
  };

  const handleConfirmDeleteMemory = async () => {
    if (!memoryToDelete) return;
    setIsDeletingAction(true);
    try {
      await removeMemory(memoryToDelete.id);
      setMemoryToDelete(null);
    } finally {
      setIsDeletingAction(false);
    }
  };

  const handleConfirmUnlinkKey = async () => {
    if (!keyToUnlink) return;
    setIsDeletingAction(true);
    try {
      await unlinkCloudApiKey(keyToUnlink.id);
      setKeyToUnlink(null);
    } finally {
      setIsDeletingAction(false);
    }
  };

  const currentTab = settingsSection || 'index';
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
      {currentTab === 'index' ? (
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

          <h1
            className="text-sm sm:text-base font-semibold truncate"
            style={{ color: 'var(--text)' }}
          >
            Settings
          </h1>

          <div className="flex items-center gap-2 shrink-0">
            <StatusPill />
          </div>
        </header>
      ) : (
        <header
          className="px-3.5 sm:px-6 border-b flex items-center justify-between gap-3 shrink-0"
          style={{
            backgroundColor: 'var(--bg)',
            borderColor: 'var(--border)',
            minHeight: '3.5rem',
            paddingTop: 'env(safe-area-inset-top, 0px)',
          }}
        >
          {/* Breadcrumb Navigation: Settings > Section */}
          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
            <button
              type="button"
              onClick={() => openSettingsSection('index')}
              className="min-h-[38px] px-2 py-1.5 inline-flex items-center gap-1 text-xs sm:text-sm font-medium transition-colors cursor-pointer hover:bg-[var(--surface-2)] rounded-md active:scale-[0.98]"
              style={{ color: 'var(--text-muted)' }}
              title="Return to Settings overview"
            >
              <ArrowLeft className="w-4 h-4 shrink-0" />
              <span>Settings</span>
            </button>

            <span className="text-[var(--text-muted)] text-xs font-mono select-none">/</span>

            <span
              className="text-xs sm:text-sm font-semibold truncate capitalize"
              style={{ color: 'var(--text)' }}
            >
              {currentTab === 'cloud'
                ? 'Cloud API'
                : currentTab === 'gateway'
                ? 'Gateway'
                : currentTab === 'voices'
                ? 'Voices'
                : currentTab === 'memory'
                ? 'Memory'
                : 'Account'}
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setIsSettingsOpen(false)}
              className="min-h-[34px] px-2.5 py-1 text-xs font-medium border transition-colors cursor-pointer hover:bg-[var(--surface-2)] rounded-md"
              style={{
                borderColor: 'var(--border)',
                color: 'var(--text-muted)',
              }}
              title="Back to chat"
            >
              Chat
            </button>
            <StatusPill />
          </div>
        </header>
      )}

      {/* Main Content */}
      <main
        className="flex-1 overflow-y-auto px-4 sm:px-6 pt-5 sm:pt-7 pb-12 sm:pb-16"
        style={{
          WebkitOverflowScrolling: 'touch',
          overscrollBehaviorY: 'contain',
          paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 3rem)',
        }}
      >
        <div className="w-full max-w-[500px] mx-auto">
          <AnimatePresence mode="wait">
            {/* ======================================================== */}
            {/* DEDICATED SETTINGS MENU HUB / DIRECTORY                  */}
            {/* ======================================================== */}
            {currentTab === 'index' && (
              <motion.div
                key="settings-index"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.16 }}
                className="space-y-3"
              >
                <div
                  className="border overflow-hidden divide-y shadow-xs"
                  style={{
                    backgroundColor: 'var(--surface)',
                    borderColor: 'var(--border)',
                    borderRadius: 'var(--radius-md)',
                  }}
                >
                  {/* Dedicated Item 1: Voices */}
                  <button
                    type="button"
                    onClick={() => openSettingsSection('voices')}
                    className="w-full p-4 flex items-center justify-between gap-3 text-left transition-colors cursor-pointer hover:bg-[var(--surface-2)] active:scale-[0.99]"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-amber-500/10 text-amber-500 border border-amber-500/20">
                        <Volume2 className="w-4.5 h-4.5" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
                          Voices
                        </div>
                        <div className="text-xs text-[var(--text-muted)] truncate">
                          Text-to-speech voice, speaking speed & preview
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[11px] font-mono px-2 py-0.5 rounded-full border border-[var(--border)] text-[var(--text-muted)] bg-[var(--surface-2)] hidden sm:inline capitalize">
                        {voice} · {speed}x
                      </span>
                      <ChevronRight className="w-4 h-4 text-[var(--text-muted)]" />
                    </div>
                  </button>

                  {/* Dedicated Item 2: Gateway */}
                  <button
                    type="button"
                    onClick={() => openSettingsSection('gateway')}
                    className="w-full p-4 flex items-center justify-between gap-3 text-left transition-colors cursor-pointer hover:bg-[var(--surface-2)] active:scale-[0.99]"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-orange-500/10 text-orange-500 border border-orange-500/20">
                        <Server className="w-4.5 h-4.5" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
                          Gateway
                        </div>
                        <div className="text-xs text-[var(--text-muted)] truncate">
                          Local models, Tailscale Funnel & connection status
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[11px] font-medium px-2 py-0.5 rounded-full border border-[var(--border)] text-[var(--text-muted)] bg-[var(--surface-2)] hidden sm:inline capitalize">
                        {laptopStatus}
                      </span>
                      <ChevronRight className="w-4 h-4 text-[var(--text-muted)]" />
                    </div>
                  </button>

                  {/* Dedicated Item 3: Cloud API */}
                  <button
                    type="button"
                    onClick={() => openSettingsSection('cloud')}
                    className="w-full p-4 flex items-center justify-between gap-3 text-left transition-colors cursor-pointer hover:bg-[var(--surface-2)] active:scale-[0.99]"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-sky-500/10 text-sky-500 border border-sky-500/20">
                        <Cloud className="w-4.5 h-4.5" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
                          Cloud API
                        </div>
                        <div className="text-xs text-[var(--text-muted)] truncate">
                          BYOK provider keys (OpenRouter, Groq, Ollama, OpenAI)
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[11px] font-mono px-2 py-0.5 rounded-full border border-[var(--border)] text-[var(--text-muted)] bg-[var(--surface-2)] hidden sm:inline">
                        {cloudConfig.keys.length} key{cloudConfig.keys.length === 1 ? '' : 's'}
                      </span>
                      <ChevronRight className="w-4 h-4 text-[var(--text-muted)]" />
                    </div>
                  </button>

                  {/* Dedicated Item 4: Memory */}
                  <button
                    type="button"
                    onClick={() => openSettingsSection('memory')}
                    className="w-full p-4 flex items-center justify-between gap-3 text-left transition-colors cursor-pointer hover:bg-[var(--surface-2)] active:scale-[0.99]"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-violet-500/10 text-violet-500 border border-violet-500/20">
                        <Brain className="w-4.5 h-4.5" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
                          Memory
                        </div>
                        <div className="text-xs text-[var(--text-muted)] truncate">
                          Manage persistent facts and autonomous memory retention
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full border border-[var(--border)] text-[var(--text-muted)] bg-[var(--surface-2)] hidden sm:inline">
                        {isMemoryEnabled ? 'ON' : 'OFF'}
                      </span>
                      <ChevronRight className="w-4 h-4 text-[var(--text-muted)]" />
                    </div>
                  </button>

                  {/* Dedicated Item 5: Account */}
                  <button
                    type="button"
                    onClick={() => openSettingsSection('account')}
                    className="w-full p-4 flex items-center justify-between gap-3 text-left transition-colors cursor-pointer hover:bg-[var(--surface-2)] active:scale-[0.99]"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                        <User className="w-4.5 h-4.5" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
                          Account
                        </div>
                        <div className="text-xs text-[var(--text-muted)] truncate">
                          Profile name and authentication details
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[11px] font-medium px-2 py-0.5 rounded-full border border-[var(--border)] text-[var(--text-muted)] bg-[var(--surface-2)] hidden sm:inline">
                        {userDisplayName}
                      </span>
                      <ChevronRight className="w-4 h-4 text-[var(--text-muted)]" />
                    </div>
                  </button>
                </div>
              </motion.div>
            )}

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
                {/* Master Switch & Quick Add Card */}
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
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div
                        className="w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center shrink-0"
                        style={{ backgroundColor: 'var(--surface-2)', color: 'var(--accent)' }}
                      >
                        <Brain className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h2 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
                          Memory
                        </h2>
                        <p className="text-xs leading-normal" style={{ color: 'var(--text-muted)' }}>
                          Preferences and facts remembered across chats
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
                      title={isMemoryEnabled ? 'Pause memory' : 'Enable memory'}
                    >
                      <div
                        className={`w-4 h-4 rounded-full bg-white transition-transform ${
                          isMemoryEnabled ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  {!isMemoryEnabled ? (
                    <div className="p-4 sm:p-5 text-xs" style={{ color: 'var(--text-muted)', borderColor: 'var(--border)' }}>
                      Memory is paused. Little Sun will not save or apply personal facts to prompts.
                    </div>
                  ) : (
                    <>
                      {/* Slim Capacity Line */}
                      <div className="p-4 sm:p-5" style={{ borderColor: 'var(--border)' }}>
                        <div className="flex items-center justify-between text-xs mb-2">
                          <span style={{ color: 'var(--text-muted)' }}>Storage capacity</span>
                          <span className="font-mono text-xs font-medium" style={{ color: 'var(--text)' }}>
                            {memories.length} / {MAX_MEMORIES}
                          </span>
                        </div>
                        <div
                          className="w-full h-1.5 rounded-full overflow-hidden"
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
                      </div>

                      {/* Clean Single-Row Manual Add Form */}
                      <div className="p-4 sm:p-5" style={{ borderColor: 'var(--border)' }}>
                        <form onSubmit={handleManualAddMemory} className="flex items-center gap-2">
                          <input
                            id="ls-new-memory-input"
                            type="text"
                            value={newMemoryText}
                            onChange={(e) => setNewMemoryText(e.target.value)}
                            placeholder="Remember a preference or fact..."
                            maxLength={280}
                            disabled={memories.length >= MAX_MEMORIES}
                            className="flex-1 h-10 px-3.5 text-xs sm:text-sm border transition-colors focus:outline-none focus:border-[var(--accent)] disabled:opacity-50 min-w-0"
                            style={{
                              backgroundColor: 'var(--bg)',
                              borderColor: 'var(--border)',
                              borderRadius: 'var(--radius-sm)',
                              color: 'var(--text)',
                            }}
                          />
                          <button
                            type="submit"
                            disabled={!newMemoryText.trim() || memories.length >= MAX_MEMORIES}
                            className="h-10 px-3.5 text-xs font-semibold rounded transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-1.5 shrink-0 active:scale-[0.98]"
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
                    </>
                  )}
                </div>

                {/* Saved Memories Card */}
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
                    <h3 className="text-xs font-semibold" style={{ color: 'var(--text)' }}>
                      Saved Memories ({memories.length})
                    </h3>

                    {memories.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setIsClearAllMemoriesOpen(true)}
                        className="text-xs text-[var(--danger)] hover:underline cursor-pointer transition-colors"
                      >
                        Clear all
                      </button>
                    )}
                  </div>

                  <div className="p-3 sm:p-4 space-y-2" style={{ borderColor: 'var(--border)' }}>
                    {memories.length === 0 ? (
                      <div className="py-8 text-center">
                        <Brain className="w-6 h-6 mx-auto mb-2 opacity-30" style={{ color: 'var(--text-muted)' }} />
                        <p className="text-xs font-medium" style={{ color: 'var(--text)' }}>
                          No memories saved yet
                        </p>
                        <p className="text-xs mt-1 max-w-[280px] mx-auto" style={{ color: 'var(--text-muted)' }}>
                          Ask Little Sun to remember something in chat, or add one above.
                        </p>
                      </div>
                    ) : (
                      memories.map((m) => (
                        <div
                          key={m.id}
                          className="p-3 rounded-lg border flex items-start justify-between gap-3 transition-colors"
                          style={{
                            backgroundColor: 'var(--surface-2)',
                            borderColor: 'var(--border)',
                          }}
                        >
                          <div className="min-w-0 flex-1">
                            <p
                              className="text-xs sm:text-sm font-medium leading-relaxed break-words"
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
                            onClick={() => setMemoryToDelete({ id: m.id, content: m.content })}
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
            {/* TAB 3: Gateway (Local Inference & Tailscale Funnel)     */}
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
                {/* Connection Status & Endpoint Card */}
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
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div
                        className="w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center shrink-0"
                        style={{ backgroundColor: 'var(--surface-2)', color: 'var(--accent)' }}
                      >
                        <Server className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h2 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
                          Gateway
                        </h2>
                        <p className="text-xs leading-normal" style={{ color: 'var(--text-muted)' }}>
                          Local models and TTS via network or Tailscale
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

                  {/* Endpoint Info & Config */}
                  <div className="p-4 sm:p-5" style={{ borderColor: 'var(--border)' }}>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 sm:gap-2 mb-3 text-xs">
                      <span style={{ color: 'var(--text-muted)' }}>Active endpoint</span>
                      <span
                        className="font-mono px-2 py-1 rounded border break-all sm:break-normal text-[11px] sm:text-xs"
                        style={{
                          backgroundColor: 'var(--surface-2)',
                          borderColor: 'var(--border)',
                          color: activeGatewayEndpoint ? 'var(--text)' : 'var(--text-muted)',
                        }}
                      >
                        {activeGatewayEndpoint || 'None'}
                      </span>
                    </div>

                    {/* Detected Tailscale Funnel Banner */}
                    {detectedFunnelUrl && gatewayInput.trim() !== detectedFunnelUrl && (
                      <div
                        className="mb-3.5 p-2.5 sm:p-3 rounded-lg border flex items-center justify-between gap-2.5 text-xs"
                        style={{
                          backgroundColor: 'var(--surface-2)',
                          borderColor: 'var(--border)',
                        }}
                      >
                        <div className="min-w-0 flex-1">
                          <span className="text-[11px] font-medium text-[var(--accent)] block">
                            Funnel detected
                          </span>
                          <span className="font-mono text-xs break-all sm:break-normal block" style={{ color: 'var(--text)' }}>
                            {detectedFunnelUrl}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={handleUseDetectedFunnel}
                          className="px-2.5 py-1 text-xs font-medium rounded border transition-colors cursor-pointer shrink-0 hover:bg-[var(--surface)] active:scale-[0.98]"
                          style={{
                            borderColor: 'var(--border)',
                            color: 'var(--text)',
                          }}
                        >
                          Use this
                        </button>
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
                          Gateway URL
                        </label>
                        <input
                          id="ls-gateway-url-input"
                          type="text"
                          value={gatewayInput}
                          onChange={(e) => setGatewayInput(e.target.value)}
                          placeholder="https://your-node.ts.net or http://127.0.0.1:8790"
                          className="w-full h-10 px-3.5 text-xs sm:text-sm font-mono border transition-colors focus:outline-none focus:border-[var(--accent)]"
                          style={{
                            backgroundColor: 'var(--bg)',
                            borderColor: 'var(--border)',
                            borderRadius: 'var(--radius-sm)',
                            color: 'var(--text)',
                          }}
                        />
                        <p className="text-xs mt-1.5" style={{ color: 'var(--text-muted)' }}>
                          Synced across your devices for seamless mobile access.
                        </p>
                      </div>

                      {/* Test / Save Feedback */}
                      {gatewayTestResult && (
                        <div
                          className={`p-2.5 sm:p-3 rounded-lg text-xs font-medium flex items-center gap-2 border ${
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
                        <div className="p-2.5 sm:p-3 rounded-lg text-xs font-medium flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400">
                          <Check className="w-4 h-4 shrink-0" />
                          <span>Gateway preferences updated</span>
                        </div>
                      )}

                      {/* Action Buttons */}
                      <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 pt-1">
                        <button
                          type="submit"
                          disabled={isSavingGateway}
                          className="h-10 sm:h-9 px-3.5 py-1.5 text-xs font-semibold rounded transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] inline-flex items-center justify-center gap-1.5 shadow-xs"
                          style={{
                            backgroundColor: 'var(--accent)',
                            color: 'var(--accent-contrast)',
                          }}
                        >
                          {isSavingGateway ? (
                            <>
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                              <span>Saving...</span>
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
                          className="h-10 sm:h-9 px-3.5 py-1.5 text-xs font-medium rounded border transition-colors cursor-pointer hover:bg-[var(--surface-2)] active:scale-[0.98] inline-flex items-center justify-center gap-1.5 disabled:opacity-50"
                          style={{
                            borderColor: 'var(--border)',
                            color: 'var(--text)',
                          }}
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${isTestingGateway ? 'animate-spin' : ''}`} />
                          <span>{isTestingGateway ? 'Testing...' : 'Test'}</span>
                        </button>

                        {(gatewayInput || customGatewayUrl) && (
                          <button
                            type="button"
                            onClick={handleResetGateway}
                            className="col-span-2 sm:col-span-1 sm:ml-auto h-8 px-2 text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text)] transition-colors cursor-pointer inline-flex items-center justify-center gap-1"
                            title="Reset to default local & env candidates"
                          >
                            <RotateCcw className="w-3 h-3" />
                            <span>Reset to default</span>
                          </button>
                        )}
                      </div>
                    </form>
                  </div>
                </div>

                {/* Local Models Card */}
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
                        Local Models ({allModels.filter((m) => m.available).length})
                      </h3>
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        Available through your gateway server
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

                  <div className="p-4 sm:p-5" style={{ borderColor: 'var(--border)' }}>
                    <div className="flex flex-col gap-2 sm:gap-1.5">
                      {allModels.filter((m) => m.available).length === 0 ? (
                        <p className="text-xs py-2" style={{ color: 'var(--text-muted)' }}>
                          {laptopStatus === 'offline'
                            ? 'Connect to gateway to view installed models.'
                            : 'No models found. Add GGUF models into gateway models/ folder.'}
                        </p>
                      ) : (
                        allModels
                          .filter((m) => m.available)
                          .map((m) => {
                            const isSelected = m.id === selectedModelId;
                            return (
                              <button
                                key={m.id}
                                type="button"
                                onClick={() => setSelectedModelId(m.id)}
                                className="w-full min-h-[46px] sm:min-h-[42px] px-3.5 sm:px-4 py-2.5 flex items-center justify-between text-left text-sm border transition-all cursor-pointer active:scale-[0.99]"
                                style={{
                                  backgroundColor: isSelected ? 'var(--surface-2)' : 'var(--bg)',
                                  borderColor: isSelected ? 'var(--accent)' : 'var(--border)',
                                  color: 'var(--text)',
                                  borderRadius: 'var(--radius-sm)',
                                }}
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="font-medium truncate">{m.name}</span>
                                  {m.isDefault && (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded font-mono border bg-[var(--surface-2)] text-[var(--text-muted)] shrink-0">
                                      Default
                                    </span>
                                  )}
                                </div>
                                {isSelected && (
                                  <Check
                                    className="w-4 h-4 shrink-0 ml-2"
                                    style={{ color: 'var(--accent)' }}
                                  />
                                )}
                              </button>
                            );
                          })
                      )}
                    </div>
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
                                onClick={() => setKeyToUnlink({ id: k.id, label: k.label })}
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

                      <div className="flex flex-col gap-2 sm:gap-1.5 max-h-[320px] overflow-y-auto pr-0.5">
                        {models.map((m) => {
                          const isSelected = m.id === selectedModelId;
                          return (
                            <button
                              key={m.id}
                              type="button"
                              onClick={() => setSelectedModelId(m.id)}
                              className="w-full min-h-[46px] sm:min-h-[42px] px-3.5 sm:px-4 py-2.5 flex items-center justify-between text-left text-sm border transition-all cursor-pointer active:scale-[0.99]"
                              style={{
                                backgroundColor: isSelected ? 'var(--surface-2)' : 'var(--bg)',
                                borderColor: isSelected ? 'var(--accent)' : 'var(--border)',
                                color: 'var(--text)',
                                borderRadius: 'var(--radius-sm)',
                              }}
                            >
                              <span className="font-medium truncate">{m.name}</span>
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

      {/* Custom Delete Confirmation Dialogs */}
      <DeleteConfirmDialog
        isOpen={isClearAllMemoriesOpen}
        title="Clear All Memories?"
        description="This will permanently delete all remembered facts and preferences across your conversations. This action cannot be undone."
        confirmLabel="Clear All"
        cancelLabel="Cancel"
        icon="trash"
        isLoading={isDeletingAction}
        onConfirm={handleConfirmClearAllMemories}
        onClose={() => !isDeletingAction && setIsClearAllMemoriesOpen(false)}
      />

      <DeleteConfirmDialog
        isOpen={memoryToDelete !== null}
        title="Delete Memory?"
        description={
          memoryToDelete ? (
            <span>
              Are you sure you want to forget{' '}
              <span className="font-semibold" style={{ color: 'var(--text)' }}>
                “{memoryToDelete.content}”
              </span>
              ? This action cannot be undone.
            </span>
          ) : (
            'Are you sure you want to delete this memory?'
          )
        }
        confirmLabel="Delete"
        cancelLabel="Cancel"
        icon="trash"
        isLoading={isDeletingAction}
        onConfirm={handleConfirmDeleteMemory}
        onClose={() => !isDeletingAction && setMemoryToDelete(null)}
      />

      <DeleteConfirmDialog
        isOpen={keyToUnlink !== null}
        title="Unlink API Key?"
        description={
          keyToUnlink ? (
            <span>
              Are you sure you want to unlink your{' '}
              <span className="font-semibold" style={{ color: 'var(--text)' }}>
                {keyToUnlink.label}
              </span>{' '}
              API key? Associated models will become unavailable until you link a key again.
            </span>
          ) : (
            'Are you sure you want to unlink this API key?'
          )
        }
        confirmLabel="Unlink Key"
        cancelLabel="Cancel"
        icon="warning"
        isLoading={isDeletingAction}
        onConfirm={handleConfirmUnlinkKey}
        onClose={() => !isDeletingAction && setKeyToUnlink(null)}
      />
    </div>
  );
};
