# Little Sun ☀️ — v3.0 (Sovereign Multimodal Edition)

> **A sovereign, minimal, and editorial personal intelligence interface connecting local hardware inference (Ollama & llama.cpp), multimodal vision & audio pipelines, neural text-to-speech, zero-API-key web search, and hybrid cloud models.**

[![Version: 3.0.0](https://img.shields.io/badge/Version-3.0.0_V.3-orange.svg)]()
[![React 19](https://img.shields.io/badge/React-19.0-blue.svg)](https://react.dev/)
[![Tailwind CSS 4](https://img.shields.io/badge/Tailwind-4.x-38bdf8.svg)](https://tailwindcss.com/)
[![Vite 8](https://img.shields.io/badge/Vite-8.x-purple.svg)](https://vitejs.dev/)
[![Inference: Ollama & llama.cpp](https://img.shields.io/badge/Inference-Ollama_%26_llama.cpp-emerald.svg)](https://ollama.com/)
[![Network: Tailscale Funnel](https://img.shields.io/badge/Network-Tailscale_Funnel-blue.svg)](https://tailscale.com/)
[![Backend: Supabase](https://img.shields.io/badge/Backend-Supabase_Postgres-3ecf8e.svg)](https://supabase.com/)

---

## 📖 Architecture & System Flow

```
┌────────────────────────────────────────────────────────────────────────┐
│                   Little Sun Web Client (React 19)                     │
│   • Editorial typography, dark & light warm solar palettes             │
│   • Multimodal media composer: Images, Audio waveforms, Code, Docs     │
│   • Multi-format 1-click file generation (.doc, .csv, .srt, code)      │
│   • KaTeX LaTeX math rendering (inline $...$ & block $$...$$)          │
│   • Zero-API-Key Live Web Search (DuckDuckGo + Wikipedia + Algolia)    │
│   • Realtime cross-device sync & persistent cross-model Memory         │
│   • Minimal mobile bottom-sheet & desktop sub-settings navigation      │
└───────────────┬───────────────────┬────────────────────┬───────────────┘
                │                   │                    │
    Supabase Auth & Storage         │          Tailscale Funnel (HTTPS:8790)
    (Chats, RLS, 1-hr TTL uploads)  │          (Local Models, TTS, Search)
                │                   │                    │
                ▼                   ▼                    ▼
┌───────────────────────────────┐ ┌───────────────┐ ┌───────────────────────────────┐
│       Supabase Postgres       │ │ Cloud LLM API │ │      little-sun-gateway       │
│   • Row-Level Security (RLS)  │ │ • OpenRouter  │ │ • Node.js Supervisor (8790)  │
│   • Realtime publication sync │ │ • Groq / xAI  │ │ • Ollama Server (11434)       │
│   • 'chat-uploads' storage    │ │ • Anthropic   │ │ • llama-server GGUF (8089)    │
│   • 'memories' user memory    │ │ • OpenAI/OAI  │ │ • Pocket TTS / Kokoro (8000)  │
│   • Ephemeral TTL cleanup     │ │               │ │ • 50MB Body Limits & FFmpeg   │
└───────────────────────────────┘ └───────────────┘ └───────────────────────────────┘
                                                         │
                                    ┌────────────────────┴────────────────────┐
                                    ▼                                         ▼
                        ┌───────────────────────┐                 ┌───────────────────────┐
                        │   Ollama Backend      │                 │   Llama.cpp Backend   │
                        │ • Dynamic /api/show   │                 │ • GGUF + --mmproj     │
                        │ • Streaming NDJSON    │                 │ • OpenAI /v1 format   │
                        │ • Gemma 4 / Qwen /    │                 │ • Standalone fallback │
                        │   LLaVA with mmproj   │                 │ • On-demand loading   │
                        └───────────────────────┘                 └───────────────────────┘
```

---

## ⚡ What's New in v3.0

1. **Extensible Multimodal Ingestion Pipeline**:
   - Model-agnostic media preprocessing adapter pipeline for **Images**, **Audio**, and **Text Documents**.
   - Automatic image normalization: Auto-orients EXIF, caps resolution dimensions via FFmpeg to prevent context blowup, and encodes directly into Base64 for Ollama's `images` array.
   - Automatic audio normalization: Enforces Gemma 4's $\le$ 30-second duration envelope, resamples to 16 kHz mono WAV via FFmpeg, and automatically splits longer audio files into sequential chunks.
   - Text documents (`.py`, `.js`, `.json`, `.txt`, `.md`, etc.) are read as UTF-8 and cleanly injected into prompt markdown context.

2. **Multimodal Projector (`mmproj`) Automation**:
   - Gemma 4 and other vision models require an accompanying `mmproj` (multimodal projector) GGUF to process image tensors.
   - `llama-manager.mjs` intelligently auto-discovers and links matching `mmproj` files without polluting the chat model dropdown.
   - Dedicated `download_projector.mjs` utility to inspect, download, and register projectors for Gemma 4 (E2B / E4B), Qwen 2/2.5-VL, LLaVA 1.6, and MiniCPM-V.

3. **50MB Gateway Body Limits & Ephemeral Cleanup**:
   - Raised body payload limit from 128KB to 50MB (`MAX_CHAT_PAYLOAD_BYTES = 50 * 1024 * 1024`) so high-resolution multimodal payloads are never truncated.
   - Deterministic ephemeral cleanup via `TempTracker`: downloaded and resampled temporary media are instantly removed from local disk upon generation completion or error.

4. **Dynamic Model Capability Detection**:
   - Gateway dynamically queries Ollama's `/api/show` endpoint to inspect model capabilities (`vision`, `audio`, `thinking`, `tools`) and formats payloads accordingly.
   - Clean, friendly error feedback if non-convertible media is submitted to a text-only model.

---

## 🚀 Complete Setup Guide (From Scratch to Finish Line)

### Step 1: System Prerequisites
Ensure the following tools are installed on your host system:
1. **Node.js 20+ & npm**: [Download Node.js](https://nodejs.org/)
2. **Git**: [Download Git](https://git-scm.com/)
3. **FFmpeg & FFprobe**: Required for audio resampling (16 kHz mono) and image normalization.
   - *Windows (via winget)*: `winget install Gyan.FFmpeg`
   - *Verify in terminal*: `ffmpeg -version` and `ffprobe -version`
4. **Tailscale**: Required for secure HTTPS cross-device synchronization via Tailscale Funnel.
   - [Download Tailscale](https://tailscale.com/download)

---

### Step 2: Ollama Setup & Multimodal Models
1. **Install Ollama**:
   - [Download Ollama for Windows / macOS / Linux](https://ollama.com/download)
2. **Start Ollama Serve**:
   - Open a terminal and run:
     ```bash
     ollama serve
     ```
   - Verify Ollama is listening at `http://127.0.0.1:11434`.
3. **Configure Multimodal Models with `mmproj`**:
   - Multimodal models in GGUF format require both the base model weights and the multimodal projector file (`mmproj`).
   - Run the included Little Sun projector manager:
     ```bash
     cd little-sun-gateway
     node download_projector.mjs list
     ```
   - Download the projector for your model (e.g. Gemma 4 E4B):
     ```bash
     node download_projector.mjs download gemma4-e4b
     ```
   - This downloads `mmproj-gemma-4-E4B.gguf` into `models/` and automatically creates the multimodal model in Ollama:
     ```dockerfile
     FROM C:\little-sun-gateway\models\gemma-4-E4B-it-Q4_K_M.gguf
     FROM C:\little-sun-gateway\models\mmproj-gemma-4-E4B.gguf
     TEMPLATE {{ .Prompt }}
     RENDERER gemma4
     PARSER gemma4
     PARAMETER stop <turn|>
     ```

---

### Step 3: Neural Voice (Pocket TTS) Setup
1. **Install Python 3.10+**: Ensure Python is available on your PATH.
2. **Install Pocket TTS**:
   ```bash
   pip install pocket-tts
   ```
3. **Run Pocket TTS Server**:
   ```bash
   python -m pocket_tts serve --port 8000
   ```
   *(Note: The Little Sun Gateway automatically supervisor-monitors port 8000 and auto-spawns Pocket TTS if it drops).*

---

### Step 4: Supabase Backend Setup
1. Create a free project at [supabase.com](https://supabase.com).
2. Go to the **SQL Editor** in Supabase and paste the contents of [`supabase/schema.sql`](file:///c:/little-sun-main/supabase/schema.sql). Click **Run**.
   - This creates tables for `chats`, `messages`, `memories`, user profiles, and enables Row-Level Security (RLS).
3. Under **Storage**, create a public bucket named `chat-uploads`.
   - Set file size limits to 50MB.
   - Configure a 1-hour expiration policy (or use the included server-side ephemeral deletion).
4. Note your **Project URL**, **Anon Key**, and **Service Role Key** under **Project Settings -> API**.

---

### Step 5: Gateway Server Configuration
1. Navigate to the gateway directory:
   ```bash
   cd little-sun-gateway
   npm install
   ```
2. Create `little-sun-gateway/.env`:
   ```env
   PORT=8790
   HOST=0.0.0.0
   OLLAMA_URL=http://127.0.0.1:11434
   TTS_URL=http://127.0.0.1:8000
   SUPABASE_URL=https://<your-project>.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
   OWNER_EMAIL=your-email@example.com
   ALLOWED_EMAILS=your-email@example.com
   PUBLIC_FUNNEL_URL=https://<your-device>.<tailnet>.ts.net
   MAX_CHAT_PAYLOAD_BYTES=52428800
   ```
3. Enable Tailscale Funnel:
   ```bash
   tailscale funnel --bg --yes 8790
   ```
4. Start the Gateway:
   ```bash
   node server.mjs
   ```

---

### Step 6: Web Client Setup & Deployment
1. Navigate to the main application directory:
   ```bash
   cd little-sun-main
   npm install
   ```
2. Create `.env` in the root:
   ```env
   VITE_SUPABASE_URL=https://<your-project>.supabase.co
   VITE_SUPABASE_ANON_KEY=<your-anon-key>
   VITE_GATEWAY_URL=https://<your-device>.<tailnet>.ts.net
   ```
3. Run locally:
   ```bash
   npm run dev
   ```
4. Build for production (Vercel / Cloudflare Pages / Netlify):
   ```bash
   npm run build
   ```

---

## 🔍 Comprehensive Troubleshooting & Known Quirks

### 1. Multimodal: "Model does not support multimodal requests"
- **Symptom**: Ollama returns HTTP 400 with `"Multimodal data provided, but model does not support multimodal requests."`
- **Cause**: The GGUF loaded contains text weights only and lacks the companion multimodal projector (`mmproj`).
- **Fix**:
  1. Run `node download_projector.mjs download <model-key>` (e.g. `gemma4-e4b` or `gemma4-e2b`).
  2. Verify Ollama capabilities via `Invoke-RestMethod -Uri "http://127.0.0.1:11434/api/show" -Method Post -Body '{"name": "gemma4:e4b"}' -ContentType "application/json"`. The `capabilities` array must include `"vision"`.

### 2. Audio Exits or Crashes Runner
- **Symptom**: `llama-server exited before becoming ready` when uploading audio.
- **Cause**: Gemma 4 has a strict 30-second audio duration envelope and requires 16 kHz mono WAV encoding. Passing long stereo MP3s or FLAC files causes context overflows or runner termination.
- **Fix**:
  - The Gateway's `MediaPreprocessor` automatically probes duration via `ffprobe`, resamples to 16 kHz mono WAV via `ffmpeg`, and chunks files exceeding 30s into sequential segments.
  - For transcription-only models (like Whisper Medium), use the dedicated `sun-audio` model.

### 3. Gateway Offline on Mobile / Tailscale Funnel Standby
- **Symptom**: Web client shows "Standby" or "Offline" status on mobile.
- **Cause**: Windows Modern Standby puts network interfaces into sleep mode when on battery, or Wi-Fi reconnects under a new IP.
- **Fix**:
  1. In Windows Power Options, set "Put computer to sleep" to **Never** when plugged in.
  2. In Little Sun Settings -> Gateway, click **Save & Connect** to re-verify handshake.
  3. Ensure Tailscale Funnel is running in background: `tailscale funnel --bg --yes 8790`.

### 4. Supabase 7-Day Inactivity Pause
- **Symptom**: Login or chat sync fails with HTTP 503 after several days of inactivity.
- **Cause**: Supabase free-tier projects pause after 7 consecutive days without API queries.
- **Fix**: The repository includes `.github/workflows/supabase-keepalive.yml` which automatically executes a scheduled ping to keep your project active.

### 5. CORS or Mixed Content Warning
- **Symptom**: Browser console logs `Mixed Content: The page at 'https://...' was loaded over HTTPS, but requested an insecure resource 'http://127.0.0.1:8790'`.
- **Cause**: Browsers block unencrypted HTTP loopback calls from HTTPS origins.
- **Fix**: Connect using your HTTPS Tailscale Funnel endpoint (`https://<device>.<tailnet>.ts.net`) rather than raw `http://`.

---

## 📜 Directory Structure

```
little-sun/
├── little-sun-gateway/          # Local AI Gateway & Supervisor
│   ├── adapters/
│   │   ├── backend-adapters.mjs # Ollama & llama.cpp decoupled streaming adapters
│   │   ├── media-preprocessor.mjs # Image/Audio normalization & chunking
│   │   └── model-registry.mjs   # Dynamic capability detection & envelopes
│   ├── models/                  # Local GGUFs and companion mmproj files
│   ├── auth.mjs                 # Supabase JWT authentication
│   ├── download_projector.mjs   # Multimodal projector manager & downloader
│   ├── llama-manager.mjs        # Process supervisor for llama-server
│   ├── logger.mjs               # Clean timestamped system logging
│   ├── models.json              # Active local models registry
│   ├── server.mjs               # HTTP/SSE Gateway server (50MB limit)
│   └── tts-proxy.mjs            # Pocket TTS supervisor & audio proxy
├── src/                         # React 19 Frontend Web Client
│   ├── components/              # Chat, Composer, Settings, Dialogs
│   ├── lib/                     # Gateway client, Supabase, Web search
│   └── pages/                   # Chat and Settings views
├── supabase/
│   └── schema.sql               # Complete idempotent SQL database schema
├── package.json                 # v3.0.0
└── README.md                    # System documentation & setup guide
```
