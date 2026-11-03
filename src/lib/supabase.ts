import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export interface UserPreferencesMeta {
  display_name?: string;
  tts_voice?: string;
  tts_speed?: number;
  default_model_id?: string;
  gateway_url?: string;
  memory_enabled?: boolean;
  memories?: any[];
}

export interface UserSession {
  user: {
    id: string;
    email: string;
    metadata?: UserPreferencesMeta;
  };
  accessToken: string;
}

export interface ChatRow {
  id: string;
  user_id: string;
  title: string;
  model_id: string | null;
  created_at: string;
  updated_at: string;
}

export type MessageStatus = 'complete' | 'stopped' | 'error';

export interface MessageRow {
  id: string;
  chat_id: string;
  user_id: string;
  role: 'user' | 'assistant';
  content: string;
  status: MessageStatus;
  model_id: string | null;
  created_at: string;
}

export function generateUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    try {
      return crypto.randomUUID();
    } catch {
      // fallback
    }
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

const envSupabaseUrl = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL ? import.meta.env.VITE_SUPABASE_URL : '').trim();
const envSupabaseAnonKey = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_ANON_KEY ? import.meta.env.VITE_SUPABASE_ANON_KEY : '').trim();

const STORAGE_SUPABASE_URL_KEY = 'littlesun_supabase_url';
const STORAGE_SUPABASE_KEY_KEY = 'littlesun_supabase_key';

export function getEffectiveSupabaseUrl(): string {
  if (typeof localStorage !== 'undefined') {
    const custom = localStorage.getItem(STORAGE_SUPABASE_URL_KEY);
    if (custom && custom.trim() && !custom.includes('<project-ref>')) {
      return custom.trim().replace(/\/+$/, '');
    }
  }
  return envSupabaseUrl && !envSupabaseUrl.includes('<project-ref>') ? envSupabaseUrl : '';
}

export function getEffectiveSupabaseAnonKey(): string {
  if (typeof localStorage !== 'undefined') {
    const custom = localStorage.getItem(STORAGE_SUPABASE_KEY_KEY);
    if (custom && custom.trim() && custom !== 'your-supabase-anon-key') {
      return custom.trim();
    }
  }
  return envSupabaseAnonKey && envSupabaseAnonKey !== 'your-supabase-anon-key'
    ? envSupabaseAnonKey
    : '';
}

export function setCustomSupabaseCredentials(url: string, key: string): void {
  if (typeof localStorage !== 'undefined') {
    if (url.trim()) {
      localStorage.setItem(STORAGE_SUPABASE_URL_KEY, url.trim().replace(/\/+$/, ''));
    }
    if (key.trim()) {
      localStorage.setItem(STORAGE_SUPABASE_KEY_KEY, key.trim());
    }
  }
}

const activeUrl = getEffectiveSupabaseUrl();
const activeKey = getEffectiveSupabaseAnonKey();

export const isSupabaseConfigured = Boolean(activeUrl && activeKey);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(activeUrl, activeKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    })
  : null;

// --- Local Preview Fallback (used only when VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are not set) ---
const LOCAL_SESSION_KEY = 'littlesun_session_v1';
const LOCAL_CHATS_KEY = 'littlesun_chats_v1';
const LOCAL_MESSAGES_KEY = 'littlesun_messages_v1';

const authListeners = new Set<(session: UserSession | null) => void>();

function notifyAuthListeners(session: UserSession | null) {
  authListeners.forEach((cb) => cb(session));
}

