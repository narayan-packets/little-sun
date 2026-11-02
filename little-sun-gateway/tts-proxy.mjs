import { spawn, execSync } from 'node:child_process';
import { logger } from './logger.mjs';

/**
 * Supervises the local Kyutai Pocket TTS FastAPI server on 127.0.0.1:8000
 * and provides sentence-chunked SSE audio streaming + in-memory session caching.
 */

let ttsProc = null;
let ttsState = 'starting'; // 'starting' | 'online' | 'offline'
let supervisorTimer = null;

// In-memory audio cache for the session (key: `${voice}:${text}` -> Buffer)
const audioCache = new Map();
const MAX_CACHE_ENTRIES = 120;

function cacheAudio(key, buf) {
  if (audioCache.size >= MAX_CACHE_ENTRIES) {
    const oldestKey = audioCache.keys().next().value;
    if (oldestKey) audioCache.delete(oldestKey);
  }
  audioCache.set(key, buf);
}

export function getTtsState() {
  return ttsState;
}

export async function checkTtsHealth(ttsBaseUrl) {
  try {
    const res = await fetch(`${ttsBaseUrl.replace(/\/+$/, '')}/health`, {
      signal: AbortSignal.timeout(2000),
    });
    const ok = res.ok;
    ttsState = ok ? 'online' : 'offline';
    return ok;
  } catch {
    return false;
  }
}

export async function startTtsSupervisor(ttsBaseUrl = 'http://127.0.0.1:8000') {
  const alreadyUp = await checkTtsHealth(ttsBaseUrl);
  if (alreadyUp) {
    ttsState = 'online';
    logger.log('TTS', `Pocket TTS detected online at ${ttsBaseUrl}`);
  } else {
    spawnPocketTts(ttsBaseUrl);
  }

  if (supervisorTimer) clearInterval(supervisorTimer);
  supervisorTimer = setInterval(async () => {
    const healthy = await checkTtsHealth(ttsBaseUrl);
    if (!healthy && !ttsProc) {
      logger.log('TTS', 'Pocket TTS unreachable — auto-starting service...');
      spawnPocketTts(ttsBaseUrl);
    }
  }, 8000);
}

function spawnPocketTts(ttsBaseUrl) {
  if (ttsProc) return;
  ttsState = 'starting';
  const portMatch = /:(\d+)/.exec(ttsBaseUrl);
  const port = portMatch ? portMatch[1] : '8000';

  logger.log('TTS', `Spawning: python -m pocket_tts serve --port ${port}`);

  try {
    const proc = spawn('python', ['-m', 'pocket_tts', 'serve', '--port', port], {
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });
    ttsProc = proc;

    const handleReadyOutput = (chunk) => {
      const line = chunk.toString().trim();
      if (
        ttsState !== 'online' &&
        (line.includes('Uvicorn running') || line.includes('Application startup complete'))
      ) {
        ttsState = 'online';
        logger.log('TTS', `Pocket TTS ready on port ${port}`);
      }
    };

    proc.stdout?.on('data', handleReadyOutput);
    proc.stderr?.on('data', handleReadyOutput);

    proc.on('exit', (code) => {
      ttsProc = null;
      ttsState = 'offline';
      logger.log('TTS', `Pocket TTS process exited (code=${code ?? 'null'})`);
    });

    proc.on('error', (err) => {
      ttsProc = null;
      ttsState = 'offline';
      logger.log('ERR', `Failed to spawn Pocket TTS: ${err.message}`);
    });
  } catch (err) {
    ttsProc = null;
    ttsState = 'offline';
    logger.log('ERR', `Pocket TTS launch error: ${err.message}`);
  }
}

export function stopTtsSupervisor() {
  if (supervisorTimer) {
    clearInterval(supervisorTimer);
    supervisorTimer = null;
  }
  if (ttsProc && ttsProc.pid) {
    try {
      if (process.platform === 'win32') {
        execSync(`taskkill /pid ${ttsProc.pid} /t /f`, { stdio: 'ignore' });
      } else {
        ttsProc.kill('SIGTERM');
      }
    } catch {
      // ignore
    }
    ttsProc = null;
  }
}

/**
 * Synthesizes a single text segment into a WAV Buffer from Pocket TTS (or cache).
 */
