import { getGatewayUrl } from './gateway';
import { markdownToSpeakableText } from './markdown';
import { syncUserPreferences } from './supabase';

export type PocketVoiceId =
  | 'alba'
  | 'fantine'
  | 'jean'
  | 'marius'
  | 'javert'
  | 'cosette'
  | 'eponine'
  | 'azelma';

export const POCKET_VOICES: { id: PocketVoiceId; label: string }[] = [
  { id: 'alba', label: 'Alba' },
  { id: 'fantine', label: 'Fantine' },
  { id: 'jean', label: 'Jean' },
  { id: 'marius', label: 'Marius' },
  { id: 'javert', label: 'Javert' },
  { id: 'cosette', label: 'Cosette' },
  { id: 'eponine', label: 'Eponine' },
  { id: 'azelma', label: 'Azelma' },
];

const STORAGE_VOICE_KEY = 'littlesun_tts_voice';
const STORAGE_SPEED_KEY = 'littlesun_tts_speed';
let speedSyncTimer: ReturnType<typeof setTimeout> | null = null;

export function getSavedVoice(): PocketVoiceId {
  try {
    const val = localStorage.getItem(STORAGE_VOICE_KEY) as PocketVoiceId | null;
    if (val && POCKET_VOICES.some((v) => v.id === val)) {
      return val;
    }
  } catch {
    // ignore
  }
  return 'alba';
}

export function setSavedVoice(voice: PocketVoiceId, syncRemote = true): void {
  try {
    localStorage.setItem(STORAGE_VOICE_KEY, voice);
  } catch {
    // ignore
  }
  if (syncRemote) {
    void syncUserPreferences({ tts_voice: voice });
  }
}

export function getSavedSpeed(): number {
  try {
    const val = Number(localStorage.getItem(STORAGE_SPEED_KEY));
    if (!Number.isNaN(val) && val >= 0.75 && val <= 1.5) {
      return val;
    }
  } catch {
    // ignore
  }
  return 1.0;
}

export function setSavedSpeed(speed: number, syncRemote = true): void {
  const clamped = Math.min(1.5, Math.max(0.75, Math.round(speed * 100) / 100));
  try {
    localStorage.setItem(STORAGE_SPEED_KEY, String(clamped));
  } catch {
    // ignore
  }
  ttsController.updateSpeed(clamped);
  if (syncRemote) {
    if (speedSyncTimer) clearTimeout(speedSyncTimer);
    speedSyncTimer = setTimeout(() => {
      void syncUserPreferences({ tts_speed: clamped });
    }, 600);
  }
}

export type TtsPlaybackState = 'idle' | 'loading' | 'playing';

export interface TtsQueueSnapshot {
  activeMessageId: string | null;
  state: TtsPlaybackState;
  errorMessageId: string | null;
  errorText: string | null;
}

type TtsListener = (snapshot: TtsQueueSnapshot) => void;

/**
 * Splits markdown-cleaned speakable text into sentence chunks on the client side
 * so even if the gateway only exposes single-WAV /tts, the client streams
 * sentence-by-sentence with near-instant time-to-first-audio and session caching.
 */
