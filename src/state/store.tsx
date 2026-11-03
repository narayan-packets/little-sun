import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  type ChatRow,
  createChatRow,
  deleteChatRow,
  deleteMessageRow,
  fetchChats,
  fetchMessages,
  getCurrentSession,
  insertMessageRow,
  makeChatTitleFromMessage,
  type MessageRow,
  renameChatRow,
  signInWithEmail,
  signOutUser,
  subscribeToAuth,
  subscribeToRealtimeSync,
  syncUserPreferences,
  touchChatRow,
  type UserSession,
  generateUUID,
} from '../lib/supabase';
import {
  checkGatewayHealth,
  fetchGatewayModels,
  fetchGatewayStatus,
  GatewayBusyError,
  GatewayForbiddenError,
  type GatewayModel,
  getActiveDirectGatewayUrl,
  getCustomGatewayUrl,
  getDetectedFunnelUrl,
  notifyGatewayChatSwitch,
  onFunnelUrlDetected,
  sanitizeBackendModels,
  sanitizeCandidateUrl,
  setCustomGatewayUrl,
  streamGatewayChat,
  testGatewayUrl,
} from '../lib/gateway';
import {
  type ChatContextUsage,
  computeChatContextUsage,
  trimMessagesForContext,
} from '../lib/tokens';
import { POCKET_VOICES, type PocketVoiceId, setSavedSpeed, setSavedVoice, ttsController } from '../lib/tts';
import { isMathPrompt, sanitizeMessageListForMath, stripHallucinatedMath } from '../lib/markdown';
import {
  type CloudConfig,
  type CloudModel,
  type CloudProviderId,
  type SavedApiKey,
  CLOUD_PROVIDERS,
  MAX_API_KEYS,
  fetchModelsForApiKey,
  findKeyForModel,
  getAllAvailableCloudModels,
  getSavedCloudConfig,
  saveCloudConfig,
  streamCloudChat,
} from '../lib/cloudApi';
import {
  cleanSourceTitle,
  extractContextualSearchQuery,
  extractSearchQuery,
  formatSearchResultsForPrompt,
  getSearchCooldownSeconds,
  isTemporalQuery,
  performWebSearch,
  shouldPerformWebSearch,
} from '../lib/webSearch';
import {
  clearAllMemoriesRows,
  deleteMemoryRow,
  extractExplicitMemory,
  extractForgetMemoryQuery,
  fetchMemories,
  formatMemoriesForPrompt,
  getIsMemoryEnabled,
  insertMemoryRow,
  type MemoryItem,
  setIsMemoryEnabled as saveIsMemoryEnabled,
} from '../lib/memory';

export type LaptopUiStatus = 'offline' | 'sleeping' | 'waking' | 'ready' | 'busy';
export type AppMode = 'local' | 'cloud';
export type SettingsRouteSection = 'account' | 'memory' | 'gateway' | 'cloud' | 'voices';

function parseSettingsSectionFromPath(pathname: string): SettingsRouteSection | null {
  const clean = pathname.replace(/\/+$/, '').toLowerCase();
  if (clean === '/settings' || clean === '/account' || clean === '/settings/account') {
    return 'account';
  }
  if (clean === '/memory' || clean === '/settings/memory') {
    return 'memory';
  }
  if (clean === '/gateway' || clean === '/settings/gateway') {
    return 'gateway';
  }
  if (clean === '/cloud' || clean === '/settings/cloud' || clean === '/api' || clean === '/settings/api') {
    return 'cloud';
  }
  if (clean === '/voices' || clean === '/settings/voices') {
    return 'voices';
  }
  return null;
}

function getPathForSettingsSection(section: SettingsRouteSection): string {
  if (section === 'memory') return '/memory';
  if (section === 'gateway') return '/gateway';
  if (section === 'voices') return '/voices';
  if (section === 'cloud') return '/cloud';
  return '/account';
}

interface FailedSendState {
  text: string;
  error: string;
}

const DISPLAY_NAME_KEY = 'littlesun_display_name_v1';
const SIDEBAR_COLLAPSED_KEY = 'littlesun_sidebar_collapsed_v1';

function deriveDefaultDisplayName(email?: string): string {
  if (!email) return 'User';
  const local = email.split('@')[0] || 'User';
  const firstSegment = local.split(/[._-]/)[0] || local;
  return firstSegment.charAt(0).toUpperCase() + firstSegment.slice(1);
}