function getLocalChats(): ChatRow[] {
  try {
    const raw = localStorage.getItem(LOCAL_CHATS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore
  }
  return [];
}

function saveLocalChats(chats: ChatRow[]) {
  try {
    localStorage.setItem(LOCAL_CHATS_KEY, JSON.stringify(chats));
  } catch {
    // ignore
  }
}

function getLocalMessages(): MessageRow[] {
  getLocalChats(); // ensure seeded
  try {
    const raw = localStorage.getItem(LOCAL_MESSAGES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalMessages(messages: MessageRow[]) {
  try {
    localStorage.setItem(LOCAL_MESSAGES_KEY, JSON.stringify(messages));
  } catch {
    // ignore
  }
}

export async function getCurrentSession(): Promise<UserSession | null> {
  if (supabase) {
    const { data } = await supabase.auth.getSession();
    const s = data.session;
    if (!s?.user) return null;
    return {
      user: {
        id: s.user.id,
        email: s.user.email || '',
        metadata: (s.user.user_metadata || {}) as UserPreferencesMeta,
      },
      accessToken: s.access_token,
    };
  }

  try {
    const raw = localStorage.getItem(LOCAL_SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function subscribeToAuth(callback: (session: UserSession | null) => void): () => void {
  if (supabase) {
    const { data } = supabase.auth.onAuthStateChange((_event, s) => {
      if (!s?.user) {
        callback(null);
      } else {
        callback({
          user: {
            id: s.user.id,
            email: s.user.email || '',
            metadata: (s.user.user_metadata || {}) as UserPreferencesMeta,
          },
          accessToken: s.access_token,
        });
      }
    });
    return () => data.subscription.unsubscribe();
  }

  authListeners.add(callback);
  return () => {
    authListeners.delete(callback);
  };
}

export async function signInWithEmail(email: string, password: string): Promise<UserSession> {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail || !password) {
    throw new Error('Please enter your email and password.');
  }

  if (supabase) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });
    if (error || !data.session?.user) {
      throw new Error(error?.message || 'Invalid login credentials.');
    }
    return {
      user: {
        id: data.session.user.id,
        email: data.session.user.email || normalizedEmail,
        metadata: (data.session.user.user_metadata || {}) as UserPreferencesMeta,
      },
      accessToken: data.session.access_token,
    };
  }

  // Local offline preview fallback when VITE_SUPABASE_URL is not configured
  if (password.length < 4) {
    throw new Error('Invalid login credentials. Access is by invitation.');
  }

  const localUserId = `local-${normalizedEmail.replace(/[^a-z0-9]/g, '-')}`;
  const defaultDisplayName = normalizedEmail.split('@')[0] || 'User';
  const session: UserSession = {
    user: {
      id: localUserId,
      email: normalizedEmail,
      metadata: {
        display_name: defaultDisplayName.charAt(0).toUpperCase() + defaultDisplayName.slice(1),
      },
    },
    accessToken: `preview-jwt-${localUserId}`,
  };
  localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify(session));
  notifyAuthListeners(session);
  return session;
}

export async function syncUserPreferences(prefs: UserPreferencesMeta): Promise<void> {
  if (!supabase) return;
  try {
    await supabase.auth.updateUser({
      data: prefs,
    });
  } catch {
    // non-fatal if offline
  }
}

export async function signOutUser(): Promise<void> {
  if (supabase) {
    await supabase.auth.signOut();
    return;
  }
  localStorage.removeItem(LOCAL_SESSION_KEY);
  notifyAuthListeners(null);
}

/**
 * Generates chat title from the first 40 characters of the first user message (section 5.4)
 */
export function makeChatTitleFromMessage(content: string): string {
  const cleaned = content.replace(/\s+/g, ' ').trim();
  if (!cleaned) return 'New chat';
  return cleaned.slice(0, 40);
}

export async function fetchChats(userId: string): Promise<ChatRow[]> {
  if (supabase) {
    const { data, error } = await supabase
      .from('chats')
      .select('*')
      .order('updated_at', { ascending: false });
    if (error) throw new Error(error.message);
    return (data || []) as ChatRow[];
  }

  return getLocalChats()
    .filter((c) => c.user_id === userId)
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
}

export async function createChatRow(
  userId: string,
  title: string,
  modelId: string | null
): Promise<ChatRow> {
  const safeTitle = title.trim() || 'New chat';
  if (supabase) {
    const { data, error } = await supabase
      .from('chats')
      .insert({
        user_id: userId,
        title: safeTitle,
        model_id: modelId,
      })
      .select('*')
      .single();
    if (error || !data) throw new Error(error?.message || 'Failed to create chat');
    return data as ChatRow;
  }

  const now = new Date().toISOString();
  const row: ChatRow = {
    id: generateUUID(),
    user_id: userId,
    title: safeTitle,
    model_id: modelId,
    created_at: now,
    updated_at: now,
  };
  const chats = getLocalChats();
  chats.unshift(row);
  saveLocalChats(chats);
  return row;
}

export async function renameChatRow(
  userId: string,
  chatId: string,
  newTitle: string
): Promise<ChatRow> {
  const safeTitle = newTitle.trim() || 'New chat';
  if (supabase) {
    const { data, error } = await supabase
      .from('chats')
      .update({ title: safeTitle })
      .eq('id', chatId)
      .eq('user_id', userId)
      .select('*')
      .single();
    if (error || !data) throw new Error(error?.message || 'Failed to rename chat');
    return data as ChatRow;
  }

  const chats = getLocalChats();
  const idx = chats.findIndex((c) => c.id === chatId && c.user_id === userId);
  if (idx === -1) throw new Error('Chat not found');
  chats[idx] = { ...chats[idx], title: safeTitle };
  saveLocalChats(chats);
  return chats[idx];
}

export async function touchChatRow(
  userId: string,
  chatId: string,
  updates?: { title?: string; model_id?: string | null }
): Promise<ChatRow> {
  const now = new Date().toISOString();
  if (supabase) {
    const payload: Record<string, unknown> = { updated_at: now };
    if (updates?.title !== undefined) payload.title = updates.title;
    if (updates?.model_id !== undefined) payload.model_id = updates.model_id;

    const { data, error } = await supabase
      .from('chats')
      .update(payload)
      .eq('id', chatId)
      .eq('user_id', userId)
      .select('*')
      .single();
    if (error || !data) throw new Error(error?.message || 'Failed to update chat');
    return data as ChatRow;
  }

  const chats = getLocalChats();
  const idx = chats.findIndex((c) => c.id === chatId && c.user_id === userId);
  if (idx === -1) throw new Error('Chat not found');
  chats[idx] = {
    ...chats[idx],
    ...(updates?.title !== undefined ? { title: updates.title } : {}),
    ...(updates?.model_id !== undefined ? { model_id: updates.model_id } : {}),
    updated_at: now,
  };
  saveLocalChats(chats);
  return chats[idx];
}

export async function deleteChatRow(userId: string, chatId: string): Promise<void> {
  if (supabase) {
    const { error } = await supabase
      .from('chats')
      .delete()
      .eq('id', chatId)
      .eq('user_id', userId);
    if (error) throw new Error(error.message);
    return;
  }

  const chats = getLocalChats().filter((c) => !(c.id === chatId && c.user_id === userId));
  saveLocalChats(chats);
  const messages = getLocalMessages().filter((m) => !(m.chat_id === chatId && m.user_id === userId));
  saveLocalMessages(messages);
}

export async function fetchMessages(userId: string, chatId: string): Promise<MessageRow[]> {
  if (supabase) {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('chat_id', chatId)
      .order('created_at', { ascending: true });
    if (error) throw new Error(error.message);
    return (data || []) as MessageRow[];
  }

  return getLocalMessages()
    .filter((m) => m.chat_id === chatId && m.user_id === userId)
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
}

export async function insertMessageRow(params: {
  chatId: string;
  userId: string;
  role: 'user' | 'assistant';
  content: string;
  status?: MessageStatus;
  modelId?: string | null;
}): Promise<MessageRow> {
  const { chatId, userId, role, content, status = 'complete', modelId = null } = params;

  if (supabase) {
    const { data, error } = await supabase
      .from('messages')
      .insert({
        chat_id: chatId,
        user_id: userId,
        role,
        content,
        status,
        model_id: modelId,
      })
      .select('*')
      .single();
    if (error || !data) throw new Error(error?.message || 'Failed to save message');
    return data as MessageRow;
  }

  const now = new Date().toISOString();
  const row: MessageRow = {
    id: generateUUID(),
    chat_id: chatId,
    user_id: userId,
    role,
    content,
    status,
    model_id: modelId,
    created_at: now,
  };
  const messages = getLocalMessages();
  messages.push(row);
  saveLocalMessages(messages);
  return row;
}

export async function deleteMessageRow(userId: string, messageId: string): Promise<void> {
  if (supabase) {
    const { error } = await supabase
      .from('messages')
      .delete()
      .eq('id', messageId)
      .eq('user_id', userId);
    if (error) throw new Error(error.message);
    return;
  }

  const messages = getLocalMessages().filter((m) => !(m.id === messageId && m.user_id === userId));
  saveLocalMessages(messages);
}

/**
 * Subscribes to Supabase Realtime postgres_changes (and cross-tab storage events)
 * so chats and messages stay synchronized across devices and browser tabs.
 */
export function subscribeToRealtimeSync(
  userId: string,
  onSyncNeeded: (scope: 'chats' | 'messages' | 'memories', targetId?: string) => void
): () => void {
  const cleanups: Array<() => void> = [];

  if (supabase) {
    const channel = supabase
      .channel(`littlesun-sync-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'chats',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          onSyncNeeded('chats');
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const changedChatId =
            (payload.new && typeof (payload.new as { chat_id?: string }).chat_id === 'string'
              ? (payload.new as { chat_id: string }).chat_id
              : undefined) ||
            (payload.old && typeof (payload.old as { chat_id?: string }).chat_id === 'string'
              ? (payload.old as { chat_id: string }).chat_id
              : undefined);
          onSyncNeeded('messages', changedChatId);
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'memories',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          onSyncNeeded('memories');
        }
      )
      .subscribe();

    cleanups.push(() => {
      void supabase.removeChannel(channel);
    });
  }

  if (typeof window !== 'undefined') {
    const onStorage = (e: StorageEvent) => {
      if (e.key === LOCAL_CHATS_KEY) {
        onSyncNeeded('chats');
      } else if (e.key === LOCAL_MESSAGES_KEY) {
        onSyncNeeded('messages');
      } else if (e.key === 'littlesun_memories_v1') {
        onSyncNeeded('memories');
      }
    };
    window.addEventListener('storage', onStorage);
    cleanups.push(() => window.removeEventListener('storage', onStorage));
  }

  return () => {
    for (const fn of cleanups) fn();
  };
}

/**
 * Upload an ephemeral file to Supabase Storage (bucket: 'chat-uploads') with a 1-hour expiration timestamp.
 * Automatically falls back to a locally encoded Data URL if Supabase storage bucket is not configured.
 */
export async function uploadEphemeralFile(
  userId: string,
  file: File
): Promise<{ url: string; expiresAt: number; path: string }> {
  const expiresAt = Date.now() + 60 * 60 * 1000; // Strictly 1 hour from upload
  const cleanName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
  const path = `${userId}/${Date.now()}_${cleanName}`;

  if (supabase) {
    try {
      const { data, error } = await supabase.storage
        .from('chat-uploads')
        .upload(path, file, {
          cacheControl: '3600',
          upsert: true,
        });

      if (!error && data) {
        const { data: publicUrlData } = supabase.storage
          .from('chat-uploads')
          .getPublicUrl(path);

        const urlWithExp = `${publicUrlData.publicUrl}?exp=${expiresAt}`;
        return {
          url: urlWithExp,
          expiresAt,
          path,
        };
      }
    } catch {
      // Continue to local fallback
    }
  }

  // Graceful local fallback for offline development / non-storage mode
  const dataUrl = await new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => resolve('');
    reader.readAsDataURL(file);
  });

  const urlWithExp = `${dataUrl}#exp=${expiresAt}`;
  return {
    url: urlWithExp,
    expiresAt,
    path,
  };
}


