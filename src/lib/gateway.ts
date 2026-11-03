import type { ChatMessagePayload } from './tokens';

export interface GatewayModel {
  id: string;
  name: string;
  available: boolean;
  enabled?: boolean;
  isDefault: boolean;
  contextSize?: number;
  maxTokens?: number;
}

const LEGACY_MODEL_OVERRIDES_KEY = 'littlesun_model_overrides_v1';
try {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(LEGACY_MODEL_OVERRIDES_KEY);
  }
} catch {
  // ignore
}

export function sanitizeBackendModels(models: GatewayModel[]): GatewayModel[] {
  return models
    .filter((m) => m.enabled !== false)
    .map((m) => ({
      id: m.id,
      name: (m.name || 'Little Sun').replace(/\s*\(recommended\)/i, '').trim(),
      available: Boolean(m.available),
      enabled: true,
      isDefault: Boolean(m.isDefault),
      contextSize: m.contextSize || 16384,
      maxTokens: m.maxTokens || 4096,
    }));
}

export type LlmRuntimeState = 'unloaded' | 'loading' | 'ready' | 'processing';

export interface GatewayStatusResponse {
  llm: {
    state: LlmRuntimeState;
    modelId: string | null;
    modelName?: string | null;
    idleSecondsLeft: number | null;
  };
  tts: {
    ok: boolean;
  };
}

export type ChatStreamEvent =
  | { type: 'status'; state: 'loading_model' | 'generating' }
  | { type: 'token'; text: string }
  | { type: 'done'; tokens: number }
  | { type: 'error'; message: string };

const CUSTOM_GATEWAY_URL_KEY = 'littlesun_gateway_url_v1';

export function getCustomGatewayUrl(): string {
  if (typeof window === 'undefined') return '';
  try {
    return localStorage.getItem(CUSTOM_GATEWAY_URL_KEY) || '';
  } catch {
    return '';
  }
}

export function setCustomGatewayUrl(url: string): void {
  if (typeof window === 'undefined') return;
  const trimmed = url.trim().replace(/\/+$/, '');
  try {
    if (trimmed) {
      localStorage.setItem(CUSTOM_GATEWAY_URL_KEY, trimmed);
    } else {
      localStorage.removeItem(CUSTOM_GATEWAY_URL_KEY);
    }
  } catch {
    // ignore
  }
  activeDirectBaseUrl = null;
}

