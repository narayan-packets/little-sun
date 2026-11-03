import 'dotenv/config';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { verifySupabaseToken } from './auth.mjs';
import { CliDashboard } from './cli-dashboard.mjs';
import { LlamaManager } from './llama-manager.mjs';
import { logger } from './logger.mjs';
import {
  checkTtsHealth,
  getTtsState,
  proxyTtsStream,
  proxyTtsWav,
  startTtsSupervisor,
  stopTtsSupervisor,
} from './tts-proxy.mjs';

const PORT = Number(process.env.PORT || 8790);
const LLAMA_PORT = Number(process.env.LLAMA_PORT || 8089);
const TTS_URL = process.env.TTS_URL || 'http://127.0.0.1:8000';
const OWNER_EMAIL = (process.env.OWNER_EMAIL || '').toLowerCase().trim();
const MAX_CHAT_CHARS = Number(process.env.MAX_CHAT_CHARS || 64000);
const MAX_TTS_CHARS = Number(process.env.MAX_TTS_CHARS || 12000);

function resolveCustomFavicon() {
  const candidates = [];
  if (process.env.FAVICON_PATH) {
    candidates.push(process.env.FAVICON_PATH.trim());
  }
  try {
    const cfgRaw = fs.readFileSync(path.resolve(process.cwd(), 'models.json'), 'utf8');
    const cfg = JSON.parse(cfgRaw);
    if (typeof cfg.favicon === 'string' && cfg.favicon.trim()) {
      candidates.push(cfg.favicon.trim());
    }
  } catch {
    // ignore
  }
  candidates.push('favicon.svg', 'favicon.png', 'favicon.ico');

  for (const rel of candidates) {
    const abs = path.resolve(process.cwd(), rel);
    try {
      if (fs.existsSync(abs) && fs.statSync(abs).isFile()) {
        const ext = path.extname(abs).toLowerCase();
        const mime =
          ext === '.svg'
            ? 'image/svg+xml'
            : ext === '.png'
              ? 'image/png'
              : ext === '.ico'
                ? 'image/x-icon'
                : 'application/octet-stream';
        return { path: abs, mime, mtimeMs: Math.floor(fs.statSync(abs).mtimeMs) };
      }
    } catch {
      // ignore
    }
  }
  return null;
}

const SITE_URLS = (process.env.SITE_URLS || '')
  .split(',')
  .map((s) => s.trim().replace(/\/+$/, ''))
  .filter(Boolean);

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '*')
  .split(',')
  .map((o) => o.trim().replace(/\/+$/, ''))
  .filter(Boolean);

const llama = new LlamaManager({ llamaPort: LLAMA_PORT });

let detectedFunnelUrl = (process.env.PUBLIC_FUNNEL_URL || '').trim().replace(/\/+$/, '');

function getTailscaleBin() {
  if (process.platform === 'win32') {
    const defaultWin = 'C:\\Program Files\\Tailscale\\tailscale.exe';
    if (fs.existsSync(defaultWin)) return `"${defaultWin}"`;
  }
  return 'tailscale';
}

/**
 * Automatically starts Tailscale Funnel in the background on the active PORT
 * and detects the laptop's current Tailscale DNS / Funnel URL.
 */
function ensureTailscaleFunnelStarted() {
  const bin = getTailscaleBin();
  try {
    execSync(`${bin} funnel --bg --yes ${PORT}`, {
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 8000,
    });
    logger.log('NET', `Tailscale Funnel active on port ${PORT}`);
  } catch (err) {
    const errText = err?.stderr?.toString() || err?.message || '';
    if (errText.includes('listener already exists') || errText.includes('already exists for port 443')) {
      try {
        execSync(`${bin} funnel reset`, { stdio: 'ignore', timeout: 4000 });
        execSync(`${bin} serve reset`, { stdio: 'ignore', timeout: 4000 });
        execSync(`${bin} funnel --bg --yes ${PORT}`, { stdio: 'ignore', timeout: 8000 });
        logger.log('NET', `Tailscale Funnel reset stale listener and activated on port ${PORT}`);
        return;
      } catch {
        // fallback
      }
    }
    if (errText.includes('already') || errText.includes('Funnel is active')) {
      logger.log('NET', `Tailscale Funnel active on port ${PORT}`);
    } else if (errText.includes('not enabled')) {
      logger.log('NET', 'Tailscale Funnel requires activation in your Tailscale Admin Console (tailscale.com/admin/settings/features).');
    } else {
      logger.log('NET', `Tailscale notice: Run 'tailscale funnel reset' then 'tailscale funnel --yes ${PORT}' in PowerShell.`);
    }
  }
}

