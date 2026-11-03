import { generateUUID } from './supabase';

export type CloudProviderId =
  | 'openrouter'
  | 'groq'
  | 'grok'
  | 'huggingface'
  | 'openai'
  | 'custom';

export interface CloudProviderInfo {
  id: CloudProviderId;
  name: string;
  defaultBaseUrl: string;
  placeholderKey: string;
  defaultModels: CloudModel[];
}

export interface CloudModel {
  id: string;
  name: string;
  provider: CloudProviderId;
  contextSize?: number;
  available?: boolean;
}

export interface SavedApiKey {
  id: string;
  provider: CloudProviderId;
  label: string;
  apiKey: string;
  baseUrl: string;
  addedAt: string;
  models: CloudModel[];
}

export interface CloudConfig {
  keys: SavedApiKey[]; // Maximum 5
  selectedModelId: string;
}

export const MAX_API_KEYS = 5;

export const CLOUD_PROVIDERS: Record<CloudProviderId, CloudProviderInfo> = {
  openrouter: {
    id: 'openrouter',
    name: 'OpenRouter',
    defaultBaseUrl: 'https://openrouter.ai/api/v1',
    placeholderKey: 'sk-or-v1-...',
    defaultModels: [
      { id: 'meta-llama/llama-3.3-70b-instruct', name: 'Llama 3.3 70B Instruct', provider: 'openrouter', contextSize: 131072 },
      { id: 'deepseek/deepseek-chat', name: 'DeepSeek V3', provider: 'openrouter', contextSize: 64000 },
      { id: 'qwen/qwen-2.5-72b-instruct', name: 'Qwen 2.5 72B Instruct', provider: 'openrouter', contextSize: 131072 },
      { id: 'anthropic/claude-3.5-haiku', name: 'Claude 3.5 Haiku', provider: 'openrouter', contextSize: 200000 },
    ],
  },
  groq: {
    id: 'groq',
    name: 'Groq',
    defaultBaseUrl: 'https://api.groq.com/openai/v1',
    placeholderKey: 'gsk_...',
    defaultModels: [
      { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B Versatile', provider: 'groq', contextSize: 128000 },
      { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B Instant', provider: 'groq', contextSize: 128000 },
      { id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B', provider: 'groq', contextSize: 32768 },
      { id: 'gemma2-9b-it', name: 'Gemma 2 9B IT', provider: 'groq', contextSize: 8192 },
    ],
  },
  grok: {
    id: 'grok',
    name: 'xAI Grok',
    defaultBaseUrl: 'https://api.x.ai/v1',
    placeholderKey: 'xai-...',
    defaultModels: [
      { id: 'grok-2-latest', name: 'Grok 2 (Latest)', provider: 'grok', contextSize: 131072 },
      { id: 'grok-2-vision-1212', name: 'Grok 2 Vision', provider: 'grok', contextSize: 32768 },
      { id: 'grok-beta', name: 'Grok Beta', provider: 'grok', contextSize: 131072 },
    ],
  },
  huggingface: {
    id: 'huggingface',
    name: 'Hugging Face',
    defaultBaseUrl: 'https://router.huggingface.co/hf-inference/v1',
    placeholderKey: 'hf_...',
    defaultModels: [
      { id: 'meta-llama/Llama-3.3-70B-Instruct', name: 'Meta Llama 3.3 70B', provider: 'huggingface', contextSize: 128000 },
      { id: 'deepseek-ai/DeepSeek-R1-Distill-Qwen-32B', name: 'DeepSeek R1 Distill Qwen 32B', provider: 'huggingface', contextSize: 64000 },
      { id: 'Qwen/Qwen2.5-72B-Instruct', name: 'Qwen 2.5 72B Instruct', provider: 'huggingface', contextSize: 32768 },
    ],
  },
  openai: {
    id: 'openai',
    name: 'OpenAI',
    defaultBaseUrl: 'https://api.openai.com/v1',
    placeholderKey: 'sk-proj-...',
    defaultModels: [
      { id: 'gpt-4o', name: 'GPT-4o', provider: 'openai', contextSize: 128000 },
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini', provider: 'openai', contextSize: 128000 },
      { id: 'o3-mini', name: 'o3-mini', provider: 'openai', contextSize: 200000 },
    ],
  },
  custom: {
    id: 'custom',
    name: 'Custom (OpenAI Compatible)',
    defaultBaseUrl: 'http://localhost:11434/v1',
    placeholderKey: 'Optional or API key...',
    defaultModels: [
      { id: 'default', name: 'Default Model', provider: 'custom', contextSize: 32768 },
    ],
  },
};

const CLOUD_CONFIG_KEY = 'littlesun_cloud_multi_v1';
const LEGACY_CONFIG_KEY = 'littlesun_cloud_config_v1';

export function getSavedCloudConfig(): CloudConfig {
  const fallback: CloudConfig = {
    keys: [],
    selectedModelId: '',
  };

  if (typeof window === 'undefined') return fallback;

  try {
    const raw = localStorage.getItem(CLOUD_CONFIG_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed?.keys)) {
        return {
          keys: parsed.keys.slice(0, MAX_API_KEYS),
          selectedModelId: typeof parsed.selectedModelId === 'string' ? parsed.selectedModelId : '',
        };
      }
    }

    // Migrate from legacy single-key config if exists
    const legacyRaw = localStorage.getItem(LEGACY_CONFIG_KEY);
    if (legacyRaw) {
      const legacy = JSON.parse(legacyRaw);
      if (legacy?.apiKey && typeof legacy.apiKey === 'string' && legacy.apiKey.trim()) {
        const prov: CloudProviderId = legacy.provider || 'openrouter';
        const info = CLOUD_PROVIDERS[prov] || CLOUD_PROVIDERS.openrouter;
        const initialKey: SavedApiKey = {
          id: generateUUID(),
          provider: prov,
          label: info.name,
          apiKey: legacy.apiKey.trim(),
          baseUrl: legacy.baseUrl || info.defaultBaseUrl,
          addedAt: new Date().toISOString(),
          models: info.defaultModels,
        };
        const migrated: CloudConfig = {
          keys: [initialKey],
          selectedModelId: legacy.selectedModelId || info.defaultModels[0]?.id || '',
        };
        saveCloudConfig(migrated);
        return migrated;
      }
    }

    return fallback;
  } catch {
    return fallback;
  }
}

export function saveCloudConfig(config: CloudConfig): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(CLOUD_CONFIG_KEY, JSON.stringify(config));
  } catch {
    // ignore
  }
}