export async function registerGatewayUrlWithServer(url: string): Promise<boolean> {
  const trimmed = url.trim().replace(/\/+$/, '');
  if (!trimmed) return false;
  setCustomGatewayUrl(trimmed);
  try {
    const res = await fetch('/api/gateway-register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gatewayUrl: trimmed }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

const envGatewayUrl = (
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_GATEWAY_URL) ||
  ''
)
  .trim()
  .replace(/\/+$/, '');

export function getDirectGatewayUrl(): string {
  const custom = getCustomGatewayUrl();
  if (custom && !custom.includes('<laptop>') && !custom.includes('<your-laptop>')) {
    return custom;
  }
  if (envGatewayUrl && !envGatewayUrl.includes('<laptop>') && !envGatewayUrl.includes('<your-laptop>')) {
    return envGatewayUrl;
  }
  return '';
}

let activeDirectBaseUrl: string | null = null;

export function getGatewayUrl(): string {
  if (activeDirectBaseUrl) {
    return activeDirectBaseUrl;
  }
  const direct = getDirectGatewayUrl();
  if (direct) {
    return direct;
  }
  if (typeof window !== 'undefined') {
    return `${window.location.origin}/gateway-proxy`;
  }
  return '/gateway-proxy';
}

export function isGatewayActive(): boolean {
  return true;
}

let lastAppliedFaviconHref = '';

function syncBrowserFavicon(baseUrl: string, faviconVersion: number | null | undefined) {
  if (typeof document === 'undefined') return;
  const targetHref = faviconVersion
    ? `${baseUrl}/favicon?v=${faviconVersion}`
    : '/favicon.svg';
  if (lastAppliedFaviconHref === targetHref) return;
  lastAppliedFaviconHref = targetHref;

  const iconLink = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (iconLink) {
    iconLink.href = targetHref;
    if (faviconVersion) {
      iconLink.removeAttribute('type');
    } else {
      iconLink.type = 'image/svg+xml';
    }
  }
}

let lastDetectedFunnelUrl = '';
const funnelDetectionListeners = new Set<(url: string) => void>();

export function getDetectedFunnelUrl(): string {
  return lastDetectedFunnelUrl;
}

export function getActiveDirectGatewayUrl(): string | null {
  return activeDirectBaseUrl;
}

export function onFunnelUrlDetected(callback: (url: string) => void): () => void {
  funnelDetectionListeners.add(callback);
  if (lastDetectedFunnelUrl) {
    try {
      callback(lastDetectedFunnelUrl);
    } catch {
      // ignore
    }
  }
  return () => {
    funnelDetectionListeners.delete(callback);
  };
}

export async function testGatewayUrl(url: string): Promise<{
  ok: boolean;
  latencyMs: number;
  funnelUrl?: string;
  error?: string;
}> {
  const clean = url.trim().replace(/\/+$/, '');
  if (!clean) {
    return { ok: false, latencyMs: 0, error: 'Please enter a gateway URL.' };
  }
  if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
    return { ok: false, latencyMs: 0, error: 'URL must start with https:// or http://' };
  }
  const start = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6500);
  try {
    const sep = clean.includes('?') ? '&' : '?';
    const res = await fetch(`${clean}/health${sep}_t=${Date.now()}`, {
      method: 'GET',
      signal: controller.signal,
    });
    const latencyMs = Date.now() - start;
    if (!res.ok) {
      return { ok: false, latencyMs, error: `Gateway returned HTTP ${res.status}` };
    }
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('text/html')) {
      return { ok: false, latencyMs, error: 'Received HTML instead of Gateway JSON API' };
    }
    const data = await res.json();
    if (data?.ok === true) {
      const funnel = typeof data.funnelUrl === 'string' && data.funnelUrl.trim() ? data.funnelUrl.trim() : undefined;
      if (funnel) {
        lastDetectedFunnelUrl = funnel;
        funnelDetectionListeners.forEach((fn) => fn(funnel));
      }
      return { ok: true, latencyMs, funnelUrl: funnel };
    }
    return { ok: false, latencyMs, error: 'Invalid response from gateway health check' };
  } catch (err) {
    const latencyMs = Date.now() - start;
    const msg =
      err instanceof DOMException && err.name === 'AbortError'
        ? 'Connection timed out (6.5s)'
        : 'Could not connect to gateway endpoint';
    return { ok: false, latencyMs, error: msg };
  } finally {
    clearTimeout(timer);
  }
}

async function pingHealthEndpoint(baseUrl: string, timeoutMs = 4500): Promise<boolean> {
  if (!baseUrl) return false;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const sep = baseUrl.includes('?') ? '&' : '?';
    const res = await fetch(`${baseUrl}/health${sep}_t=${Date.now()}`, {
      method: 'GET',
      signal: controller.signal,
    });
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('text/html') || !res.ok) {
      return false;
    }
    const data = await res.json();
    const ok = Boolean(data && data.ok === true);
    if (ok) {
      syncBrowserFavicon(baseUrl, typeof data.faviconVersion === 'number' ? data.faviconVersion : null);
      if (typeof data.funnelUrl === 'string' && data.funnelUrl.trim()) {
        const detected = data.funnelUrl.trim();
        if (detected !== lastDetectedFunnelUrl) {
          lastDetectedFunnelUrl = detected;
          funnelDetectionListeners.forEach((fn) => fn(detected));
        }
      }
    }
    return ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