function splitIntoClientSentences(text: string): string[] {
  const cleaned = text.replace(/\s+/g, ' ').trim();
  if (!cleaned) return [];
  if (cleaned.length <= 130) return [cleaned];

  const rawSentences = cleaned.match(/[^.!?]+[.!?]+(?:\s+|$)|[^.!?]+$/g) || [cleaned];
  const chunks: string[] = [];
  let current = '';

  for (const s of rawSentences) {
    const trimmed = s.trim();
    if (!trimmed) continue;
    const maxLen = chunks.length === 0 ? 105 : 210;
    if (current && current.length + 1 + trimmed.length > maxLen) {
      chunks.push(current);
      current = trimmed;
    } else {
      current = current ? `${current} ${trimmed}` : trimmed;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to encode audio'));
      }
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

class SingleAudioQueuePlayer {
  private activeMessageId: string | null = null;
  private state: TtsPlaybackState = 'idle';
  private errorMessageId: string | null = null;
  private errorText: string | null = null;
  private abortController: AbortController | null = null;
  private audioEl: HTMLAudioElement | null = null;
  private chunkQueue: string[] = [];
  private isPlayingChunk = false;
  private streamFinished = false;
  private currentSpeed = getSavedSpeed();
  private listeners = new Set<TtsListener>();

  // In-memory session cache: key = `${voice}::${sentenceOrMessage}` -> dataUrl[]
  private sessionCache = new Map<string, string[]>();
  private segmentCache = new Map<string, string>();

  private setSessionCache(key: string, chunks: string[]) {
    if (this.sessionCache.size >= 25) {
      const oldestKey = this.sessionCache.keys().next().value;
      if (oldestKey !== undefined) this.sessionCache.delete(oldestKey);
    }
    this.sessionCache.set(key, chunks);
  }

  private setSegmentCache(key: string, chunk: string) {
    if (this.segmentCache.size >= 50) {
      const oldestKey = this.segmentCache.keys().next().value;
      if (oldestKey !== undefined) this.segmentCache.delete(oldestKey);
    }
    this.segmentCache.set(key, chunk);
  }

  getSnapshot(): TtsQueueSnapshot {
    return {
      activeMessageId: this.activeMessageId,
      state: this.state,
      errorMessageId: this.errorMessageId,
      errorText: this.errorText,
    };
  }

  subscribe(listener: TtsListener): () => void {
    this.listeners.add(listener);
    listener(this.getSnapshot());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit() {
    const snap = this.getSnapshot();
    this.listeners.forEach((l) => l(snap));
  }

  updateSpeed(speed: number) {
    this.currentSpeed = speed;
    if (this.audioEl) {
      this.audioEl.playbackRate = speed;
      this.applyPreservesPitch(this.audioEl);
    }
  }

  private applyPreservesPitch(el: HTMLAudioElement) {
    const anyEl = el as HTMLAudioElement & {
      preservesPitch?: boolean;
      mozPreservesPitch?: boolean;
      webkitPreservesPitch?: boolean;
    };
    anyEl.preservesPitch = true;
    anyEl.mozPreservesPitch = true;
    anyEl.webkitPreservesPitch = true;
  }

  stop() {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    this.chunkQueue = [];
    this.isPlayingChunk = false;
    this.streamFinished = true;

    if (this.audioEl) {
      this.audioEl.onended = null;
      this.audioEl.onerror = null;
      try {
        this.audioEl.pause();
        this.audioEl.removeAttribute('src');
        this.audioEl.load();
      } catch {
        // ignore
      }
    }

    this.activeMessageId = null;
    this.state = 'idle';
    this.emit();
  }

  async toggleMessage(params: {
    messageId: string;
    markdown: string;
    accessToken: string;
  }): Promise<void> {
    const { messageId, markdown, accessToken } = params;

    // If already loading or playing this message, Stop immediately
    if (this.activeMessageId === messageId && this.state !== 'idle') {
      this.stop();
      return;
    }

    this.stop();
    this.errorMessageId = null;
    this.errorText = null;

    const speakable = markdownToSpeakableText(markdown);
    if (!speakable) {
      this.errorMessageId = messageId;
      this.errorText = "Couldn't read this aloud";
      this.emit();
      return;
    }

    // Unlock Audio element synchronously inside tap gesture for mobile Safari/Chrome
    if (!this.audioEl && typeof Audio !== 'undefined') {
      this.audioEl = new Audio();
    }
    if (this.audioEl) {
      this.audioEl.preload = 'auto';
      this.audioEl.playbackRate = this.currentSpeed;
      this.applyPreservesPitch(this.audioEl);
    }

    const voice = getSavedVoice();
    this.currentSpeed = getSavedSpeed();
    const messageCacheKey = `${voice}::${speakable}`;

    // Instant replay from session cache if already synthesized in this session!
    const cachedChunks = this.sessionCache.get(messageCacheKey);
    if (cachedChunks && cachedChunks.length > 0) {
      this.activeMessageId = messageId;
      this.state = 'playing';
      this.chunkQueue = [...cachedChunks];
      this.isPlayingChunk = false;
      this.streamFinished = true;
      this.emit();
      this.pumpAudioQueue(messageId);
      return;
    }

    this.activeMessageId = messageId;
    this.state = 'loading';
    this.chunkQueue = [];
    this.isPlayingChunk = false;
    this.streamFinished = false;
    this.emit();

    const controller = new AbortController();
    this.abortController = controller;
    const collectedChunks: string[] = [];

    try {
      const gatewayUrl = getGatewayUrl();
      const res = await fetch(`${gatewayUrl}/tts/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ text: speakable, voice }),
        signal: controller.signal,
      });

      const contentType = res.headers.get('content-type') || '';

      if (!res.ok || !res.body || !contentType.includes('text/event-stream')) {
        // Client-side sentence-chunked streaming over /tts
        await this.streamClientSentenceFallback(
          gatewayUrl,
          speakable,
          voice,
          accessToken,
          controller.signal,
          messageId,
          messageCacheKey
        );
        return;
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
          const rawData = trimmed.slice(5).trim();
          if (!rawData || rawData === '[DONE]') continue;

          let base64Audio: string | null = null;
          try {
            const parsed = JSON.parse(rawData);
            if (typeof parsed.audio === 'string') {
              base64Audio = parsed.audio;
            } else if (typeof parsed.chunk === 'string') {
              base64Audio = parsed.chunk;
            } else if (typeof parsed.data === 'string') {
              base64Audio = parsed.data;
            } else if (parsed.type === 'done') {
              this.streamFinished = true;
            } else if (parsed.type === 'error') {
              throw new Error(parsed.message || 'TTS stream error');
            }
          } catch (e) {
            if (e instanceof Error && e.message === 'TTS stream error') throw e;
            if (/^[A-Za-z0-9+/=]+$/.test(rawData)) {
              base64Audio = rawData;
            }
          }

          if (base64Audio) {
            const dataUrl = base64Audio.startsWith('data:')
              ? base64Audio
              : `data:audio/wav;base64,${base64Audio}`;
            collectedChunks.push(dataUrl);
            this.chunkQueue.push(dataUrl);
            this.pumpAudioQueue(messageId);
          }
        }
      }

      this.streamFinished = true;
      if (collectedChunks.length > 0 && !controller.signal.aborted) {
        this.setSessionCache(messageCacheKey, collectedChunks);
      }

      if (!this.isPlayingChunk && this.chunkQueue.length === 0) {
        this.activeMessageId = null;
        this.state = 'idle';
        this.emit();
      }
    } catch {
      if (controller.signal.aborted) return;
      this.activeMessageId = null;
      this.state = 'idle';
      this.errorMessageId = messageId;
      this.errorText = "Couldn't read this aloud";
      this.emit();
    }
  }

  /**
   * Streams sentence by sentence using /tts so the first sentence starts playing
   * within ~0.4s while subsequent sentences prefetch in the background, caching each segment.
   */
  private async streamClientSentenceFallback(
    gatewayUrl: string,
    speakable: string,
    voice: PocketVoiceId,
    accessToken: string,
    signal: AbortSignal,
    messageId: string,
    messageCacheKey: string
  ) {
    const sentences = splitIntoClientSentences(speakable);
    const collectedChunks: string[] = [];

    for (const sentence of sentences) {
      if (signal.aborted || this.activeMessageId !== messageId) return;
      const segKey = `${voice}::${sentence}`;
      let dataUrl = this.segmentCache.get(segKey);

      if (!dataUrl) {
        const res = await fetch(`${gatewayUrl}/tts`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ text: sentence, voice }),
          signal,
        });

        if (!res.ok) {
          throw new Error('TTS request failed');
        }

        const blob = await res.blob();
        dataUrl = await blobToDataUrl(blob);
        this.setSegmentCache(segKey, dataUrl);
      }

      if (signal.aborted || this.activeMessageId !== messageId) return;
      collectedChunks.push(dataUrl);
      this.chunkQueue.push(dataUrl);
      this.pumpAudioQueue(messageId);
    }

    this.streamFinished = true;
    if (collectedChunks.length > 0 && !signal.aborted) {
      this.setSessionCache(messageCacheKey, collectedChunks);
    }

    if (!this.isPlayingChunk && this.chunkQueue.length === 0) {
      this.activeMessageId = null;
      this.state = 'idle';
      this.emit();
    }
  }

  private pumpAudioQueue(messageId: string) {
    if (this.isPlayingChunk || this.activeMessageId !== messageId) return;
    const nextSrc = this.chunkQueue.shift();
    if (!nextSrc) {
      if (this.streamFinished) {
        this.activeMessageId = null;
        this.state = 'idle';
        this.emit();
      }
      return;
    }

    if (!this.audioEl) {
      this.audioEl = new Audio();
    }

    this.isPlayingChunk = true;
    this.state = 'playing';
    this.emit();

    const el = this.audioEl;
    el.src = nextSrc;
    el.playbackRate = this.currentSpeed;
    this.applyPreservesPitch(el);

    el.onended = () => {
      if (this.activeMessageId !== messageId) return;
      this.isPlayingChunk = false;
      this.pumpAudioQueue(messageId);
    };

    el.onerror = () => {
      if (this.activeMessageId !== messageId) return;
      this.isPlayingChunk = false;
      this.activeMessageId = null;
      this.state = 'idle';
      this.errorMessageId = messageId;
      this.errorText = "Couldn't read this aloud";
      this.emit();
    };

    el.play().catch(() => {
      if (this.activeMessageId !== messageId) return;
      this.isPlayingChunk = false;
      this.activeMessageId = null;
      this.state = 'idle';
      this.errorMessageId = messageId;
      this.errorText = "Couldn't read this aloud";
      this.emit();
    });
  }
}

export const ttsController = new SingleAudioQueuePlayer();