function detectTailscaleFunnelUrl() {
  if (process.env.PUBLIC_FUNNEL_URL) {
    const parts = process.env.PUBLIC_FUNNEL_URL.split(/[\s,]+/).map((p) => p.trim().replace(/\/+$/, '')).filter(Boolean);
    const httpsPart = parts.find((p) => p.startsWith('https://')) || parts[0];
    if (httpsPart) {
      detectedFunnelUrl = httpsPart;
      return detectedFunnelUrl;
    }
  }
  const bin = getTailscaleBin();
  try {
    const raw = execSync(`${bin} status --json`, {
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 3000,
    }).toString();
    const parsed = JSON.parse(raw);
    const dnsName = parsed?.Self?.DNSName;
    if (typeof dnsName === 'string' && dnsName.trim()) {
      detectedFunnelUrl = `https://${dnsName.trim().replace(/\.$/, '')}`;
    }
  } catch {
    // Keep existing or configured Funnel URL
  }
  return detectedFunnelUrl;
}

/**
 * Outbound Registration: Pushes the laptop's live Funnel URL to the Little Sun web app
 * so even if the Funnel URL changes across sessions, the site routes to it automatically.
 */
let lastLoggedAnnouncedUrl = '';

async function announceGatewayToSites() {
  const url = detectTailscaleFunnelUrl();
  if (!url) {
    logger.log(
      'NET',
      'No Funnel URL detected. Run `tailscale funnel 8790` or configure PUBLIC_FUNNEL_URL in .env.'
    );
    return;
  }
  if (SITE_URLS.length === 0) {
    if (url !== lastLoggedAnnouncedUrl) {
      logger.log(
        'NET',
        `Funnel active at ${url} (add your web app URL to SITE_URLS in .env to auto-sync)`
      );
      lastLoggedAnnouncedUrl = url;
    }
    return;
  }

  let anySuccess = false;
  for (const site of SITE_URLS) {
    try {
      const res = await fetch(`${site}/api/gateway-register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gatewayUrl: url,
          ownerEmail: OWNER_EMAIL,
        }),
        signal: AbortSignal.timeout(4000),
      });
      if (res.ok) {
        anySuccess = true;
      }
    } catch {
      // Site may be sleeping or static host
    }
  }

  if (anySuccess && lastLoggedAnnouncedUrl !== url) {
    lastLoggedAnnouncedUrl = url;
    logger.log('NET', `Funnel active & synced (${url})`);
  }
}

// Per-user rate limit: 30 chat requests per 10 minutes
const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_MAX_REQUESTS = 30;
const userRateMap = new Map();

function checkRateLimit(userId) {
  const now = Date.now();
  const timestamps = (userRateMap.get(userId) || []).filter((t) => now - t < RATE_WINDOW_MS);
  if (timestamps.length >= RATE_MAX_REQUESTS) {
    userRateMap.set(userId, timestamps);
    return false;
  }
  timestamps.push(now);
  userRateMap.set(userId, timestamps);
  return true;
}

function isOriginAllowed(origin) {
  if (!origin) return true;
  if (ALLOWED_ORIGINS.includes('*') || ALLOWED_ORIGINS.length === 0) return true;
  const norm = origin.trim().replace(/\/+$/, '').toLowerCase();
  return ALLOWED_ORIGINS.some((allowed) => {
    const normAllowed = allowed.toLowerCase();
    return normAllowed === norm || normAllowed === '*' || normAllowed === origin.toLowerCase();
  });
}

function applyCors(req, res) {
  const origin = req.headers.origin;
  if (isOriginAllowed(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
    if (origin) {
      res.setHeader('Vary', 'Origin');
    }
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
}

function sendJson(res, status, data) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(JSON.stringify(data));
}

function readJsonBody(req, maxBytes = 65536) {
  return new Promise((resolve, reject) => {
    let total = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      total += chunk.length;
      if (total > maxBytes) {
        req.destroy();
        reject(Object.assign(new Error('Payload too large'), { status: 413 }));
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8');
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        reject(Object.assign(new Error('Invalid JSON'), { status: 400 }));
      }
    });
    req.on('error', reject);
  });
}

function writeSse(res, obj) {
  res.write(`data: ${JSON.stringify(obj)}\n\n`);
}

let isChatBusy = false;

/**
 * Free, zero-API-key live web search via DuckDuckGo HTML scraping.
 * Unblocks real-time search for both Local and Cloud modes.
 */
async function searchDuckDuckGoHtml(query, limit = 8) {
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  const res = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
    },
    signal: AbortSignal.timeout(6000),
  });
  if (!res.ok) {
    throw new Error(`DuckDuckGo returned HTTP ${res.status}`);
  }
  const html = await res.text();
  const titleRegex = /<a[^>]+class="result__a"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
  const snippetRegex = /<a[^>]+class="result__snippet"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;

  const titles = [];
  let tm;
  while ((tm = titleRegex.exec(html)) !== null) {
    let cleanUrl = tm[1];
    if (cleanUrl.includes('uddg=')) {
      const match = cleanUrl.match(/uddg=([^&]+)/);
      if (match) {
        cleanUrl = decodeURIComponent(match[1]);
      }
    }
    const cleanTitle = tm[2]
      .replace(/<[^>]+>/g, '')
      .replace(/&quot;/g, '"')
      .replace(/&#0?39;/g, "'")
      .replace(/&#x27;/g, "'")
      .replace(/&amp;/g, '&')
      .trim();
    titles.push({ title: cleanTitle, url: cleanUrl });
  }

  const snippets = [];
  let sm;
  while ((sm = snippetRegex.exec(html)) !== null) {
    const cleanSnippet = sm[2]
      .replace(/<[^>]+>/g, '')
      .replace(/&quot;/g, '"')
      .replace(/&#0?39;/g, "'")
      .replace(/&#x27;/g, "'")
      .replace(/&amp;/g, '&')
      .trim();
    snippets.push(cleanSnippet);
  }

  const results = [];
  const seenUrls = new Set();
  for (let i = 0; i < titles.length && results.length < limit; i++) {
    const item = titles[i];
    if (!item.url || seenUrls.has(item.url)) continue;
    seenUrls.add(item.url);
    results.push({
      title: item.title,
      snippet: snippets[i] || item.title,
      url: item.url,
    });
  }
  return results;
}

const server = http.createServer(async (req, res) => {
  applyCors(req, res);

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url || '/', `http://${req.headers.host || '127.0.0.1'}`);
  const pathname = url.pathname;
  logger.log('HTTP', `${req.method} ${pathname} (origin=${req.headers.origin || 'none'}, auth=${Boolean(req.headers.authorization)})`);

  // Public health check (includes custom favicon version if present on laptop)
  if (req.method === 'GET' && pathname === '/health') {
    const fav = resolveCustomFavicon();
    sendJson(res, 200, {
      ok: true,
      funnelUrl: detectedFunnelUrl,
      faviconVersion: fav ? fav.mtimeMs : null,
    });
    return;
  }

  // Public custom favicon served directly from laptop gateway folder
  if (req.method === 'GET' && pathname === '/favicon') {
    const fav = resolveCustomFavicon();
    if (!fav) {
      res.writeHead(404);
      res.end();
      return;
    }
    try {
      const buf = fs.readFileSync(fav.path);
      res.writeHead(200, {
        'Content-Type': fav.mime,
        'Cache-Control': 'public, max-age=60',
      });
      res.end(buf);
    } catch {
      res.writeHead(404);
      res.end();
    }
    return;
  }

  // All other routes require Supabase JWT
  let user = null;
  try {
    user = await verifySupabaseToken(req.headers.authorization);
  } catch {
    logger.log('ERR', 'Auth configuration error (check SUPABASE_URL in .env)');
    sendJson(res, 500, { error: 'auth_config_error' });
    return;
  }

  if (!user) {
    sendJson(res, 401, { error: 'unauthorized' });
    return;
  }

  const allowedEmailsRaw = process.env.ALLOWED_EMAILS || '';
  const allowedEmails = allowedEmailsRaw
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  if (allowedEmails.length > 0) {
    const callerEmail = (user.email || '').toLowerCase().trim();
    if (!callerEmail || !allowedEmails.includes(callerEmail)) {
      logger.log('AUTH', `Blocked unauthorized client: ${callerEmail || user.id}`);
      sendJson(res, 403, { error: 'forbidden_client' });
      return;
    }
  }

  if (req.method === 'GET' && pathname === '/status') {
    const ttsOk = await checkTtsHealth(TTS_URL);
    sendJson(res, 200, {
      llm: llama.getStatus(),
      tts: { ok: ttsOk },
    });
    return;
  }

  // Live DuckDuckGo web search endpoint for remote & mobile clients
  if (req.method === 'GET' && pathname === '/search') {
    const q = url.searchParams.get('q');
    const limit = Math.min(12, Math.max(1, Number(url.searchParams.get('limit') || 8)));
    if (!q || !q.trim()) {
      sendJson(res, 400, { error: 'missing_query' });
      return;
    }
    try {
      const results = await searchDuckDuckGoHtml(q.trim(), limit);
      logger.log('NET', `Search: "${q.trim()}" -> ${results.length} result(s)`);
      sendJson(res, 200, { ok: true, results });
    } catch (err) {
      logger.log('ERR', `Search failed: ${err?.message || err}`);
      sendJson(res, 502, { error: 'search_failed', message: err?.message || 'Search failed' });
    }
    return;
  }

  if (req.method === 'GET' && pathname === '/models') {
    sendJson(res, 200, llama.getModelsList());
    return;
  }

  if (req.method === 'POST' && pathname === '/session/switch') {
    try {
      const body = await readJsonBody(req, 4096);
      const nextChatId = typeof body.chatId === 'string' ? body.chatId.trim() : null;
      const action = body.action === 'kill' ? 'kill' : 'sleep';
      await llama.switchChatInstance(nextChatId, { action });
      sendJson(res, 200, { ok: true, activeChatId: llama.activeChatId, state: llama.state });
    } catch {
      sendJson(res, 400, { error: 'invalid_request' });
    }
    return;
  }

  if (req.method === 'POST' && pathname === '/tts') {
    try {
      const body = await readJsonBody(req, MAX_TTS_CHARS * 2);
      const text = typeof body.text === 'string' ? body.text.trim() : '';
      if (!text) {
        sendJson(res, 400, { error: 'empty_text' });
        return;
      }
      if (text.length > MAX_TTS_CHARS) {
        sendJson(res, 413, { error: 'text_too_long' });
        return;
      }
      await proxyTtsWav(TTS_URL, { text, voice: body.voice }, req, res);
    } catch (err) {
      sendJson(res, err.status || 400, { error: 'invalid_request' });
    }
    return;
  }

  if (req.method === 'POST' && pathname === '/tts/stream') {
    try {
      const body = await readJsonBody(req, MAX_TTS_CHARS * 2);
      const text = typeof body.text === 'string' ? body.text.trim() : '';
      if (!text) {
        sendJson(res, 400, { error: 'empty_text' });
        return;
      }
      if (text.length > MAX_TTS_CHARS) {
        sendJson(res, 413, { error: 'text_too_long' });
        return;
      }
      await proxyTtsStream(TTS_URL, { text, voice: body.voice }, req, res);
    } catch (err) {
      sendJson(res, err.status || 400, { error: 'invalid_request' });
    }
    return;
  }

  if (req.method === 'POST' && pathname === '/chat') {
    if (!checkRateLimit(user.id)) {
      logger.log('AUTH', `Rate limit reached for user ${user.id.slice(0, 8)}`);
      sendJson(res, 429, { error: 'rate_limit_exceeded' });
      return;
    }

    if (isChatBusy || llama.state === 'processing' || llama.state === 'loading') {
      sendJson(res, 429, { error: 'busy' });
      return;
    }

    let body;
    try {
      body = await readJsonBody(req, MAX_CHAT_CHARS * 2);
    } catch (err) {
      sendJson(res, err.status || 400, { error: 'invalid_request' });
      return;
    }

    const rawMessages = Array.isArray(body.messages) ? body.messages : [];
    const sanitizedMessages = rawMessages
      .filter((m) => m && (m.role === 'user' || m.role === 'assistant' || m.role === 'system') && typeof m.content === 'string')
      .map((m) => ({ role: m.role, content: m.content }));

    const totalChars = sanitizedMessages.reduce((acc, m) => acc + m.content.length, 0);
    if (totalChars > MAX_CHAT_CHARS) {
      sendJson(res, 413, { error: 'chat_too_large' });
      return;
    }

    if (sanitizedMessages.length === 0) {
      sendJson(res, 400, { error: 'empty_messages' });
      return;
    }

    isChatBusy = true;
    const upstreamAbort = new AbortController();
    let clientClosed = false;

    res.on('close', () => {
      if (!res.writableEnded) {
        clientClosed = true;
        upstreamAbort.abort();
      }
    });

    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      Connection: 'keep-alive',
    });

    const genStart = Date.now();
    const chatId = typeof body.chatId === 'string' ? body.chatId.trim() : null;
    logger.log(
      'LLM',
      `Chat stream started (model=${body.model || 'default'}, chat=${(chatId || 'new').slice(0, 8)}, context_msgs=${sanitizedMessages.length})`
    );

    try {
      const modelCfg = await llama.ensureLoaded(
        body.model,
        () => {
          if (!clientClosed) {
            writeSse(res, { type: 'status', state: 'loading_model' });
          }
        },
        chatId
      );

      if (clientClosed) {
        llama.finishProcessing();
        isChatBusy = false;
        res.end();
        return;
      }

      llama.beginProcessing();
      writeSse(res, { type: 'status', state: 'generating' });

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

      const userProvidedSystem = sanitizedMessages
        .filter((m) => m.role === 'system')
        .map((m) => m.content)
        .join('\n\n');
      const chatMessages = sanitizedMessages.filter((m) => m.role !== 'system');

      const dynamicSystemPrompt = [
        modelCfg.systemPrompt,
        userProvidedSystem,
        `Today's date is ${dateStr}. Local time is ${timeStr}.`,
      ].filter(Boolean).join('\n\n');

      const upstreamMessages = [
        { role: 'system', content: dynamicSystemPrompt },
        ...chatMessages,
      ];

      const upstreamRes = await fetch(`http://127.0.0.1:${LLAMA_PORT}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: upstreamMessages,
          stream: true,
          temperature: modelCfg.temperature ?? 0.7,
          max_tokens: modelCfg.maxTokens ?? 4096,
          repeat_penalty: 1.18,
          presence_penalty: 0.15,
          frequency_penalty: 0.1,
        }),
        signal: upstreamAbort.signal,
      });

      if (!upstreamRes.ok || !upstreamRes.body) {
        logger.log('ERR', `llama-server returned HTTP ${upstreamRes.status}`);
        writeSse(res, { type: 'error', message: 'Model generation failed.' });
        res.end();
        return;
      }

      const reader = upstreamRes.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let tokenCount = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data:')) continue;
          const payloadStr = trimmed.slice(5).trim();
          if (!payloadStr || payloadStr === '[DONE]') continue;
          try {
            const parsed = JSON.parse(payloadStr);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (typeof delta === 'string' && delta.length > 0) {
              tokenCount += 1;
              writeSse(res, { type: 'token', text: delta });
            }
          } catch {
            // Ignore malformed SSE chunks
          }
        }
      }

      const genElapsed = ((Date.now() - genStart) / 1000).toFixed(1);
      logger.log(
        'LLM',
        `Chat stream completed (model=${modelCfg.name}, tokens=${tokenCount}, duration=${genElapsed}s)`
      );

      if (!clientClosed) {
        writeSse(res, { type: 'done', tokens: tokenCount });
      }
      res.end();
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Generation interrupted or failed.';
      logger.log('ERR', `Chat stream interrupted: ${errMsg}`);
      if (!clientClosed) {
        writeSse(res, { type: 'error', message: errMsg });
        res.end();
      }
    } finally {
      llama.finishProcessing();
      isChatBusy = false;
    }
    return;
  }

  sendJson(res, 404, { error: 'not_found' });
});

const dashboard = new CliDashboard({
  getState: () => ({
    gatewayPort: PORT,
    llamaPort: LLAMA_PORT,
    ttsUrl: TTS_URL,
    funnelUrl: detectedFunnelUrl,
    ttsState: getTtsState(),
    llm: llama.getStatus(),
  }),
});

server.listen(PORT, '0.0.0.0', async () => {
  logger.log('SYS', `Gateway listening on http://0.0.0.0:${PORT} (all interfaces)`);
  const initialModels = llama.getModelsList().filter((m) => m.available);
  if (initialModels.length > 0) {
    logger.log(
      'LLM',
      `Detected ${initialModels.length} GGUF model(s): ${initialModels.map((m) => m.name).join(', ')}`
    );
  } else {
    logger.log('LLM', 'No .gguf models in models/ yet — watching models/ for new files');
  }
  dashboard.start();
  ensureTailscaleFunnelStarted();
  await startTtsSupervisor(TTS_URL);
  await announceGatewayToSites();
  setInterval(announceGatewayToSites, 60_000);
});

const cleanShutdown = async () => {
  logger.log('SYS', 'Shutting down supervised services...');
  dashboard.stop();
  stopTtsSupervisor();
  await llama.unload();
  process.exit(0);
};

process.on('SIGINT', cleanShutdown);
process.on('SIGTERM', cleanShutdown);