export async function checkGatewayHealth(): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return false;
  }

  // 1. If we already locked onto a working endpoint, verify it first
  if (activeDirectBaseUrl) {
    const stillOk = await pingHealthEndpoint(activeDirectBaseUrl, 4500);
    if (stillOk) return true;
  }

  const isLocalHost =
    typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

  const proxyUrl =
    typeof window !== 'undefined' ? `${window.location.origin}/gateway-proxy` : '/gateway-proxy';
  const directUrl = getDirectGatewayUrl();
  const localLoopback = 'http://127.0.0.1:8790';

  // Probe local loopback only on localhost / desktop
  if (isLocalHost && (await pingHealthEndpoint(localLoopback, 1500))) {
    activeDirectBaseUrl = localLoopback;
    return true;
  }

  // On remote/mobile, probe direct Funnel URL and server proxy concurrently with 8s timeout for cellular networks
  const candidates = Array.from(
    new Set([directUrl, proxyUrl, isLocalHost ? localLoopback : ''].filter(Boolean))
  );

  const results = await Promise.all(
    candidates.map(async (url) => ({
      url,
      ok: await pingHealthEndpoint(url, 8000),
    }))
  );

  const winner = results.find((r) => r.ok);
  if (winner) {
    activeDirectBaseUrl = winner.url;
    return true;
  }

  activeDirectBaseUrl = null;
  return false;
}

export class GatewayBusyError extends Error {
  constructor() {
    super('Little Sun is busy, try again in a moment');
    this.name = 'GatewayBusyError';
  }
}

export class GatewayForbiddenError extends Error {
  constructor() {
    super('Access not allocated for this account');
    this.name = 'GatewayForbiddenError';
  }
}

export async function fetchGatewayStatus(accessToken: string): Promise<GatewayStatusResponse> {
  const gatewayUrl = getGatewayUrl();
  const res = await fetch(`${gatewayUrl}/status`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    cache: 'no-store',
  });
  if (res.status === 401) {
    throw new Error('Unauthorized (401)');
  }
  if (res.status === 403) {
    throw new GatewayForbiddenError();
  }
  if (!res.ok) {
    throw new Error('Failed to fetch gateway status');
  }
  return (await res.json()) as GatewayStatusResponse;
}

export async function fetchGatewayModels(accessToken: string): Promise<GatewayModel[]> {
  const gatewayUrl = getGatewayUrl();
  const res = await fetch(`${gatewayUrl}/models`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    cache: 'no-store',
  });
  if (res.status === 401) {
    throw new Error('Unauthorized (401)');
  }
  if (res.status === 403) {
    throw new GatewayForbiddenError();
  }
  if (!res.ok) {
    throw new Error('Failed to fetch models');
  }
  const rawModels = (await res.json()) as GatewayModel[];
  return sanitizeBackendModels(rawModels);
}

export async function notifyGatewayChatSwitch(
  accessToken: string,
  chatId: string | null,
  action: 'sleep' | 'kill' = 'sleep'
): Promise<void> {
  try {
    const gatewayUrl = getGatewayUrl();
    await fetch(`${gatewayUrl}/session/switch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ chatId, action }),
    });
  } catch {
    // Non-blocking if gateway is sleeping/offline
  }
}

export async function streamGatewayChat(params: {
  accessToken: string;
  chatId?: string;
  model: string;
  messages: ChatMessagePayload[];
  signal: AbortSignal;
  onEvent: (event: ChatStreamEvent) => void;
}): Promise<void> {
  const { accessToken, chatId, model, messages, signal, onEvent } = params;
  const gatewayUrl = getGatewayUrl();

  const res = await fetch(`${gatewayUrl}/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ chatId, model, messages }),
    signal,
  });

  if (res.status === 403) {
    throw new GatewayForbiddenError();
  }

  if (res.status === 429) {
    let errType = 'busy';
    try {
      const body = await res.json();
      if (body?.error) errType = body.error;
    } catch {
      // ignore
    }
    if (errType === 'busy') {
      throw new GatewayBusyError();
    }
    throw new Error('Rate limit reached. Please wait a moment.');
  }

  if (res.status === 401) {
    throw new Error('Session expired. Please sign in again.');
  }

  if (res.status === 413) {
    throw new Error('Message is too long for the gateway limit.');
  }

  if (!res.ok || !res.body) {
    throw new Error('Could not reach Little Sun.');
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;
      const jsonStr = trimmed.slice(5).trim();
      if (!jsonStr) continue;
      try {
        const evt = JSON.parse(jsonStr) as ChatStreamEvent;
        onEvent(evt);
      } catch {
        // ignore malformed line
      }
    }
  }
}