/**
 * Fetch available models dynamically in real-time from provider's /models using the API key.
 */
export async function fetchModelsForApiKey(
  provider: CloudProviderId,
  apiKey: string,
  baseUrl: string,
  signal?: AbortSignal
): Promise<CloudModel[]> {
  const cleanBase = baseUrl.trim().replace(/\/+$/, '');
  const url = `${cleanBase}/models`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (apiKey.trim()) {
    headers['Authorization'] = `Bearer ${apiKey.trim()}`;
  }
  if (provider === 'openrouter') {
    headers['HTTP-Referer'] = 'https://littlesun.ai';
    headers['X-Title'] = 'Little Sun';
  }

  try {
    const res = await fetch(url, {
      method: 'GET',
      headers,
      signal: signal || AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`(${res.status}): ${errText.slice(0, 100) || res.statusText}`);
    }

    const data = await res.json();
    const rawList = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];

    const fetched: CloudModel[] = rawList
      .map((item: any) => {
        const id = typeof item === 'string' ? item : item.id || item.name;
        if (!id) return null;
        const rawName = item.name || id;
        const name = typeof rawName === 'string' ? rawName : id;
        const contextSize = Number(item.context_length || item.contextSize || item.max_context_length || 32768);
        return {
          id,
          name,
          provider,
          contextSize,
          available: true,
        };
      })
      .filter(Boolean) as CloudModel[];

    if (fetched.length > 0) {
      return fetched;
    }
  } catch (err) {
    console.warn(`Could not fetch /models for ${provider}:`, err);
  }

  // Fallback to standard provider models if endpoint doesn't support /models
  return CLOUD_PROVIDERS[provider]?.defaultModels || [];
}

/**
 * Get all available models across all currently linked API keys (max 5).
 */
export function getAllAvailableCloudModels(config: CloudConfig): CloudModel[] {
  const list: CloudModel[] = [];
  const seen = new Set<string>();

  for (const k of config.keys) {
    const models = k.models?.length ? k.models : CLOUD_PROVIDERS[k.provider]?.defaultModels || [];
    for (const m of models) {
      if (!seen.has(m.id)) {
        seen.add(m.id);
        list.push({
          ...m,
          provider: k.provider,
        });
      }
    }
  }

  return list;
}

/**
 * Find the linked key responsible for handling a given model ID.
 */
export function findKeyForModel(config: CloudConfig, modelId: string): SavedApiKey | null {
  if (!config.keys.length) return null;

  // 1. Direct match: Key that explicitly has this model in its models list
  for (const k of config.keys) {
    if (k.models?.some((m) => m.id === modelId)) {
      return k;
    }
  }

  // 2. Fallback: First key with matching provider prefix or default first key
  return config.keys[0];
}