async function synthesizeSegmentWav(ttsBaseUrl, text, voice, signal) {
  const selectedVoice = voice || 'alba';
  const cacheKey = `${selectedVoice}:${text}`;
  if (audioCache.has(cacheKey)) {
    logger.log('TTS', `Served audio segment from session cache (voice=${selectedVoice}, chars=${text.length})`);
    return audioCache.get(cacheKey);
  }

  const cleanBase = ttsBaseUrl.replace(/\/+$/, '');
  const formData = new FormData();
  formData.append('text', text);
  formData.append('voice_url', selectedVoice);

  const startedAt = Date.now();
  const upstream = await fetch(`${cleanBase}/tts`, {
    method: 'POST',
    body: formData,
    signal,
  });

  if (!upstream.ok) {
    const errDetails = await upstream.text().catch(() => '');
    throw new Error(`Pocket TTS HTTP ${upstream.status}: ${errDetails.slice(0, 120)}`);
  }

  const contentType = upstream.headers.get('content-type') || '';
  const arrayBuf = await upstream.arrayBuffer();
  let wavBuffer = Buffer.from(arrayBuf);

  if (contentType.includes('application/json')) {
    const jsonText = new TextDecoder().decode(arrayBuf);
    try {
      const parsed = JSON.parse(jsonText);
      const b64 = parsed.audio || parsed.wav || parsed.data;
      if (b64) {
        wavBuffer = Buffer.from(b64.replace(/^data:audio\/\w+;base64,/, ''), 'base64');
      }
    } catch {
      // Use raw buffer
    }
  }

  const elapsedMs = Date.now() - startedAt;
  logger.log(
    'TTS',
    `Synthesized segment (voice=${selectedVoice}, chars=${text.length}, bytes=${wavBuffer.length}, time=${elapsedMs}ms)`
  );

  cacheAudio(cacheKey, wavBuffer);
  return wavBuffer;
}

/**
 * Splits text into natural speakable sentence chunks so the first sentence starts playing immediately.
 */
function splitTextIntoSpeakableChunks(text) {
  const cleaned = text.replace(/\s+/g, ' ').trim();
  if (!cleaned) return [];
  if (cleaned.length <= 140) return [cleaned];

  const rawSentences = cleaned.match(/[^.!?]+[.!?]+(?:\s+|$)|[^.!?]+$/g) || [cleaned];
  const chunks = [];
  let current = '';

  for (const s of rawSentences) {
    const trimmed = s.trim();
    if (!trimmed) continue;
    // Keep the very first chunk short (~90 chars max) for near-instant time-to-first-audio
    const maxLen = chunks.length === 0 ? 110 : 220;
    if (current && (current.length + 1 + trimmed.length) > maxLen) {
      chunks.push(current);
      current = trimmed;
    } else {
      current = current ? `${current} ${trimmed}` : trimmed;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

export async function proxyTtsWav(ttsBaseUrl, { text, voice }, _req, res) {
  const abortController = new AbortController();
  res.on('close', () => {
    if (!res.writableEnded) abortController.abort();
  });

  try {
    const wavBuffer = await synthesizeSegmentWav(ttsBaseUrl, text, voice, abortController.signal);
    res.writeHead(200, {
      'Content-Type': 'audio/wav',
      'Cache-Control': 'no-store',
    });
    res.end(wavBuffer);
  } catch (err) {
    if (abortController.signal.aborted) return;
    logger.log('ERR', `TTS synthesis error: ${err.message}`);
    if (!res.headersSent) {
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'tts_failed' }));
    }
  }
}

export async function proxyTtsStream(ttsBaseUrl, { text, voice }, _req, res) {
  const abortController = new AbortController();
  let clientClosed = false;
  res.on('close', () => {
    if (!res.writableEnded) {
      clientClosed = true;
      abortController.abort();
    }
  });

  const chunks = splitTextIntoSpeakableChunks(text);
  if (chunks.length === 0) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'empty_text' }));
    return;
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    Connection: 'keep-alive',
  });

  try {
    for (let i = 0; i < chunks.length; i++) {
      if (clientClosed || abortController.signal.aborted) break;
      const segmentText = chunks[i];
      const wavBuffer = await synthesizeSegmentWav(
        ttsBaseUrl,
        segmentText,
        voice,
        abortController.signal
      );
      if (clientClosed || abortController.signal.aborted) break;
      const base64Audio = wavBuffer.toString('base64');
      res.write(
        `data: ${JSON.stringify({
          type: 'audio',
          index: i,
          total: chunks.length,
          audio: base64Audio,
        })}\n\n`
      );
    }

    if (!clientClosed) {
      res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
    }
    res.end();
  } catch (err) {
    if (!clientClosed) {
      logger.log('ERR', `TTS stream error: ${err.message}`);
      res.write(`data: ${JSON.stringify({ type: 'error', message: 'TTS synthesis interrupted' })}\n\n`);
      res.end();
    }
  }
}
