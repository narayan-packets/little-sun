import { supabase, generateUUID, type UserPreferencesMeta, syncUserPreferences } from './supabase';

export interface MemoryItem {
  id: string;
  user_id?: string;
  content: string;
  category?: 'preference' | 'fact' | 'instruction' | 'general';
  created_at: string;
  updated_at?: string;
}

export const MAX_MEMORIES = 60;
export const MAX_MEMORY_CHARS = 280;

const LOCAL_MEMORIES_KEY = 'littlesun_memories_v1';
const MEMORY_ENABLED_KEY = 'littlesun_memory_enabled_v1';

export function getIsMemoryEnabled(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    const stored = localStorage.getItem(MEMORY_ENABLED_KEY);
    return stored === null ? true : stored === 'true';
  } catch {
    return true;
  }
}

export function setIsMemoryEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(MEMORY_ENABLED_KEY, String(enabled));
  } catch {
    // ignore
  }
}

export function getLocalMemories(): MemoryItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_MEMORIES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveLocalMemories(memories: MemoryItem[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LOCAL_MEMORIES_KEY, JSON.stringify(memories.slice(0, MAX_MEMORIES)));
  } catch {
    // ignore
  }
}

/**
 * Extracts explicit memory directive from user messages.
 * Matches:
 * - "Remember that I prefer dark mode"
 * - "Please remember: my dog is Charlie"
 * - "Keep in mind that I work as a designer"
 * - "Don't forget that I live in Tokyo"
 */