export interface StreamCloudChatParams {
  key: SavedApiKey;
  modelId: string;
  messages: Array<{ role: 'user' | 'assistant' | 'system'; content: any }>;
  webSearch?: boolean;
  signal?: AbortSignal;
  onToken: (token: string) => void;
  onStatus?: (stage: 'connecting' | 'generating') => void;
}

/**
 * Stream responses from OpenAI-compatible cloud endpoints with a smooth pacing buffer.
 */
export async function streamCloudChat(params: StreamCloudChatParams): Promise<string> {
  const { key, modelId, messages, webSearch, signal, onToken, onStatus } = params;

  const cleanBase = key.baseUrl.trim().replace(/\/+$/, '');
  const url = `${cleanBase}/chat/completions`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (key.apiKey.trim()) {
    headers['Authorization'] = `Bearer ${key.apiKey.trim()}`;
  }
  if (key.provider === 'openrouter') {
    headers['HTTP-Referer'] = 'https://littlesun.ai';
    headers['X-Title'] = 'Little Sun';
  }

  onStatus?.('connecting');

  const requestBody: Record<string, any> = {
    model: modelId,
    messages,
    stream: true,
    temperature: 0.7,
  };

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(requestBody),
    signal,
  });

  if (!res.ok) {
    let errorDetail = '';
    try {
      const errJson = await res.json();
      errorDetail = errJson.error?.message || errJson.message || JSON.stringify(errJson);
    } catch {
      errorDetail = await res.text().catch(() => res.statusText);
    }
    throw new Error(`API error (${res.status}): ${errorDetail || 'Request failed'}`);
  }

  if (!res.body) {
    throw new Error('Response body is missing');
  }

  onStatus?.('generating');

  const reader = res.body.getReader();
  const decoder = new TextDecoder('utf-8');

  // Smooth Token Pacer Buffer:
  // Decouples incoming raw chunk bursts from UI rendering with micro-delay pacing (smooth organic flow).
  let fullAccumulated = '';
  const tokenQueue: string[] = [];
  let isStreamFinished = false;
  let hasError: Error | null = null;

  return new Promise<string>((resolve, reject) => {
    let animationFrameId: number | null = null;
    let lastRenderTime = performance.now();

    const tick = () => {
      if (signal?.aborted) {
        if (animationFrameId !== null) cancelAnimationFrame(animationFrameId);
        reject(new DOMException('Aborted', 'AbortError'));
        return;
      }

      const now = performance.now();
      const elapsed = now - lastRenderTime;

      // Pacing interval: 14-20ms per step, dynamically accelerating if queue grows
      const targetInterval = tokenQueue.length > 50 ? 5 : tokenQueue.length > 20 ? 10 : 18;

      if (elapsed >= targetInterval && tokenQueue.length > 0) {
        lastRenderTime = now;
        const batchCount = tokenQueue.length > 100 ? 6 : tokenQueue.length > 40 ? 3 : 1;
        for (let i = 0; i < batchCount && tokenQueue.length > 0; i++) {
          const piece = tokenQueue.shift()!;
          fullAccumulated += piece;
          onToken(piece);
        }
      }

      if (isStreamFinished && tokenQueue.length === 0) {
        if (hasError) {
          reject(hasError);
        } else {
          resolve(fullAccumulated);
        }
        return;
      }

      animationFrameId = requestAnimationFrame(tick);
    };

    animationFrameId = requestAnimationFrame(tick);

    // Asynchronous network stream reader
    (async () => {
      let buffer = '';
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith(':')) continue;

            if (trimmed === 'data: [DONE]') {
              continue;
            }

            if (trimmed.startsWith('data: ')) {
              const jsonStr = trimmed.slice(6).trim();
              try {
                const parsed = JSON.parse(jsonStr);
                const delta = parsed.choices?.[0]?.delta;
                const token = delta?.content || delta?.text || '';
                if (token) {
                  tokenQueue.push(token);
                }
              } catch {
                // Ignore partial JSON chunks
              }
            }
          }
        }

        if (buffer.trim().startsWith('data: ') && buffer.trim() !== 'data: [DONE]') {
          try {
            const parsed = JSON.parse(buffer.trim().slice(6));
            const token = parsed.choices?.[0]?.delta?.content || '';
            if (token) tokenQueue.push(token);
          } catch {
            // ignore
          }
        }
      } catch (err) {
        if (signal?.aborted) {
          // handled in tick
        } else {
          hasError = err instanceof Error ? err : new Error(String(err));
        }
      } finally {
        isStreamFinished = true;
      }
    })();
  });
}
