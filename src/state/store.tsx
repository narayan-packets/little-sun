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
} from '../lib/supabase';
import {
  checkGatewayHealth,
  fetchGatewayModels,
  fetchGatewayStatus,
  GatewayBusyError,
  GatewayForbiddenError,
  type GatewayModel,
  notifyGatewayChatSwitch,
  sanitizeBackendModels,
  streamGatewayChat,
} from '../lib/gateway';
import {
  type ChatContextUsage,
  computeChatContextUsage,
  trimMessagesForContext,
} from '../lib/tokens';
import { POCKET_VOICES, type PocketVoiceId, setSavedSpeed, setSavedVoice, ttsController } from '../lib/tts';
import { isMathPrompt, sanitizeMessageListForMath, stripHallucinatedMath } from '../lib/markdown';

export type LaptopUiStatus = 'offline' | 'sleeping' | 'waking' | 'ready' | 'busy';
export type SettingsRouteSection = 'index' | 'account' | 'voices';

function parseSettingsSectionFromPath(pathname: string): SettingsRouteSection | null {
  const clean = pathname.replace(/\/+$/, '').toLowerCase();
  if (clean === '/settings') {
    return 'index';
  }
  if (clean === '/account' || clean === '/settings/account') {
    return 'account';
  }
  if (clean === '/voices' || clean === '/settings/voices') {
    return 'voices';
  }
  return null;
}