export function extractExplicitMemory(text: string): string | null {
  const clean = text.trim();
  const patterns = [
    /^(?:please\s+)?(?:remember|keep\s+in\s+mind|never\s+forget|don'?t\s+forget)\s*(?:that|this:|:)?\s+(.+)$/i,
    /(?:^|\.\s+)(?:please\s+)?(?:remember|keep\s+in\s+mind|never\s+forget|don'?t\s+forget)\s*(?:that|this:|:)?\s+([^.!?\n]+)/i,
    /^(?:take\s+note\s+that|note\s+that)\s+(.+)$/i,
  ];

  for (const pat of patterns) {
    const m = clean.match(pat);
    if (m && m[1]) {
      let fact = m[1].trim().replace(/^['"]+|['"]+$/g, '').replace(/[.!?]+$/, '');
      if (fact.length >= 4 && fact.length <= MAX_MEMORY_CHARS) {
        fact = fact
          .replace(/\bI\s+am\b/gi, 'User is')
          .replace(/\bI\s+have\b/gi, 'User has')
          .replace(/\bI\s+prefer\b/gi, 'User prefers')
          .replace(/\bI\s+use\b/gi, 'User uses')
          .replace(/\bI\s+like\b/gi, 'User likes')
          .replace(/\bI\s+work\s+as\b/gi, 'User works as')
          .replace(/\bI\s+live\s+in\b/gi, 'User lives in')
          .replace(/\bmy\s+name\s+is\b/gi, "User's name is")
          .replace(/\bmy\b/gi, "User's")
          .replace(/\bme\b/gi, 'User');
        return fact.charAt(0).toUpperCase() + fact.slice(1);
      }
    }
  }
  return null;
}

/**
 * Extracts memory deletion/forget directive from user messages.
 * Matches:
 * - "Forget that I live in Tokyo"
 * - "Delete memory about Charlie"
 * - "Don't remember my location"
 */
export function extractForgetMemoryQuery(text: string): string | null {
  const clean = text.trim();
  const patterns = [
    /^(?:please\s+)?(?:forget|delete\s+memory|remove\s+memory)\s*(?:that|about|this:)?\s+(.+)$/i,
    /^(?:don'?t\s+remember|stop\s+remembering)\s+(.+)$/i,
  ];
  for (const pat of patterns) {
    const m = clean.match(pat);
    if (m && m[1]) {
      const q = m[1].trim().replace(/^['"]+|['"]+$/g, '').replace(/[.!?]+$/, '');
      if (q.length >= 3) {
        return q.toLowerCase();
      }
    }
  }
  return null;
}

/**
 * Categorizes a memory item based on keywords.
 */
export function categorizeMemory(content: string): 'preference' | 'fact' | 'instruction' | 'general' {
  const lower = content.toLowerCase();
  if (lower.includes('prefer') || lower.includes('like') || lower.includes('favorite') || lower.includes('style')) {
    return 'preference';
  }
  if (lower.includes('never') || lower.includes('always') || lower.includes('do not') || lower.includes('format')) {
    return 'instruction';
  }
  if (lower.includes('name') || lower.includes('live') || lower.includes('work') || lower.includes('os') || lower.includes('device') || lower.includes('project')) {
    return 'fact';
  }
  return 'general';
}

/**
 * Formats memories into a tightly budgeted prompt block for LLMs (Local and Cloud).
 */
export function formatMemoriesForPrompt(memories: MemoryItem[], maxItems = 30): string {
  if (!memories || memories.length === 0) return '';
  const items = memories.slice(0, maxItems);
  const lines = items.map((m) => `- ${m.content}`);
  return `[User Memory & Preferences]:\n${lines.join('\n')}\n(Directive: Naturally respect and integrate the user's personal context and preferences above without explicitly reciting this list unless asked.)`;
}

// Track whether public.memories table is available in Supabase
let isTableAvailable: boolean | null = null;

export async function fetchMemories(userId: string): Promise<MemoryItem[]> {
  if (supabase && isTableAvailable !== false) {
    try {
      const { data, error } = await supabase
        .from('memories')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(MAX_MEMORIES);

      if (!error && Array.isArray(data)) {
        isTableAvailable = true;
        saveLocalMemories(data as MemoryItem[]);
        return data as MemoryItem[];
      }
      if (error && (error.code === '42P01' || error.message?.includes('does not exist'))) {
        isTableAvailable = false;
      }
    } catch {
      // Continue to local / metadata fallback
    }
  }

  // Graceful fallback: local storage
  return getLocalMemories();
}

export async function insertMemoryRow(
  userId: string,
  content: string,
  category?: 'preference' | 'fact' | 'instruction' | 'general'
): Promise<MemoryItem> {
  const trimmed = content.trim().slice(0, MAX_MEMORY_CHARS);
  const cat = category || categorizeMemory(trimmed);
  const now = new Date().toISOString();

  const newRow: MemoryItem = {
    id: generateUUID(),
    user_id: userId,
    content: trimmed,
    category: cat,
    created_at: now,
    updated_at: now,
  };

  if (supabase && isTableAvailable !== false) {
    try {
      const { data, error } = await supabase
        .from('memories')
        .insert({
          id: newRow.id,
          user_id: userId,
          content: trimmed,
          category: cat,
        })
        .select('*')
        .single();

      if (!error && data) {
        isTableAvailable = true;
        const current = getLocalMemories();
        const updated = [data as MemoryItem, ...current.filter((m) => m.id !== data.id)].slice(0, MAX_MEMORIES);
        saveLocalMemories(updated);
        return data as MemoryItem;
      }
      if (error && (error.code === '42P01' || error.message?.includes('does not exist'))) {
        isTableAvailable = false;
      }
    } catch {
      // Fallback
    }
  }

  const current = getLocalMemories();
  const updated = [newRow, ...current.filter((m) => m.content.toLowerCase() !== trimmed.toLowerCase())].slice(0, MAX_MEMORIES);
  saveLocalMemories(updated);

  // Sync to user_metadata as fallback
  if (supabase) {
    void syncUserPreferences({ memories: updated } as UserPreferencesMeta);
  }

  return newRow;
}

export async function deleteMemoryRow(userId: string, memoryId: string): Promise<void> {
  if (supabase && isTableAvailable !== false) {
    try {
      const { error } = await supabase
        .from('memories')
        .delete()
        .eq('id', memoryId)
        .eq('user_id', userId);

      if (!error) {
        const current = getLocalMemories().filter((m) => m.id !== memoryId);
        saveLocalMemories(current);
        return;
      }
      if (error && (error.code === '42P01' || error.message?.includes('does not exist'))) {
        isTableAvailable = false;
      }
    } catch {
      // Fallback
    }
  }

  const current = getLocalMemories().filter((m) => m.id !== memoryId);
  saveLocalMemories(current);

  if (supabase) {
    void syncUserPreferences({ memories: current } as UserPreferencesMeta);
  }
}

export async function clearAllMemoriesRows(userId: string): Promise<void> {
  if (supabase && isTableAvailable !== false) {
    try {
      const { error } = await supabase
        .from('memories')
        .delete()
        .eq('user_id', userId);

      if (!error) {
        saveLocalMemories([]);
        return;
      }
      if (error && (error.code === '42P01' || error.message?.includes('does not exist'))) {
        isTableAvailable = false;
      }
    } catch {
      // Fallback
    }
  }

  saveLocalMemories([]);

  if (supabase) {
    void syncUserPreferences({ memories: [] } as UserPreferencesMeta);
  }
}
