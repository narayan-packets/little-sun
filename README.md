# Little Sun ☀️ — v2.3 Stable Last (Private & Development Edition)

> **A sovereign, minimal, and editorial personal intelligence interface connecting local hardware inference, neural voice, zero-API-key web search, and hybrid cloud models.**

[![Version: 2.3.0](https://img.shields.io/badge/Version-2.3.0_Stable_Last-orange.svg)]()
[![React 19](https://img.shields.io/badge/React-19.0-blue.svg)](https://react.dev/)
[![Tailwind CSS 4](https://img.shields.io/badge/Tailwind-4.x-38bdf8.svg)](https://tailwindcss.com/)
[![Vite 8](https://img.shields.io/badge/Vite-8.x-purple.svg)](https://vitejs.dev/)
[![Inference: llama.cpp](https://img.shields.io/badge/Inference-llama.cpp_GGUF-emerald.svg)](https://github.com/ggerganov/llama.cpp)
[![Network: Tailscale Funnel](https://img.shields.io/badge/Network-Tailscale_Funnel-blue.svg)](https://tailscale.com/)
[![Supabase: Realtime & RLS](https://img.shields.io/badge/Backend-Supabase_Postgres-3ecf8e.svg)](https://supabase.com/)

---

## 📖 Architecture & System Flow

```
┌────────────────────────────────────────────────────────────────────────┐
│                   Little Sun Web Client (React 19)                    │
│   • Editorial typography, dark & light warm solar palettes             │
│   • Multi-format 1-click file generation (.doc, .csv, .srt, code)     │
│   • KaTeX LaTeX math rendering (inline $...$ & block $$...$$)          │
│   • Zero-API-Key Live Web Search (DuckDuckGo + Wikipedia + Algolia)    │
│   • Realtime cross-device sync & persistent cross-model Memory         │
│   • Minimal mobile bottom-sheet & desktop DeleteConfirmDialog         │
└───────────────┬───────────────────┬────────────────────┬───────────────┘
                │                   │                    │
    Supabase Auth & Realtime        │          Tailscale Funnel (HTTPS:8790)
    (Chats, Messages, Memories)     │          (Local GGUF, Kokoro TTS)
                │                   │                    │
                ▼                   ▼                    ▼
┌───────────────────────────────┐ ┌───────────────┐ ┌────────────────────┐
│       Supabase Postgres       │ │ Cloud LLM API │ │ little-sun-gateway │
│   • Row-Level Security (RLS)  │ │ • OpenRouter  │ │ • Node.js (8790)   │
│   • Realtime publication sync │ │ • Groq / xAI  │ │ • llama-server GGUF│
│   • 'chat-uploads' 1-hr TTL   │ │ • Anthropic   │ │ • Piper/Kokoro TTS │
│   • 'memories' user memory    │ │ • OpenAI/OAI  │ │ • DuckDuckGo Proxy │
└───────────────────────────────┘ └───────────────┘ └────────────────────┘
```

---

## ⚡ What's New in v2.3 Stable Last

1. **Voice-Style Minimal Model Selection**:
   - Both Gateway Local Models and Cloud API Models styled as clean, single-row pills matching the Voice selection UI.
   - Smooth active state with checkmark (`✓`) feedback and zero visual clutter.

2. **Custom Minimalist DeleteConfirmDialog**:
   - Replaced browser-default `window.confirm` with a unified modal/drawer dialog.
   - **Mobile**: Ergonomic bottom sheet with 48px touch targets and safe-area inset protection.
   - **Desktop**: Centered card with backdrop blur and safe cancel auto-focus.
   - Covers: Chat deletion, Clear All Memories, Single Memory deletion, and Unlinking API keys.

3. **Dynamic Web Search Source Counter**:
   - Shows the exact number of distinct sources retrieved (e.g. `Sources (1)`, `Sources (5)`, `Sources (8)`) rather than an artificial cap.

4. **Multi-Format Text & Document File Generation**:
   - Assistant outputs interactive download cards for `.doc`, `.csv`, `.srt`, `.md`, `.txt`, and code files via ````file:<filename>.<ext>`` blocks.
   - Automatically normalizes impossible binary requests (`.docx` -> `.doc`, `.xlsx` -> `.csv`).

5. **Temporal Grounding & Night-Aware Greetings**:
   - Precise system clock injection prevents temporal hallucinations.
   - Dedicated night greeting window (`21:00` to `04:59`) ensuring accurate "Night" greetings instead of evening.

---

## 🛠️ Environment Configuration

### Frontend (`.env`)
```bash
# Supabase Backend
VITE_SUPABASE_URL="https://<project-ref>.supabase.co"
VITE_SUPABASE_ANON_KEY="<anon-key>"

# Tailscale Funnel Gateway Endpoint (Port 8790 HTTPS)
VITE_GATEWAY_URL="https://<your-device>.<tailnet>.ts.net"
```

### Gateway Server (`little-sun-gateway/.env`)
```bash
PORT=8790
HOST=0.0.0.0
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
OWNER_EMAIL=owner@example.com
ALLOWED_EMAILS=owner@example.com
```

---

## 🔍 Comprehensive Troubleshooting & Known Quirks

### 1. File Creation & Model Refusal
- **Symptom**: Model responds *"As an AI assistant, I can't create or save files on your device."*
- **Cause**: LLMs (especially smaller quantized models like Llama 3 8B or Qwen 7B) have strong RLHF alignment discouraging them from claiming they have OS filesystem access.
- **Fix**: The client renders files dynamically from markdown code blocks tagged ````file:<filename>.<ext>``. In v2.3, the system prompt explicitly instructs models:
  ```
  Never claim you cannot create files; you have full capability to generate downloadable text and data files directly using ```file:<filename>.<ext> blocks.
  ```
- **Binary formats**: Browser client creates text blobs. If a user asks for `.docx` or `.xlsx`, the client automatically rewrites the download name to `.doc` or `.csv` so native applications open them without corruption.

### 2. Web Search Rate Limits & Temporal Hallucinations
- **Symptom**: Model thinks today's year is 2023 or 2024, or DuckDuckGo searches stop returning results.
- **Cause**: Training cutoff dates anchor models in the past. Free search engines also enforce rate limits against rapid consecutive scrapes.
- **Fix**:
  - `isTemporalQuery` catches questions like "What day is today?" or "Current time" and bypasses web search, feeding the device's clock directly.
  - Client enforces a sliding window (max 8 searches/minute) with a visual cooldown countdown timer.
  - Gateway proxy (`GET /search?q=...`) provides a server-side DuckDuckGo fallback when browser CORS blocks direct requests.

### 3. Gateway & Tailscale Funnel Sleep States
- **Symptom**: Web client shows "Standby" or "Offline" status on mobile.
- **Cause**: The host laptop entered Windows modern standby or switched Wi-Fi networks, temporarily disconnecting Tailscale Funnel.
- **Fix**:
  - In Settings -> Gateway, click **Test & Reconnect**.
  - In Windows Power Options, set "Put computer to sleep" to "Never" when plugged in, or use a background keep-awake script.
  - HTTPS is mandatory: Browsers block unencrypted HTTP connections from HTTPS web apps. Always use `https://<device>.<tailnet>.ts.net`.

### 4. Supabase Inactivity Pause
- **Symptom**: Login or chat sync fails with HTTP 503 after several days of inactivity.
- **Cause**: Free-tier Supabase projects automatically pause after 7 days without queries.
- **Fix**: The repository includes `.github/workflows/supabase-keepalive.yml` which pings the Supabase REST API every 3 days via GitHub Actions.

---

## 🚀 Running Locally

```bash
# Install frontend dependencies
npm install

# Run frontend development server (Vite + Express)
npm run dev

# Run gateway (in another terminal or C:\little-sun-gateway)
cd little-sun-gateway
node server.mjs
```

---

## 📜 Supabase Database Schema

The complete, idempotent SQL schema is maintained at [`supabase/schema.sql`](file:///c:/little-sun-main/supabase/schema.sql). It can be pasted directly into the Supabase SQL Editor.
