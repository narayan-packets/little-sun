import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';

const PORT = Number(process.env.PORT || 3000);
const STATE_FILE = path.resolve(process.cwd(), '.gateway-target.json');
const DEFAULT_GATEWAY_URL = (
  process.env.VITE_GATEWAY_URL ||
  process.env.GATEWAY_URL ||
  'http://127.0.0.1:8790'
)
  .trim()
  .replace(/\/+$/, '');

let activeGatewayUrl = DEFAULT_GATEWAY_URL;

try {
  if (fs.existsSync(STATE_FILE)) {
    const saved = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    if (saved?.gatewayUrl && typeof saved.gatewayUrl === 'string') {
      activeGatewayUrl = saved.gatewayUrl.trim().replace(/\/+$/, '');
    }
  }
} catch {
  // use default
}

async function startServer() {
  const app = express();

  // Receive outbound registration from the laptop's Little Sun Gateway or browser settings
  app.post('/api/gateway-register', express.json(), (req, res) => {
    const rawUrl = typeof req.body?.gatewayUrl === 'string' ? req.body.gatewayUrl.trim() : '';
    if (
      !rawUrl ||
      (!rawUrl.startsWith('https://') &&
        !rawUrl.startsWith('http://localhost') &&
        !rawUrl.startsWith('http://127.0.0.1'))
    ) {
      res.status(400).json({ error: 'invalid_gateway_url' });
      return;
    }
    activeGatewayUrl = rawUrl.replace(/\/+$/, '');
    try {
      fs.writeFileSync(
        STATE_FILE,
        JSON.stringify({ gatewayUrl: activeGatewayUrl, updatedAt: new Date().toISOString() }),
        'utf8'
      );
    } catch {
      // ignore
    }
    res.json({ ok: true, activeGatewayUrl });
  });

  app.get('/api/gateway-status', async (_req, res) => {
    let reachable = false;
    let latencyMs = 0;
    try {
      const start = Date.now();
      const check = await fetch(`${activeGatewayUrl}/health`, { signal: AbortSignal.timeout(3500) });
      reachable = check.ok;
      latencyMs = Date.now() - start;
    } catch {
      reachable = false;
    }
    res.json({ ok: true, activeGatewayUrl, reachable, latencyMs });
  });

  // Streaming reverse proxy to the active laptop gateway (/gateway-proxy/*)
  app.use('/gateway-proxy', express.raw({ type: '*/*', limit: '50mb' }), async (req, res) => {
    const subPath = req.url || '/';
    const targetUrl = `${activeGatewayUrl}${subPath}`;

    const abortController = new AbortController();
    res.on('close', () => {
      if (!res.writableEnded) {
        abortController.abort();
      }
    });

    const isFastProbe = subPath === '/health' || subPath.startsWith('/health');
    const probeTimeout = setTimeout(
      () => {
        abortController.abort();
      },
      isFastProbe ? 4000 : 30000
    );

    try {
      const headers: Record<string, string> = {};
      if (req.headers.authorization) {
        headers['Authorization'] = String(req.headers.authorization);
      }
      if (req.headers['content-type']) {
        headers['Content-Type'] = String(req.headers['content-type']);
      }

      const hasBody =
        req.method !== 'GET' &&
        req.method !== 'HEAD' &&
        Buffer.isBuffer(req.body) &&
        req.body.length > 0;

      let upstream: Response;
      try {
        upstream = await fetch(targetUrl, {
          method: req.method,
          headers,
          body: hasBody ? req.body : undefined,
          signal: abortController.signal,
        });
      } finally {
        clearTimeout(probeTimeout);
      }

      res.status(upstream.status);

      const contentType = upstream.headers.get('content-type');
      if (contentType) {
        res.setHeader('Content-Type', contentType);
      }
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('X-Accel-Buffering', 'no');

      if (!upstream.body) {
        res.end();
        return;
      }

      // Stream chunks immediately without buffering (critical for SSE /chat and /tts/stream)
      const reader = upstream.body.getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          res.write(Buffer.from(value));
        }
      } finally {
        try {
          await reader.cancel();
        } catch {
          // ignore stream close error
        }
      }
      res.end();
    } catch {
      clearTimeout(probeTimeout);
      if (!res.headersSent) {
        res.status(502).json({ error: 'gateway_unreachable' });
      } else if (!res.writableEnded) {
        res.end();
      }
    }
  });

  // Global Express error handler for payload limits and unexpected exceptions
  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (err?.type === 'entity.too.large') {
      res.status(413).json({ error: 'payload_too_large', message: 'Attachment exceeds maximum size limit (50MB)' });
      return;
    }
    if (!res.headersSent) {
      res.status(err?.status || 500).json({ error: err?.message || 'internal_server_error' });
    }
  });

  if (process.env.NODE_ENV === 'production') {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Little Sun server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