function getPathForSettingsSection(section: SettingsRouteSection): string {
  if (section === 'account') return '/account';
  if (section === 'voices') return '/voices';
  return '/settings';
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
  isAccessRestricted: boolean;
  isStreaming: boolean;
  streamingStage: 'idle' | 'loading_model' | 'generating';
  streamingContent: string;
  composerDraft: string;
  failedSend: FailedSendState | null;
  isSidebarOpen: boolean;
  isDesktopSidebarCollapsed: boolean;
  isSettingsOpen: boolean;
  settingsSection: SettingsRouteSection;
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
  sendMessage: (contentOverride?: string) => Promise<void>;
  stopGenerating: () => void;
  regenerateLastReply: () => Promise<void>;
  clearFailedSendError: () => void;
  refreshGateway: () => Promise<void>;
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

  const [allModels, setAllModels] = useState<GatewayModel[]>([]);

  // Listed models (enabled by user)
  const models = useMemo(() => {
    const enabledList = allModels.filter((m) => m.enabled !== false);
    return enabledList.length > 0 ? enabledList : allModels;
  }, [allModels]);

  const [selectedModelId, setSelectedModelId] = useState<string>('');

  const [laptopStatus, setLaptopStatus] = useState<LaptopUiStatus>('sleeping');
  const [isAccessRestricted, setIsAccessRestricted] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingStage, setStreamingStage] = useState<'idle' | 'loading_model' | 'generating'>('idle');
  const [streamingContent, setStreamingContent] = useState('');

  const [composerDraft, setComposerDraft] = useState('');
  const [failedSend, setFailedSend] = useState<FailedSendState | null>(null);

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [settingsSection, setSettingsSectionState] = useState<SettingsRouteSection>(() => {
    if (typeof window !== 'undefined') {
      return parseSettingsSectionFromPath(window.location.pathname) || 'index';
    }
    return 'index';
  });
  const [isSettingsOpen, setIsSettingsOpenState] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return parseSettingsSectionFromPath(window.location.pathname) !== null;
    }
    return false;
  });

  const abortControllerRef = useRef<AbortController | null>(null);
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
        setSettingsSectionState('index');
        updateBrowserUrl('/settings');
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
  }, []);

  // Initialize auth session
  useEffect(() => {
    let mounted = true;
    getCurrentSession()
      .then((s) => {
        if (mounted) {
          setSession(s);
          hydrateSessionPreferences(s);
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
          initialRouteResolvedRef.current = false;
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

    const unsubscribeRealtime = subscribeToRealtimeSync(userId, (scope, changedChatId) => {
      void syncChatsList();
      if (scope === 'messages') {
        void syncActiveMessages(changedChatId);
      }
    });

    const onFocusSync = () => {
      if (document.visibilityState === 'visible') {
        void syncChatsList();
        void syncActiveMessages();
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
      if (settingsSection === 'account') {
        document.title = 'Account · Little Sun';
      } else if (settingsSection === 'voices') {
        document.title = 'Voices · Little Sun';
      } else {
        document.title = 'Settings · Little Sun';
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
          setSelectedModelId((prev) => {
            if (pool.some((m) => m.id === prev && m.available)) return prev;
            return def.id;
          });
        } else {
          setSelectedModelId('');
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
    if (session) {
      void notifyGatewayChatSwitch(session.accessToken, null, 'sleep');
    }
    updateBrowserUrl('/newchat');
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

  // Desktop keyboard shortcut: Ctrl/Cmd + Shift + O (or Ctrl/Cmd + K) to spawn a new chat instance
  useEffect(() => {
    if (typeof window === 'undefined' || !session) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMod = e.metaKey || e.ctrlKey;
      if (!isMod) return;
      const key = e.key.toLowerCase();
      if ((e.shiftKey && key === 'o') || (!e.shiftKey && key === 'k')) {
        e.preventDefault();
        startNewChat();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [session, startNewChat]);

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

  const activeModelMeta = useMemo(
    () => allModels.find((m) => m.id === selectedModelId) || allModels[0],
    [allModels, selectedModelId]
  );

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

      const modelMeta = allModels.find((m) => m.id === modelId);
      const cleanedHistory = sanitizeMessageListForMath(
        historyForContext.map((m) => ({ role: m.role, content: m.content }))
      );
      const lastUserContent =
        [...cleanedHistory].reverse().find((m) => m.role === 'user')?.content || '';
      const allowMath = isMathPrompt(lastUserContent);

      const trimmedPayload = trimMessagesForContext(
        cleanedHistory,
        modelMeta?.contextSize || 16384,
        modelMeta?.maxTokens || 4096
      );

      const controller = new AbortController();
      abortControllerRef.current = controller;
      isStreamingRef.current = true;
      setIsStreaming(true);
      setStreamingStage('generating');
      setStreamingContent('');

      let rawAccumulated = '';
      let accumulated = '';
      let streamError: string | null = null;

      try {
        await streamGatewayChat({
          accessToken: session.accessToken,
          chatId,
          model: modelId,
          messages: trimmedPayload,
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

        const finalClean = rawAccumulated.trim();
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
        setLaptopStatus('ready');
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
          setLaptopStatus('ready');
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
          pollGateway();
        }
      } finally {
        isStreamingRef.current = false;
        abortControllerRef.current = null;
        setIsStreaming(false);
        setStreamingStage('idle');
        setStreamingContent('');
      }
    },
    [session, allModels, pollGateway]
  );

  const sendMessage = useCallback(
    async (contentOverride?: string) => {
      if (!session || isStreamingRef.current || isAccessRestricted) return;
      const rawText = (contentOverride !== undefined ? contentOverride : composerDraft).trim();
      if (!rawText) return;

      const checkUsage = computeChatContextUsage(
        messages,
        rawText,
        activeModelMeta?.contextSize || 16384,
        activeModelMeta?.maxTokens || 4096
      );

      if (checkUsage.isChatLimitReached || checkUsage.isDraftOverTurnLimit) {
        return;
      }

      if (laptopStatus === 'offline') {
        setFailedSend({
          text: rawText,
          error: 'Service is currently offline. Please try again in a moment.',
        });
        return;
      }

      setFailedSend(null);
      setComposerDraft('');

      let currentChatId = activeChatId;
      let currentMessages = messages;

      try {
        if (!currentChatId) {
          const title = makeChatTitleFromMessage(rawText);
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
          content: rawText,
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

        await runAssistantStream(currentChatId, nextMessages, selectedModelId);
      } catch (err) {
        setComposerDraft(rawText);
        setFailedSend({
          text: rawText,
          error: err instanceof Error ? err.message : 'Failed to send message.',
        });
      }
    },
    [session, isAccessRestricted, composerDraft, laptopStatus, activeChatId, chats, messages, selectedModelId, activeModelMeta, runAssistantStream]
  );

  const regenerateLastReply = useCallback(async () => {
    if (!session || !activeChatId || isStreamingRef.current || laptopStatus === 'offline' || isAccessRestricted) return;
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
  }, [session, activeChatId, laptopStatus, isAccessRestricted, messages, selectedModelId, runAssistantStream]);

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
      isAccessRestricted,
      isStreaming,
      streamingStage,
      streamingContent,
      composerDraft,
      failedSend,
      isSidebarOpen,
      isDesktopSidebarCollapsed,
      isSettingsOpen,
      settingsSection,
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
      isAccessRestricted,
      isStreaming,
      streamingStage,
      streamingContent,
      composerDraft,
      failedSend,
      isSidebarOpen,
      isDesktopSidebarCollapsed,
      isSettingsOpen,
      settingsSection,
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