export function slugifyChatTitle(title: string): string {
  const cleaned = title
    .toLowerCase()
    .trim()
    .replace(/^chat[-_\s]+/i, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
    .replace(/-+$/g, '');
  return cleaned;
}

export function getChatRoutePath(chat: ChatRow, allChats: ChatRow[]): string {
  const baseSlug = slugifyChatTitle(chat.title) || chat.id.slice(0, 8);
  const hasCollision = allChats.some(
    (other) => other.id !== chat.id && (slugifyChatTitle(other.title) || other.id.slice(0, 8)) === baseSlug
  );
  if (hasCollision) {
    return `/chat-${baseSlug}-${chat.id.slice(0, 6)}`;
  }
  return `/chat-${baseSlug}`;
}

export function resolveChatFromPath(pathname: string, allChats: ChatRow[]): ChatRow | null {
  if (!allChats.length) return null;
  const cleanPath = decodeURIComponent(pathname).replace(/\/+$/, '') || '/';

  // 1. Check exact route path match
  for (const chat of allChats) {
    if (getChatRoutePath(chat, allChats).toLowerCase() === cleanPath.toLowerCase()) {
      return chat;
    }
  }

  // 2. Extract token after /chat- or /chat/ or /c/
  let token = '';
  if (cleanPath.toLowerCase().startsWith('/chat-')) {
    token = cleanPath.slice(6).toLowerCase();
  } else if (cleanPath.toLowerCase().startsWith('/chat/')) {
    token = cleanPath.slice(6).toLowerCase();
  } else if (cleanPath.toLowerCase().startsWith('/c/')) {
    token = cleanPath.slice(3).toLowerCase();
  }

  if (!token) return null;

  // 3. Match by slugified title (e.g. /chat-001 matches chat titled "001")
  const bySlug = allChats.find((c) => slugifyChatTitle(c.title) === token);
  if (bySlug) return bySlug;

  // 4. Match by full ID or ID prefix/suffix
  const byId = allChats.find(
    (c) =>
      c.id.toLowerCase() === token ||
      c.id.toLowerCase().startsWith(token) ||
      token.endsWith(`-${c.id.slice(0, 6).toLowerCase()}`)
  );
  return byId || null;
}

function updateBrowserUrl(path: string, replace = false) {
  if (typeof window === 'undefined') return;
  const current = window.location.pathname;
  if (current === path) return;
  try {
    if (replace) {
      window.history.replaceState({ path }, '', path);
    } else {
      window.history.pushState({ path }, '', path);
    }
  } catch {
    // ignore in restricted environments
  }
}

interface AppStateContextValue {
  session: UserSession | null;
  authLoading: boolean;
  userDisplayName: string;
  setUserDisplayName: (name: string) => void;
  chats: ChatRow[];
  activeChatId: string | null;
  messages: MessageRow[];
  contextUsage: ChatContextUsage;
  models: GatewayModel[];
  allModels: GatewayModel[];
  selectedModelId: string;
  laptopStatus: LaptopUiStatus;
  mode: AppMode;
  setMode: (mode: AppMode) => void;
  cloudConfig: CloudConfig;
  addCloudApiKey: (data: { provider: CloudProviderId; apiKey: string; baseUrl?: string }) => Promise<void>;
  unlinkCloudApiKey: (id: string) => void;
  refreshCloudApiKeyModels: (id: string) => Promise<void>;
  cloudStatus: 'ready' | 'generating' | 'error' | 'unconfigured';
  isAccessRestricted: boolean;
  isStreaming: boolean;
  streamingStage: 'idle' | 'loading_model' | 'generating';
  streamingContent: string;
  composerDraft: string;
  failedSend: FailedSendState | null;
  isSidebarOpen: boolean;
  isDesktopSidebarCollapsed: boolean;
  isSettingsOpen: boolean;
  isShortcutsOpen: boolean;
  settingsSection: SettingsRouteSection;
  isWebSearchActive: boolean;
  searchCooldown: number;
  toggleWebSearch: () => void;
  setIsWebSearchActive: (val: boolean | ((prev: boolean) => boolean)) => void;
  setIsShortcutsOpen: (open: boolean | ((prev: boolean) => boolean)) => void;
  setComposerDraft: (text: string) => void;
  setSelectedModelId: (modelId: string) => void;
  setIsSidebarOpen: (open: boolean) => void;
  toggleDesktopSidebar: () => void;
  setIsSettingsOpen: (open: boolean) => void;
  openSettingsSection: (section: SettingsRouteSection) => void;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  selectChat: (chatId: string | null) => Promise<void>;
  startNewChat: () => void;
  continueInNewChat: () => void;
  renameChat: (chatId: string, newTitle: string) => Promise<void>;
  deleteChat: (chatId: string) => Promise<void>;
  sendMessage: (contentOverride?: string, attachmentsOverride?: AttachmentItem[]) => Promise<void>;
  stopGenerating: () => void;
  regenerateLastReply: () => Promise<void>;
  clearFailedSendError: () => void;
  refreshGateway: () => Promise<void>;
  customGatewayUrl: string;
  detectedFunnelUrl: string;
  activeGatewayEndpoint: string | null;
  updateGatewayUrl: (url: string) => Promise<boolean>;
  testGatewayConnection: (url: string) => Promise<{ ok: boolean; latencyMs: number; error?: string }>;
  memories: MemoryItem[];
  isMemoryEnabled: boolean;
  setIsMemoryEnabled: (enabled: boolean) => Promise<void>;
  addMemory: (content: string, category?: string) => Promise<MemoryItem | null>;
  removeMemory: (memoryId: string) => Promise<void>;
  clearMemories: () => Promise<void>;
  memoryNotification: string | null;
  clearMemoryNotification: () => void;
}

export interface AttachmentItem {
  id: string;
  name: string;
  size: number;
  type: 'text' | 'image';
  dataUrl?: string;
  textContent?: string;
}

const AppStateContext = createContext<AppStateContextValue | null>(null);

export const AppStateProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<UserSession | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [customDisplayName, setCustomDisplayName] = useState<string>(() => {
    try {
      return localStorage.getItem(DISPLAY_NAME_KEY) || '';
    } catch {
      return '';
    }
  });

  const [isDesktopSidebarCollapsed, setIsDesktopSidebarCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === 'true';
    } catch {
      return false;
    }
  });

  const [chats, setChats] = useState<ChatRow[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageRow[]>([]);

  const [mode, setModeState] = useState<AppMode>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('littlesun_mode_v1');
      if (saved === 'cloud' || saved === 'local') return saved;
    }
    return 'local';
  });

  const setMode = useCallback((nextMode: AppMode) => {
    setModeState(nextMode);
    try {
      localStorage.setItem('littlesun_mode_v1', nextMode);
    } catch {
      // ignore
    }
  }, []);

  const [cloudConfig, setCloudConfigState] = useState<CloudConfig>(() => getSavedCloudConfig());

  const addCloudApiKey = useCallback(
    async (data: { provider: CloudProviderId; apiKey: string; baseUrl?: string }) => {
      if (cloudConfig.keys.length >= MAX_API_KEYS) {
        throw new Error(`Maximum of ${MAX_API_KEYS} API keys reached. Please unlink an API key first.`);
      }

      const prov = data.provider;
      const info = CLOUD_PROVIDERS[prov] || CLOUD_PROVIDERS.openrouter;
      const baseUrl = data.baseUrl?.trim() || info.defaultBaseUrl;

      // Real-time model fetching using this key!
      const models = await fetchModelsForApiKey(prov, data.apiKey, baseUrl);

      const newKey: SavedApiKey = {
        id: generateUUID(),
        provider: prov,
        label: info.name,
        apiKey: data.apiKey.trim(),
        baseUrl,
        addedAt: new Date().toISOString(),
        models,
      };

      setCloudConfigState((prev) => {
        const nextKeys = [...prev.keys, newKey];
        const nextSelected = prev.selectedModelId || models[0]?.id || '';
        const next = { ...prev, keys: nextKeys, selectedModelId: nextSelected };
        saveCloudConfig(next);
        return next;
      });
    },
    [cloudConfig.keys.length]
  );

  const unlinkCloudApiKey = useCallback((id: string) => {
    setCloudConfigState((prev) => {
      const nextKeys = prev.keys.filter((k) => k.id !== id);
      const remainingModels = getAllAvailableCloudModels({ ...prev, keys: nextKeys });
      const stillHasSelected = remainingModels.some((m) => m.id === prev.selectedModelId);
      const nextSelected = stillHasSelected ? prev.selectedModelId : remainingModels[0]?.id || '';
      const next = { ...prev, keys: nextKeys, selectedModelId: nextSelected };
      saveCloudConfig(next);
      return next;
    });
  }, []);

  const refreshCloudApiKeyModels = useCallback(async (id: string) => {
    const targetKey = cloudConfig.keys.find((k) => k.id === id);
    if (!targetKey) return;
    const models = await fetchModelsForApiKey(targetKey.provider, targetKey.apiKey, targetKey.baseUrl);
    setCloudConfigState((prev) => {
      const nextKeys = prev.keys.map((k) => (k.id === id ? { ...k, models } : k));
      const next = { ...prev, keys: nextKeys };
      saveCloudConfig(next);
      return next;
    });
  }, [cloudConfig.keys]);

  const effectiveCloudModels = useMemo<GatewayModel[]>(() => {
    const rawList = getAllAvailableCloudModels(cloudConfig);
    return rawList.map((m) => ({
      id: m.id,
      name: m.name || m.id,
      available: true,
      enabled: true,
      isDefault: m.id === cloudConfig.selectedModelId,
      contextSize: m.contextSize || 131072,
      maxTokens: 4096,
    }));
  }, [cloudConfig]);

  const [allModels, setAllModels] = useState<GatewayModel[]>([]);

  // Listed models (enabled by user)
  const models = useMemo(() => {
    if (mode === 'cloud') {
      return effectiveCloudModels;
    }
    const enabledList = allModels.filter((m) => m.enabled !== false);
    return enabledList.length > 0 ? enabledList : allModels;
  }, [mode, effectiveCloudModels, allModels]);

  const [localSelectedModelId, setLocalSelectedModelId] = useState<string>('');

  const selectedModelId = useMemo(() => {
    if (mode === 'cloud') {
      return cloudConfig.selectedModelId || effectiveCloudModels[0]?.id || '';
    }
    return localSelectedModelId;
  }, [mode, cloudConfig.selectedModelId, effectiveCloudModels, localSelectedModelId]);

  const setSelectedModelId = useCallback(
    (id: string) => {
      if (mode === 'cloud') {
        setCloudConfigState((prev) => {
          const next = { ...prev, selectedModelId: id };
          saveCloudConfig(next);
          return next;
        });
      } else {
        setLocalSelectedModelId(id);
      }
    },
    [mode]
  );

  const [laptopStatus, setLaptopStatus] = useState<LaptopUiStatus>('sleeping');
  const [isAccessRestricted, setIsAccessRestricted] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingStage, setStreamingStage] = useState<'idle' | 'loading_model' | 'generating'>('idle');
  const [streamingContent, setStreamingContent] = useState('');

  const cloudStatus = useMemo<'ready' | 'generating' | 'error' | 'unconfigured'>(() => {
    if (cloudConfig.keys.length === 0) {
      return 'unconfigured';
    }
    if (isStreaming && mode === 'cloud') {
      return 'generating';
    }
    return 'ready';
  }, [cloudConfig.keys.length, isStreaming, mode]);

  const [composerDraft, setComposerDraft] = useState('');
  const [failedSend, setFailedSend] = useState<FailedSendState | null>(null);

  const [customGatewayUrl, setCustomGatewayUrlState] = useState<string>(() => getCustomGatewayUrl());
  const [detectedFunnelUrl, setDetectedFunnelUrl] = useState<string>(() => getDetectedFunnelUrl());
  const [activeGatewayEndpoint, setActiveGatewayEndpoint] = useState<string | null>(() => getActiveDirectGatewayUrl());

  // The Memory System (V2.1) State
  const [memories, setMemories] = useState<MemoryItem[]>([]);
  const [isMemoryEnabled, setIsMemoryEnabledState] = useState<boolean>(() => getIsMemoryEnabled());
  const [memoryNotification, setMemoryNotification] = useState<string | null>(null);

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [settingsSection, setSettingsSectionState] = useState<SettingsRouteSection>(() => {
    if (typeof window !== 'undefined') {
      return parseSettingsSectionFromPath(window.location.pathname) || 'account';
    }
    return 'account';
  });
  const [isSettingsOpen, setIsSettingsOpenState] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return parseSettingsSectionFromPath(window.location.pathname) !== null;
    }
    return false;
  });
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const [isWebSearchActive, setIsWebSearchActive] = useState<boolean>(false);
  const [searchCooldown, setSearchCooldown] = useState<number>(() => getSearchCooldownSeconds());

  useEffect(() => {
    if (searchCooldown <= 0) return;
    const timer = setInterval(() => {
      setSearchCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [searchCooldown]);

  const toggleWebSearch = useCallback(() => {
    setIsWebSearchActive((prev) => !prev);
  }, []);

  const abortControllerRef = useRef<AbortController | null>(null);
  const pollGatewayRef = useRef<() => Promise<void>>(async () => {});
  const isStreamingRef = useRef(false);
  const latestSelectedChatRef = useRef<string | null>(null);
  const nameSyncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialRouteResolvedRef = useRef(false);
  const initialPathRef = useRef<string>(
    typeof window !== 'undefined' ? window.location.pathname : '/'
  );

  useEffect(() => {
    latestSelectedChatRef.current = activeChatId;
  }, [activeChatId]);

  const userDisplayName = useMemo(() => {
    if (customDisplayName.trim()) return customDisplayName.trim();
    return deriveDefaultDisplayName(session?.user.email);
  }, [customDisplayName, session?.user.email]);

  const setUserDisplayName = useCallback((name: string) => {
    setCustomDisplayName(name);
    const trimmed = name.trim();
    try {
      if (trimmed) {
        localStorage.setItem(DISPLAY_NAME_KEY, trimmed);
      } else {
        localStorage.removeItem(DISPLAY_NAME_KEY);
      }
    } catch {
      // ignore
    }
    if (nameSyncTimerRef.current) clearTimeout(nameSyncTimerRef.current);
    nameSyncTimerRef.current = setTimeout(() => {
      void syncUserPreferences({ display_name: trimmed });
    }, 600);
  }, []);

  const toggleDesktopSidebar = useCallback(() => {
    setIsDesktopSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(next));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  const getActiveChatRoute = useCallback(
    (targetChatId: string | null, chatList: ChatRow[]) => {
      if (!targetChatId) return '/newchat';
      const found = chatList.find((c) => c.id === targetChatId);
      if (!found) return '/newchat';
      return getChatRoutePath(found, chatList);
    },
    []
  );

  const setIsSettingsOpen = useCallback(
    (open: boolean) => {
      setIsSettingsOpenState(open);
      if (open) {
        setSettingsSectionState('account');
        updateBrowserUrl('/account');
      } else {
        const backPath = getActiveChatRoute(activeChatId, chats);
        updateBrowserUrl(backPath);
      }
    },
    [activeChatId, chats, getActiveChatRoute]
  );

  const openSettingsSection = useCallback((section: SettingsRouteSection) => {
    setSettingsSectionState(section);
    setIsSettingsOpenState(true);
    updateBrowserUrl(getPathForSettingsSection(section));
  }, []);

  // Hydrate user preferences from Supabase auth metadata when session loads
  const hydrateSessionPreferences = useCallback((s: UserSession | null) => {
    if (!s?.user?.metadata) return;
    const meta = s.user.metadata;
    if (meta.display_name && typeof meta.display_name === 'string' && meta.display_name.trim()) {
      setCustomDisplayName(meta.display_name.trim());
      try {
        localStorage.setItem(DISPLAY_NAME_KEY, meta.display_name.trim());
      } catch {
        // ignore
      }
    }
    if (meta.tts_voice && POCKET_VOICES.some((v) => v.id === meta.tts_voice)) {
      setSavedVoice(meta.tts_voice as PocketVoiceId, false);
    }
    if (typeof meta.tts_speed === 'number' && meta.tts_speed >= 0.75 && meta.tts_speed <= 1.5) {
      setSavedSpeed(meta.tts_speed, false);
    }
    if (typeof meta.memory_enabled === 'boolean') {
      setIsMemoryEnabledState(meta.memory_enabled);
      saveIsMemoryEnabled(meta.memory_enabled);
    }
    if (meta.gateway_url && typeof meta.gateway_url === 'string' && meta.gateway_url.trim()) {
      const cur = getCustomGatewayUrl();
      if (!cur || cur !== meta.gateway_url.trim()) {
        setCustomGatewayUrl(meta.gateway_url.trim());
        setCustomGatewayUrlState(meta.gateway_url.trim());
        void checkGatewayHealth().then((ok) => {
          if (ok) {
            setActiveGatewayEndpoint(getActiveDirectGatewayUrl());
            void pollGatewayRef.current();
          }
        });
      }
    }
  }, []);

  // Initialize auth session
  useEffect(() => {
    let mounted = true;
    getCurrentSession()
      .then((s) => {
        if (mounted) {
          setSession(s);
          hydrateSessionPreferences(s);
          if (s?.user?.id) {
            void fetchMemories(s.user.id).then((m) => {
              if (mounted) setMemories(m);
            });
          }
          setAuthLoading(false);
        }
      })
      .catch(() => {
        if (mounted) setAuthLoading(false);
      });

    const unsubscribe = subscribeToAuth((s) => {
      if (mounted) {
        setSession(s);
        hydrateSessionPreferences(s);
        if (!s) {
          ttsController.stop();
          setChats([]);
          setActiveChatId(null);
          setMessages([]);
          setMemories([]);
          setMemoryNotification(null);
          initialRouteResolvedRef.current = false;
        } else {
          void fetchMemories(s.user.id).then((m) => {
            if (mounted) setMemories(m);
          });
        }
      }
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [hydrateSessionPreferences]);

  // Load chats when session changes & resolve initial URL route (/newchat, /settings, /chat-001)
  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    fetchChats(session.user.id)
      .then(async (list) => {
        if (cancelled) return;
        setChats(list);

        if (!initialRouteResolvedRef.current) {
          initialRouteResolvedRef.current = true;
          const rawPath =
            (typeof window !== 'undefined' ? window.location.pathname : initialPathRef.current) || '/';
          const normalized = rawPath.replace(/\/+$/, '').toLowerCase() || '/';

          const matchedSettingsSection = parseSettingsSectionFromPath(normalized);
          if (matchedSettingsSection) {
            setSettingsSectionState(matchedSettingsSection);
            setIsSettingsOpenState(true);
            updateBrowserUrl(getPathForSettingsSection(matchedSettingsSection), true);
            return;
          }

          if (normalized === '/' || normalized === '/newchat' || normalized === '/new-chat' || normalized === '/login') {
            setIsSettingsOpenState(false);
            setActiveChatId(null);
            setMessages([]);
            updateBrowserUrl('/newchat', true);
            return;
          }

          const matchedChat = resolveChatFromPath(rawPath, list);
          if (matchedChat) {
            setIsSettingsOpenState(false);
            setActiveChatId(matchedChat.id);
            try {
              const rows = await fetchMessages(session.user.id, matchedChat.id);
              if (!cancelled) setMessages(sanitizeMessageListForMath(rows));
            } catch {
              if (!cancelled) setMessages([]);
            }
            updateBrowserUrl(getChatRoutePath(matchedChat, list), true);
          } else {
            setIsSettingsOpenState(false);
            setActiveChatId(null);
            setMessages([]);
            updateBrowserUrl('/newchat', true);
          }
        }
      })
      .catch(() => {
        // ignore
      });
    return () => {
      cancelled = true;
    };
  }, [session]);

  // Real-time & focus synchronization for chats and active chat messages across devices/tabs
  useEffect(() => {
    if (!session) return;
    const userId = session.user.id;

    const syncChatsList = async () => {
      try {
        const list = await fetchChats(userId);
        setChats(list);
      } catch {
        // ignore transient error
      }
    };

    const syncActiveMessages = async (targetChatId?: string) => {
      if (isStreamingRef.current) return;
      const currentId = latestSelectedChatRef.current;
      if (!currentId) return;
      if (targetChatId && targetChatId !== currentId) return;
      try {
        const rows = await fetchMessages(userId, currentId);
        if (latestSelectedChatRef.current === currentId && !isStreamingRef.current) {
          setMessages(sanitizeMessageListForMath(rows));
        }
      } catch {
        // ignore
      }
    };

    const syncMemoriesList = async () => {
      try {
        const mems = await fetchMemories(userId);
        setMemories(mems);
      } catch {
        // ignore
      }
    };

    const unsubscribeRealtime = subscribeToRealtimeSync(userId, (scope, changedChatId) => {
      if (scope === 'chats') {
        void syncChatsList();
      } else if (scope === 'messages') {
        void syncActiveMessages(changedChatId);
      } else if (scope === 'memories') {
        void syncMemoriesList();
      }
    });

    const onFocusSync = () => {
      if (document.visibilityState === 'visible') {
        void syncChatsList();
        void syncActiveMessages();
        void syncMemoriesList();
      }
    };

    window.addEventListener('focus', onFocusSync);
    document.addEventListener('visibilitychange', onFocusSync);

    return () => {
      unsubscribeRealtime();
      window.removeEventListener('focus', onFocusSync);
      document.removeEventListener('visibilitychange', onFocusSync);
    };
  }, [session]);

  // Keep document.title synchronized with current route / chat
  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (!session) {
      document.title = 'Sign in · Little Sun';
      return;
    }
    if (isSettingsOpen) {
      if (settingsSection === 'voices') {
        document.title = 'Voices · Little Sun';
      } else if (settingsSection === 'cloud') {
        document.title = 'Cloud API · Little Sun';
      } else {
        document.title = 'Account · Little Sun';
      }
      return;
    }
    if (activeChatId) {
      const active = chats.find((c) => c.id === activeChatId);
      if (active?.title) {
        document.title = `${active.title} · Little Sun`;
        return;
      }
    }
    document.title = 'Little Sun';
  }, [session, isSettingsOpen, activeChatId, chats]);

  // Poll Gateway health and status every 15s while visible + on focus
  const pollGateway = useCallback(async () => {
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
      return;
    }

    const healthy = await checkGatewayHealth();
    setActiveGatewayEndpoint(getActiveDirectGatewayUrl());
    if (!healthy) {
      setLaptopStatus('offline');
      return;
    }

    if (!session) {
      setLaptopStatus('sleeping');
      return;
    }

    try {
      const [statusRes, modelsRes] = await Promise.all([
        fetchGatewayStatus(session.accessToken),
        fetchGatewayModels(session.accessToken),
      ]);

      setIsAccessRestricted(false);

      if (Array.isArray(modelsRes)) {
        setAllModels(modelsRes);
        if (modelsRes.length > 0) {
          const listed = modelsRes.filter((m) => m.enabled !== false);
          const pool = listed.length > 0 ? listed : modelsRes;
          const def =
            pool.find((m) => m.isDefault && m.available) ||
            pool.find((m) => m.available) ||
            pool[0];
          setLocalSelectedModelId((prev) => {
            if (pool.some((m) => m.id === prev && m.available)) return prev;
            return def.id;
          });
        } else {
          setLocalSelectedModelId('');
        }
      }

      if (!isStreamingRef.current) {
        const llmState = statusRes.llm.state;
        if (llmState === 'unloaded') {
          setLaptopStatus('sleeping');
        } else if (llmState === 'loading') {
          setLaptopStatus('waking');
        } else if (llmState === 'processing') {
          setLaptopStatus('busy');
        } else {
          setLaptopStatus('ready');
        }
      }
    } catch (err) {
      if (err instanceof GatewayForbiddenError) {
        setIsAccessRestricted(true);
        return;
      }
      if (!isStreamingRef.current) {
        setLaptopStatus((prev) => (prev === 'offline' ? 'sleeping' : prev));
      }
    }
  }, [session]);

  useEffect(() => {
    pollGateway();
    const interval = setInterval(pollGateway, 15_000);
    const onFocusOrVisible = () => {
      if (document.visibilityState === 'visible') {
        pollGateway();
      }
    };
    window.addEventListener('focus', onFocusOrVisible);
    document.addEventListener('visibilitychange', onFocusOrVisible);
    window.addEventListener('online', pollGateway);
    window.addEventListener('offline', () => setLaptopStatus('offline'));

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', onFocusOrVisible);
      document.removeEventListener('visibilitychange', onFocusOrVisible);
      window.removeEventListener('online', pollGateway);
    };
  }, [pollGateway]);

  pollGatewayRef.current = pollGateway;

  // Synchronize detected Tailscale Funnel URL from laptop gateway to Supabase user metadata
  useEffect(() => {
    return onFunnelUrlDetected((url) => {
      setDetectedFunnelUrl(url);
      if (session?.user?.id && url) {
        const currentMeta = session.user.metadata?.gateway_url;
        if (currentMeta !== url) {
          void syncUserPreferences({ gateway_url: url });
        }
      }
    });
  }, [session]);

  const updateGatewayUrl = useCallback(
    async (url: string): Promise<boolean> => {
      const clean = sanitizeCandidateUrl(url);
      setCustomGatewayUrl(clean);
      setCustomGatewayUrlState(clean);
      if (session?.user?.id) {
        await syncUserPreferences({ gateway_url: clean });
      }
      const ok = await checkGatewayHealth();
      setActiveGatewayEndpoint(getActiveDirectGatewayUrl());
      if (ok) {
        await pollGateway();
      } else {
        setLaptopStatus('offline');
      }
      return ok;
    },
    [session, pollGateway]
  );

  const testGatewayConnection = useCallback(async (url: string) => {
    return await testGatewayUrl(url);
  }, []);

  const setIsMemoryEnabled = useCallback(
    async (enabled: boolean) => {
      setIsMemoryEnabledState(enabled);
      saveIsMemoryEnabled(enabled);
      if (session?.user?.id) {
        await syncUserPreferences({ memory_enabled: enabled });
      }
    },
    [session]
  );

  const addMemory = useCallback(
    async (content: string, category?: string) => {
      if (!session?.user?.id) return null;
      const trimmed = content.trim();
      if (!trimmed) return null;
      if (memories.some((m) => m.content.toLowerCase() === trimmed.toLowerCase())) {
        return null;
      }
      const row = await insertMemoryRow(session.user.id, trimmed, category as any);
      setMemories((prev) => [row, ...prev.filter((m) => m.id !== row.id)]);
      return row;
    },
    [session, memories]
  );

  const removeMemory = useCallback(
    async (memoryId: string) => {
      if (!session?.user?.id) return;
      await deleteMemoryRow(session.user.id, memoryId);
      setMemories((prev) => prev.filter((m) => m.id !== memoryId));
    },
    [session]
  );

  const clearMemories = useCallback(async () => {
    if (!session?.user?.id) return;
    await clearAllMemoriesRows(session.user.id);
    setMemories([]);
  }, [session]);

  const clearMemoryNotification = useCallback(() => {
    setMemoryNotification(null);
  }, []);

  const stopGenerating = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  const selectChat = useCallback(
    async (chatId: string | null) => {
      if (chatId === activeChatId && !isSettingsOpen) {
        setIsSidebarOpen(false);
        return;
      }

      // Kill/abort any active stream or TTS on the previous chat instance and sleep its gateway slot
      stopGenerating();
      ttsController.stop();
      setStreamingContent('');
      latestSelectedChatRef.current = chatId;
      setActiveChatId(chatId);
      setMessages([]);
      setIsSidebarOpen(false);
      setIsSettingsOpenState(false);
      setFailedSend(null);

      if (session) {
        void notifyGatewayChatSwitch(session.accessToken, chatId, 'sleep');
      }

      if (!chatId || !session) {
        updateBrowserUrl('/newchat');
        return;
      }

      const chatObj = chats.find((c) => c.id === chatId);
      if (chatObj) {
        updateBrowserUrl(getChatRoutePath(chatObj, chats));
      }

      try {
        const rows = await fetchMessages(session.user.id, chatId);
        if (latestSelectedChatRef.current === chatId) {
          setMessages(sanitizeMessageListForMath(rows));
          if (chatObj?.model_id && allModels.some((m) => m.id === chatObj.model_id && m.available)) {
            setSelectedModelId(chatObj.model_id);
          }
        }
      } catch {
        if (latestSelectedChatRef.current === chatId) {
          setMessages([]);
        }
      }
    },
    [session, chats, allModels, activeChatId, isSettingsOpen, stopGenerating]
  );

  const startNewChat = useCallback(() => {
    stopGenerating();
    ttsController.stop();
    setStreamingContent('');
    latestSelectedChatRef.current = null;
    setActiveChatId(null);
    setMessages([]);
    setFailedSend(null);
    setIsSidebarOpen(false);
    setIsSettingsOpenState(false);
    setIsShortcutsOpen(false);
    if (session) {
      void notifyGatewayChatSwitch(session.accessToken, null, 'sleep');
    }
    updateBrowserUrl('/newchat');

    // Desktop auto-focus on composer textarea
    if (typeof window !== 'undefined') {
      setTimeout(() => {
        const isMobile =
          window.matchMedia('(max-width: 767px)').matches ||
          'ontouchstart' in window ||
          navigator.maxTouchPoints > 0;
        if (!isMobile) {
          const textarea = document.querySelector<HTMLTextAreaElement>('.composer-textarea');
          if (textarea) {
            textarea.focus();
          }
        }
      }, 50);
    }
  }, [session, stopGenerating]);

  const continueInNewChat = useCallback(() => {
    const recentSlice = messages.slice(-2);
    const seedLines = recentSlice
      .map((m) => `${m.role === 'user' ? 'Previous question' : 'Previous reply'}: ${m.content.slice(0, 280).trim()}`)
      .join('\n\n');
    const carryPrompt = seedLines
      ? `Continuing from previous conversation:\n${seedLines}\n\nNext: `
      : '';
    startNewChat();
    if (carryPrompt) {
      setComposerDraft(carryPrompt);
    }
  }, [messages, startNewChat]);

  // Desktop keyboard shortcuts:
  // - Ctrl/Cmd + Shift + O or Ctrl/Cmd + K: new chat instance
  // - ? or Ctrl/Cmd + /: toggle keyboard shortcuts helper
  // - Esc: dismiss shortcuts modal
  useEffect(() => {
    if (typeof window === 'undefined' || !session) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMod = e.metaKey || e.ctrlKey;
      const key = e.key.toLowerCase();
      const targetTag = (e.target as HTMLElement)?.tagName;
      const isTyping =
        targetTag === 'INPUT' ||
        targetTag === 'TEXTAREA' ||
        (e.target as HTMLElement)?.isContentEditable;

      // Toggle shortcuts modal: Ctrl/Cmd + / or ?
      if (isMod && (e.key === '/' || e.key === '?')) {
        e.preventDefault();
        setIsShortcutsOpen((prev) => !prev);
        return;
      }

      // Standalone ? when not typing inside an input/textarea
      if (!isMod && e.key === '?' && !isTyping) {
        e.preventDefault();
        setIsShortcutsOpen((prev) => !prev);
        return;
      }

      // Close shortcuts modal on Escape
      if (e.key === 'Escape' && isShortcutsOpen) {
        e.preventDefault();
        setIsShortcutsOpen(false);
        return;
      }

      // New Chat: Ctrl/Cmd + Shift + O or Ctrl/Cmd + K
      if (isMod && ((e.shiftKey && key === 'o') || (!e.shiftKey && key === 'k'))) {
        e.preventDefault();
        startNewChat();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [session, startNewChat, isShortcutsOpen]);

  // Browser Back / Forward navigation (popstate)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handlePopState = async () => {
      const path = window.location.pathname.replace(/\/+$/, '') || '/';
      const lower = path.toLowerCase();

      const matchedSettingsSection = parseSettingsSectionFromPath(lower);
      if (matchedSettingsSection) {
        setSettingsSectionState(matchedSettingsSection);
        setIsSettingsOpenState(true);
        setIsSidebarOpen(false);
        return;
      }

      setIsSettingsOpenState(false);
      setIsSidebarOpen(false);

      if (lower === '/' || lower === '/newchat' || lower === '/new-chat') {
        stopGenerating();
        ttsController.stop();
        setStreamingContent('');
        setActiveChatId(null);
        setMessages([]);
        setFailedSend(null);
        if (session) {
          void notifyGatewayChatSwitch(session.accessToken, null, 'sleep');
        }
        return;
      }

      const matched = resolveChatFromPath(path, chats);
      if (matched && session) {
        stopGenerating();
        ttsController.stop();
        setStreamingContent('');
        setActiveChatId(matched.id);
        setFailedSend(null);
        void notifyGatewayChatSwitch(session.accessToken, matched.id, 'sleep');
        try {
          const rows = await fetchMessages(session.user.id, matched.id);
          setMessages(sanitizeMessageListForMath(rows));
        } catch {
          setMessages([]);
        }
      } else {
        setActiveChatId(null);
        setMessages([]);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [chats, session, stopGenerating]);

  const signIn = useCallback(async (email: string, password: string) => {
    const s = await signInWithEmail(email, password);
    setSession(s);
    updateBrowserUrl('/newchat', true);
  }, []);

  const signOut = useCallback(async () => {
    stopGenerating();
    ttsController.stop();
    if (session) {
      void notifyGatewayChatSwitch(session.accessToken, null, 'kill');
    }
    await signOutUser();
    setSession(null);
    setIsSettingsOpenState(false);
    updateBrowserUrl('/login', true);
  }, [session, stopGenerating]);

  const renameChat = useCallback(
    async (chatId: string, newTitle: string) => {
      if (!session) return;
      const updated = await renameChatRow(session.user.id, chatId, newTitle);
      setChats((prev) => {
        const next = prev.map((c) => (c.id === chatId ? updated : c));
        if (activeChatId === chatId) {
          updateBrowserUrl(getChatRoutePath(updated, next), true);
        }
        return next;
      });
    },
    [session, activeChatId]
  );

  const deleteChat = useCallback(
    async (chatId: string) => {
      if (!session) return;
      if (activeChatId === chatId) {
        stopGenerating();
        ttsController.stop();
        void notifyGatewayChatSwitch(session.accessToken, null, 'kill');
      }
      await deleteChatRow(session.user.id, chatId);
      setChats((prev) => prev.filter((c) => c.id !== chatId));
      if (activeChatId === chatId) {
        setActiveChatId(null);
        setMessages([]);
        updateBrowserUrl('/newchat');
      }
    },
    [session, activeChatId, stopGenerating]
  );

  const activeModelMeta = useMemo(() => {
    const activeList = mode === 'cloud' ? effectiveCloudModels : allModels;
    return activeList.find((m) => m.id === selectedModelId) || activeList[0];
  }, [mode, effectiveCloudModels, allModels, selectedModelId]);

  const contextUsage = useMemo<ChatContextUsage>(() => {
    const effectiveHistory = isStreaming && streamingContent
      ? [...messages, { role: 'assistant' as const, content: streamingContent }]
      : messages;
    return computeChatContextUsage(
      effectiveHistory,
      composerDraft,
      activeModelMeta?.contextSize || 16384,
      activeModelMeta?.maxTokens || 4096
    );
  }, [messages, isStreaming, streamingContent, composerDraft, activeModelMeta]);

  const runAssistantStream = useCallback(
    async (chatId: string, historyForContext: MessageRow[], modelId: string) => {
      if (!session) return;

      const activeList = mode === 'cloud' ? effectiveCloudModels : allModels;
      const modelMeta = activeList.find((m) => m.id === modelId) || activeList[0];
      const cleanedHistory = sanitizeMessageListForMath(
        historyForContext.map((m) => {
          // Strip previously appended "### Sources" citation lists from history so LLMs don't get trapped in repetition loops
          const textWithoutSources = m.content.replace(/\n\n### Sources[\s\S]*$/, '').trim();
          return { role: m.role, content: textWithoutSources };
        })
      );

      const trimmedPayload = trimMessagesForContext(
        cleanedHistory,
        modelMeta?.contextSize || 16384,
        modelMeta?.maxTokens || 4096
      );

      // Generate current real-time temporal string
      const now = new Date();
      const dateStr = now.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
      const timeStr = now.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });
      const temporalContext = `Temporal Context: Today is ${dateStr}. Current local time is ${timeStr}.`;

      // The Memory System (V2.1): Detect explicit memory directives and inject user memory context
      let currentMemories = memories;
      if (isMemoryEnabled) {
        const lastUser = [...cleanedHistory].reverse().find((m) => m.role === 'user');
        if (lastUser?.content) {
          const explicitFact = extractExplicitMemory(lastUser.content);
          if (explicitFact) {
            void addMemory(explicitFact).then((newMem) => {
              if (newMem) {
                setMemoryNotification(`Remembered: "${newMem.content}"`);
                setTimeout(() => setMemoryNotification(null), 3600);
              }
            });
            if (!currentMemories.some((m) => m.content.toLowerCase() === explicitFact.toLowerCase())) {
              currentMemories = [
                {
                  id: generateUUID(),
                  content: explicitFact,
                  category: 'general',
                  created_at: new Date().toISOString(),
                },
                ...currentMemories,
              ];
            }
          }

          const forgetFact = extractForgetMemoryQuery(lastUser.content);
          if (forgetFact) {
            const match = currentMemories.find((m) =>
              m.content.toLowerCase().includes(forgetFact.toLowerCase())
            );
            if (match) {
              void removeMemory(match.id).then(() => {
                setMemoryNotification(`Forgotten: "${match.content}"`);
                setTimeout(() => setMemoryNotification(null), 3600);
              });
              currentMemories = currentMemories.filter((m) => m.id !== match.id);
            }
          }
        }
      }

      const memoryContext =
        isMemoryEnabled && currentMemories.length > 0
          ? formatMemoriesForPrompt(currentMemories)
          : '';

      // Perform free live web search if enabled (works in both Local and Cloud modes)
      let liveWebContext = '';
      let searchSources: Array<{ title: string; url: string }> = [];
      if (isWebSearchActive) {
        const lastUser = [...cleanedHistory].reverse().find((m) => m.role === 'user');
        if (lastUser?.content && shouldPerformWebSearch(lastUser.content)) {
          try {
            const rawQuery = extractContextualSearchQuery(lastUser.content, cleanedHistory);
            if (rawQuery && !isTemporalQuery(rawQuery)) {
              const results = await performWebSearch(
                rawQuery,
                5,
                (sec) => setSearchCooldown(sec),
                session?.accessToken
              );
              if (results.length > 0) {
                // Deduplicate by root hostname to avoid multiple links to the same site
                const seenHostnames = new Set<string>();
                const distinctSources: Array<{ title: string; url: string }> = [];

                for (const r of results) {
                  let hostname = '';
                  try {
                    hostname = new URL(r.url).hostname.replace(/^www\./, '');
                  } catch {
                    hostname = r.url;
                  }
                  if (!seenHostnames.has(hostname)) {
                    seenHostnames.add(hostname);
                    distinctSources.push({
                      title: cleanSourceTitle(r.title, hostname),
                      url: r.url,
                    });
                  }
                }

                // Show only genuinely distinct sources (1 to 3 sources, never forced to 3)
                if (distinctSources.length > 0) {
                  searchSources = distinctSources.slice(0, Math.min(distinctSources.length, 3));
                  liveWebContext = formatSearchResultsForPrompt(rawQuery, results.slice(0, searchSources.length));
                }
              }
            }
          } catch {
            // ignore web search errors
          }
        }
      }

      const contextualPayload = trimmedPayload.map((m, idx) => {
        if (idx === trimmedPayload.length - 1 && m.role === 'user' && liveWebContext) {
          return {
            ...m,
            content: `${m.content}${liveWebContext}`,
          };
        }
        return m;
      });

      const controller = new AbortController();
      abortControllerRef.current = controller;
      isStreamingRef.current = true;
      setIsStreaming(true);
      setStreamingStage('generating');
      setStreamingContent('');

      let rawAccumulated = '';
      let streamError: string | null = null;

      try {
        if (mode === 'cloud') {
          const effectiveModel = modelId || cloudConfig.selectedModelId || 'default';
          const targetKey = findKeyForModel(cloudConfig, effectiveModel);
          if (!targetKey) {
            throw new Error('No API key linked for this model. Please link an API key in Settings > Cloud API.');
          }
          const baseSystemPrompt =
            `You are Little Sun, a calm, direct, and thoughtful AI assistant. Answer questions concisely, naturally, and accurately. When calculations, math, or equations are involved, use LaTeX ($$...$$ or $...$). When generating images or videos, provide markdown image/video links. When generating vector graphics, output clean SVG in \`\`\`svg blocks. When generating subtitles, output valid timestamps in \`\`\`srt or \`\`\`vtt blocks.\n\n${temporalContext}`;
          const fullSystemPrompt = [baseSystemPrompt, memoryContext].filter(Boolean).join('\n\n');

          await streamCloudChat({
            key: targetKey,
            modelId: effectiveModel,
            webSearch: false,
            messages: [
              {
                role: 'system',
                content: fullSystemPrompt,
              },
              ...contextualPayload.map((m) => ({
                role: m.role as 'user' | 'assistant' | 'system',
                content: m.content,
              })),
            ],
            signal: controller.signal,
            onStatus: () => {
              setStreamingStage('generating');
            },
            onToken: (tok) => {
              rawAccumulated += tok;
              setStreamingContent(rawAccumulated);
            },
          });
        } else {
          const gatewayPayload = memoryContext
            ? [{ role: 'system' as const, content: memoryContext }, ...contextualPayload]
            : contextualPayload;

          await streamGatewayChat({
            accessToken: session.accessToken,
            chatId,
            model: modelId,
            messages: gatewayPayload,
            signal: controller.signal,
            onEvent: (evt) => {
              if (evt.type === 'status') {
                if (evt.state === 'loading_model') {
                  setStreamingStage('loading_model');
                  setLaptopStatus('waking');
                } else if (evt.state === 'generating') {
                  setStreamingStage('generating');
                  setLaptopStatus('ready');
                }
              } else if (evt.type === 'token') {
                setStreamingStage('generating');
                setLaptopStatus('ready');
                rawAccumulated += evt.text;
                setStreamingContent(rawAccumulated);
              } else if (evt.type === 'error') {
                streamError = evt.message || 'Generation failed.';
              }
            },
          });
        }

        let finalClean = rawAccumulated.trim();
        if (searchSources.length > 0 && !finalClean.includes('### Sources')) {
          finalClean += `\n\n### Sources\n${searchSources.map((s) => `- [${s.title}](${s.url})`).join('\n')}`;
        }
        const finalStatus = streamError ? 'error' : 'complete';
        const finalText =
          finalClean || (streamError ? `Error: ${streamError}` : '');

        if (finalText) {
          const savedAssistant = await insertMessageRow({
            chatId,
            userId: session.user.id,
            role: 'assistant',
            content: finalText,
            status: finalStatus,
            modelId,
          });
          isStreamingRef.current = false;
          setIsStreaming(false);
          setStreamingStage('idle');
          setStreamingContent('');
          setMessages((prev) => [...prev, savedAssistant]);

          const updatedChat = await touchChatRow(session.user.id, chatId, { model_id: modelId });
          setChats((prev) =>
            [updatedChat, ...prev.filter((c) => c.id !== chatId)].sort(
              (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
            )
          );
        }
        if (mode === 'local') {
          setLaptopStatus('ready');
        }
      } catch (err) {
        const isAbort =
          controller.signal.aborted ||
          (err instanceof DOMException && err.name === 'AbortError');

        const cleanedSoFar = rawAccumulated.trim();

        if (isAbort) {
          const stoppedText = cleanedSoFar ? cleanedSoFar : '(Stopped)';
          const savedStopped = await insertMessageRow({
            chatId,
            userId: session.user.id,
            role: 'assistant',
            content: stoppedText,
            status: 'stopped',
            modelId,
          });
          isStreamingRef.current = false;
          setIsStreaming(false);
          setStreamingStage('idle');
          setStreamingContent('');
          setMessages((prev) => [...prev, savedStopped]);
          if (mode === 'local') setLaptopStatus('ready');
        } else if (err instanceof GatewayForbiddenError) {
          setIsAccessRestricted(true);
        } else if (err instanceof GatewayBusyError) {
          setLaptopStatus('busy');
          setFailedSend({
            text: '',
            error: 'Little Sun is busy, try again in a moment',
          });
        } else {
          if (cleanedSoFar) {
            const savedErr = await insertMessageRow({
              chatId,
              userId: session.user.id,
              role: 'assistant',
              content: cleanedSoFar,
              status: 'error',
              modelId,
            });
            isStreamingRef.current = false;
            setIsStreaming(false);
            setStreamingStage('idle');
            setStreamingContent('');
            setMessages((prev) => [...prev, savedErr]);
          } else {
            const message = err instanceof Error ? err.message : 'Connection failed.';
            setFailedSend((prev) => ({
              text: prev?.text || '',
              error: message,
            }));
          }
          if (mode === 'local') pollGateway();
        }
      } finally {
        isStreamingRef.current = false;
        abortControllerRef.current = null;
        setIsStreaming(false);
        setStreamingStage('idle');
        setStreamingContent('');
      }
    },
    [
      session,
      mode,
      effectiveCloudModels,
      allModels,
      cloudConfig,
      pollGateway,
      isWebSearchActive,
      isMemoryEnabled,
      memories,
      addMemory,
      removeMemory,
    ]
  );

  const sendMessage = useCallback(
    async (contentOverride?: string, attachmentsOverride?: AttachmentItem[]) => {
      if (!session || isStreamingRef.current || isAccessRestricted) return;
      const rawText = (contentOverride !== undefined ? contentOverride : composerDraft).trim();
      const attachments = attachmentsOverride || [];

      if (!rawText && attachments.length === 0) return;

      const checkUsage = computeChatContextUsage(
        messages,
        rawText,
        activeModelMeta?.contextSize || 16384,
        activeModelMeta?.maxTokens || 4096
      );

      if (checkUsage.isChatLimitReached || checkUsage.isDraftOverTurnLimit) {
        return;
      }

      const isMediaDemo =
        /media demo|preview media|image.*placeholder|video.*placeholder/i.test(rawText);

      if (!isMediaDemo) {
        if (mode === 'cloud' && cloudConfig.keys.length === 0) {
          setFailedSend({
            text: rawText,
            error: 'Please link an API key in Settings > Cloud API before sending messages.',
          });
          return;
        }

        if (mode === 'local' && laptopStatus === 'offline') {
          setFailedSend({
            text: rawText,
            error: 'Service is currently offline. Please try again in a moment.',
          });
          return;
        }
      }

      setFailedSend(null);
      setComposerDraft('');

      let fullUserMessage = rawText;
      if (attachments.length > 0) {
        const textParts: string[] = [];
        if (rawText) textParts.push(rawText);

        const imgAtts = attachments.filter((a) => a.type === 'image');
        const txtAtts = attachments.filter((a) => a.type === 'text');

        if (imgAtts.length > 0) {
          const imgMarkdown = imgAtts
            .map((img) => `![${img.name}](${img.dataUrl || ''})`)
            .join('\n\n');
          textParts.push(imgMarkdown);
        }

        if (txtAtts.length > 0) {
          const txtMarkdown = txtAtts
            .map((t) => `**Attached \`${t.name}\`:**\n\`\`\`\n${t.textContent || ''}\n\`\`\``)
            .join('\n\n');
          textParts.push(txtMarkdown);
        }

        fullUserMessage = textParts.join('\n\n');
      }

      let currentChatId = activeChatId;
      let currentMessages = messages;

      try {
        if (!currentChatId) {
          const title = makeChatTitleFromMessage(rawText || attachments[0]?.name || 'New Chat');
          const created = await createChatRow(session.user.id, title, selectedModelId);
          currentChatId = created.id;
          latestSelectedChatRef.current = created.id;
          setActiveChatId(created.id);
          const nextChats = [created, ...chats];
          setChats(nextChats);
          updateBrowserUrl(getChatRoutePath(created, nextChats));
          currentMessages = [];
        }

        const userMsg = await insertMessageRow({
          chatId: currentChatId,
          userId: session.user.id,
          role: 'user',
          content: fullUserMessage,
          status: 'complete',
          modelId: selectedModelId,
        });

        const nextMessages = [...currentMessages, userMsg];
        setMessages(nextMessages);

        const updatedChat = await touchChatRow(session.user.id, currentChatId, {
          model_id: selectedModelId,
        });
        setChats((prev) =>
          [updatedChat, ...prev.filter((c) => c.id !== currentChatId)].sort(
            (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
          )
        );

        if (isMediaDemo) {
          const demoContent = `### 🎨 AI Image Generation Output

Here is the visual media output interface. It supports high-resolution stock previews, responsive mobile scaling, tap-to-expand **Fullscreen Lightbox**, and 1-click **Download**:

![Solar Glow Artistry](https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?auto=format&fit=crop&w=1200&q=80)

---

### 🎬 AI Video Generation Output

Here is the video player interface. It plays inline with native controls on desktop and mobile without forced fullscreen, and features a 1-click **Download** action:

[Watch Cinematic Amber Horizon Video](https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4)

---

### 🎵 AI Audio Generation Output

Here is the dynamic audio player interface (e.g. Whisper, Kokoro, TTS, audio models). Features animated living waveforms, track playback controls, and 1-click **Download**:

[Acoustic Solar Atmosphere](https://interactive-examples.mdn.mozilla.net/media/cc0-audio/t-rex-roar.mp3)

---

### 📐 Vector Graphics Output (SVG)

Here is a vector graphic generated on the fly. Switch between the live rendered graphic and XML code, or click **Download .svg**:

\`\`\`svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 240" width="100%" height="240">
  <defs>
    <linearGradient id="amberGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#f59e0b" />
      <stop offset="50%" stop-color="#ea580c" />
      <stop offset="100%" stop-color="#b45309" />
    </linearGradient>
    <radialGradient id="sunGlow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#f59e0b" stop-opacity="0.45" />
      <stop offset="100%" stop-color="#ea580c" stop-opacity="0" />
    </radialGradient>
  </defs>
  <rect width="100%" height="100%" fill="#18181b" rx="16" />
  <circle cx="200" cy="120" r="85" fill="url(#sunGlow)" />
  <circle cx="200" cy="120" r="44" fill="url(#amberGrad)" />
  <circle cx="200" cy="120" r="32" fill="#fff" fill-opacity="0.18" />
  <text x="200" y="195" font-family="system-ui, sans-serif" font-size="13" font-weight="600" fill="#fef3c7" text-anchor="middle" letter-spacing="1">LITTLE SUN • VECTOR ENGINE</text>
</svg>
\`\`\`

---

### 📝 Subtitle Track Output (.SRT / .VTT)

Whisper audio transcription and subtitle file output. Displays formatted timecodes and 1-click **Download .srt**:

\`\`\`srt
1
00:00:00,000 --> 00:00:02,500
Welcome to Little Sun 1.6 API edition.

2
00:00:02,800 --> 00:00:06,200
All cloud models, web search, media, and file generation are now active.

3
00:00:06,500 --> 00:00:09,000
Enjoy seamless audio, video, subtitle, and vector graphics workflows.
\`\`\`

---

### 📄 Generated Document Output (DOCX / CSV)

Here are generated document files ready for 1-click download:

[Quarterly_Performance_Report.docx](https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf)

[Revenue_Analysis_2026.csv](https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf)
`;

          const savedAssistant = await insertMessageRow({
            chatId: currentChatId,
            userId: session.user.id,
            role: 'assistant',
            content: demoContent,
            status: 'complete',
            modelId: selectedModelId || 'media-demo',
          });
          setMessages((prev) => [...prev, savedAssistant]);
          return;
        }

        await runAssistantStream(currentChatId, nextMessages, selectedModelId);
      } catch (err) {
        setComposerDraft(rawText);
        setFailedSend({
          text: rawText,
          error: err instanceof Error ? err.message : 'Failed to send message.',
        });
      }
    },
    [
      session,
      isAccessRestricted,
      composerDraft,
      laptopStatus,
      activeChatId,
      chats,
      messages,
      selectedModelId,
      activeModelMeta,
      runAssistantStream,
      mode,
      cloudConfig,
    ]
  );

  const regenerateLastReply = useCallback(async () => {
    if (!session || !activeChatId || isStreamingRef.current || isAccessRestricted) return;
    if (mode === 'local' && laptopStatus === 'offline') return;
    if (mode === 'cloud' && cloudConfig.keys.length === 0) return;
    if (messages.length === 0) return;

    const lastMsg = messages[messages.length - 1];
    let remaining = messages;

    if (lastMsg.role === 'assistant') {
      await deleteMessageRow(session.user.id, lastMsg.id);
      remaining = messages.slice(0, -1);
      setMessages(remaining);
    }

    if (remaining.length === 0) return;
    await runAssistantStream(activeChatId, remaining, selectedModelId);
  }, [session, activeChatId, mode, cloudConfig.keys.length, laptopStatus, isAccessRestricted, messages, selectedModelId, runAssistantStream]);

  const clearFailedSendError = useCallback(() => {
    setFailedSend(null);
  }, []);

  const value = useMemo<AppStateContextValue>(
    () => ({
      session,
      authLoading,
      userDisplayName,
      setUserDisplayName,
      chats,
      activeChatId,
      messages,
      contextUsage,
      models,
      allModels,
      selectedModelId,
      laptopStatus,
      mode,
      setMode,
      cloudConfig,
      addCloudApiKey,
      unlinkCloudApiKey,
      refreshCloudApiKeyModels,
      cloudStatus,
      isAccessRestricted,
      isStreaming,
      streamingStage,
      streamingContent,
      composerDraft,
      failedSend,
      isSidebarOpen,
      isDesktopSidebarCollapsed,
      isSettingsOpen,
      isShortcutsOpen,
      settingsSection,
      isWebSearchActive,
      searchCooldown,
      toggleWebSearch,
      setIsWebSearchActive,
      setIsShortcutsOpen,
      setComposerDraft,
      setSelectedModelId,
      setIsSidebarOpen,
      toggleDesktopSidebar,
      setIsSettingsOpen,
      openSettingsSection,
      signIn,
      signOut,
      selectChat,
      startNewChat,
      continueInNewChat,
      renameChat,
      deleteChat,
      sendMessage,
      stopGenerating,
      regenerateLastReply,
      clearFailedSendError,
      refreshGateway: pollGateway,
      customGatewayUrl,
      detectedFunnelUrl,
      activeGatewayEndpoint,
      updateGatewayUrl,
      testGatewayConnection,
      memories,
      isMemoryEnabled,
      setIsMemoryEnabled,
      addMemory,
      removeMemory,
      clearMemories,
      memoryNotification,
      clearMemoryNotification,
    }),
    [
      session,
      authLoading,
      userDisplayName,
      setUserDisplayName,
      chats,
      activeChatId,
      messages,
      contextUsage,
      models,
      allModels,
      selectedModelId,
      laptopStatus,
      mode,
      setMode,
      cloudConfig,
      addCloudApiKey,
      unlinkCloudApiKey,
      refreshCloudApiKeyModels,
      cloudStatus,
      isAccessRestricted,
      isStreaming,
      streamingStage,
      streamingContent,
      composerDraft,
      failedSend,
      isSidebarOpen,
      isDesktopSidebarCollapsed,
      isSettingsOpen,
      isShortcutsOpen,
      settingsSection,
      isWebSearchActive,
      searchCooldown,
      toggleWebSearch,
      setIsShortcutsOpen,
      toggleDesktopSidebar,
      setIsSettingsOpen,
      openSettingsSection,
      signIn,
      signOut,
      selectChat,
      startNewChat,
      continueInNewChat,
      renameChat,
      deleteChat,
      sendMessage,
      stopGenerating,
      regenerateLastReply,
      clearFailedSendError,
      pollGateway,
      customGatewayUrl,
      detectedFunnelUrl,
      activeGatewayEndpoint,
      updateGatewayUrl,
      testGatewayConnection,
      memories,
      isMemoryEnabled,
      setIsMemoryEnabled,
      addMemory,
      removeMemory,
      clearMemories,
      memoryNotification,
      clearMemoryNotification,
    ]
  );

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
};

export function useAppState(): AppStateContextValue {
  const ctx = useContext(AppStateContext);
  if (!ctx) {
    throw new Error('useAppState must be used within AppStateProvider');
  }
  return ctx;
}
