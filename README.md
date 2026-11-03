# Little Sun ☀️ (v1.7)

> **A warm, private, editorial intelligence interface connecting to your personal local LLM, neural voice engine, and hybrid cloud providers.**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Version: 1.7.0](https://img.shields.io/badge/Version-1.7.0-orange.svg)]()
[![React 19](https://img.shields.io/badge/React-19.0-blue.svg)](https://react.dev/)
[![Tailwind CSS 4](https://img.shields.io/badge/Tailwind-4.x-38bdf8.svg)](https://tailwindcss.com/)
[![Vite 8](https://img.shields.io/badge/Vite-8.x-purple.svg)](https://vitejs.dev/)
[![Local LLMs](https://img.shields.io/badge/Inference-llama.cpp_GGUF-emerald.svg)](https://github.com/ggerganov/llama.cpp)
[![Tailscale](https://img.shields.io/badge/Network-Tailscale_Funnel-blue.svg)](https://tailscale.com/)

---

## Overview

**Little Sun** pairs an elegant, distraction-free web client with your own laptop's local inference gateway (`little-sun-gateway`). Powered by [`llama.cpp`](https://github.com/ggerganov/llama.cpp) for sovereign GGUF intelligence and [`piper-tts`](https://github.com/rhasspy/piper) for natural neural voice streaming, your conversations, prompts, and model weights remain completely under your control.

In **V1.7**, Little Sun introduces **Hybrid Intelligence**: seamless toggling between private Local Hardware LLMs and Cloud API Providers (OpenRouter, Groq, xAI Groq, Hugging Face, OpenAI, or any custom OpenAI-compatible endpoint). It also adds **Zero-API-Key Live Web Search**, **Ephemeral Document & Image Uploads with 1-hour expiration**, and an **editorial, balanced composer** optimized for desktop and mobile.

---

## Architecture

```text
┌────────────────────────────────────────────────────────────────────────┐
│                          Web Client (React 19)                         │
│   • Editorial typography, dark & light warm solar palettes             │
│   • Symmetrical composer with 3-dot options menu & multi-line expansion│
│   • KaTeX, interactive 2D function visualizer, & multimodal players    │
│   • Zero-API-Key Live Web Search (DuckDuckGo, Wikipedia, Algolia)      │
│   • Ephemeral attachment upload (<30 MB) with 1-hour auto-expiration   │
└───────────────┬───────────────────┬────────────────────┬───────────────┘
                │                   │                    │
    Supabase Auth & Realtime        │          Tailscale Funnel (HTTPS)
    (Chats, Messages, Uploads)      │          (Local GGUF, Piper TTS)
                │                   │                    │
                ▼                   ▼                    ▼
┌───────────────────────────────┐ ┌───────────────┐ ┌────────────────────┐
│       Supabase Postgres       │ │ Cloud LLM API │ │ little-sun-gateway │
│   • Row-Level Security (RLS)  │ │ • OpenRouter  │ │ • Node.js (8790)   │
│   • Realtime publication sync │ │ • Groq / xAI  │ │ • llama-server GGUF│
│   • 'chat-uploads' 1-hr TTL   │ │ • Hugging Face│ │ • Piper TTS engine │
│   • Private user auth         │ │ • OpenAI / OAI│ │ • Temporal context │
└───────────────────────────────┘ └───────────────┘ └────────────────────┘
```

---

## Highlights in V1.7

- 🌐 **Zero-API-Key Multi-Engine Web Search**:
  - Live search without requiring API keys or subscriptions.
  - Aggregates DuckDuckGo Instant Answers, Wikipedia REST API, and Algolia Live API.
  - **Temporal Context Routing**: Inquiring about current date/time bypasses irrelevant search queries and provides exact local time and date.
  - **Sliding-Window Rate Limiting**: Client-side throttle (max 8 req/min) with cooldown countdown badge to protect upstream endpoints.
  - **Privacy Favicon Sources**: Responsive source cards with DuckDuckGo favicons, page titles, and external link dialogs.

- 📎 **Ephemeral File & Document Uploads (1-Hour Auto-Expiration)**:
  - Drag-and-drop or select images (PNG, JPEG, WebP, GIF) and text documents (TXT, MD, CSV, JSON, LOG, Code).
  - Storage files automatically expire after 1 hour (`TTL = 3600s`) to save storage space and preserve privacy.
  - Context guardrails: Text files are safely truncated to protect context limits.
  - Modality awareness: Vision feedback warns if an active model is text-only.

- ✍️ **Balanced & Responsive Composer**:
  - Symmetrical geometry: The three-dot (`···`) options menu and Send button share identical baseline, height, and visual weight.
  - Dynamic expansion: Starts as a sleek, single-line pill when empty and smoothly anchors to the bottom row when typing multi-line text.
  - Clean options popover: Quick access to Attach File and Web Search toggle.

- 🎬 **Rich Multimodal Players**:
  - **Image Viewer**: Auto-adjustable aspect ratio viewport, tap-to-expand fullscreen lightbox, and 1-click download.
  - **Inline Video Player**: Fluid inline playback with native controls and download action.
  - **Living Audio Player**: Real-time animated waveforms for TTS and audio generation models.
  - **SVG Vector Graphics**: Live render and code view toggle with SVG export.

- 🕒 **Dynamic Temporal Context**:
  - System prompts on the local gateway dynamically inject current day, date, and local time so local LLMs always know the real-time calendar without external API calls.

- ☁️ **Multi-Provider Cloud API Integration**:
  - Connect your own API keys directly in Settings for OpenRouter, Groq, xAI Groq, Hugging Face, OpenAI, or custom endpoints.
  - Per-device encrypted browser storage (keys never leave your browser).

---

## Core Capabilities

- **📐 Interactive Math Visualizer**:
  - **Dynamic 2D Function Plotting**: Automatic interactive SVG curves for quadratic and linear equations with hover crosshairs and analytical point markers (roots, vertex, y-intercept, axis of symmetry).
  - **Analytical Derivations**: Step-by-step breakdown of quadratic formula, vertex coordinates, and discriminant ($\Delta$).
  - **KaTeX Mathematical Typesetting**: Crisp inline and display rendering of algebra, calculus, matrices, and arithmetic.

- **🔒 Zero Model & Data Leakage**:
  - Raw GGUF model file names, quantization formats, and local filesystem paths stay strictly on your hardware.
  - Web clients interact with clean, customizable aliases (e.g., `Sun Light`, `Sun Core`, `Sun Ultra`).

- **⚡ Per-Chat Memory & Slot Isolation**:
  - Switching or creating chats automatically sleeps or evicts inactive KV cache slots on your laptop to minimize VRAM/RAM consumption.
  - Live context usage gauge warns you when approaching token limits with a one-click **Continue in new chat** handoff.

- **🎙️ Neural Voice & Web Speech**:
  - High-fidelity neural voice synthesis streamed directly from your local hardware via `piper-tts`.
  - Instant browser-native Web Speech fallback for offline or zero-latency mobile listening.

---

## Project Structure

```text
little-sun/
├── src/                          # Frontend React SPA
│   ├── components/               # UI components (Composer, ChatView, MediaViewer, etc.)
│   ├── lib/                      # Core modules (webSearch, cloudApi, modality, supabase)
│   ├── pages/                    # Chat, Login, and Settings views
│   ├── state/                    # Global state & conversation store
│   └── styles/                   # Solar theme tokens and Tailwind CSS
├── little-sun-gateway/           # Local Laptop Inference Gateway
│   ├── models/                   # Local GGUF models directory (gitignored)
│   ├── bin/                      # llama-server executable (gitignored)
│   ├── server.mjs                # Express gateway server with temporal injection
│   ├── llama-manager.mjs         # Process lifecycle & KV slot controller
│   ├── auth.mjs                  # JWT and local preview auth handler
│   ├── tts-proxy.mjs             # Piper neural voice proxy
│   ├── models.json               # Gateway models configuration
│   ├── download_llama.bat        # Windows one-click llama-server downloader
│   └── start_little_sun.bat      # Windows one-click gateway & Funnel launcher
├── supabase/
│   └── schema.sql                # Complete Supabase RLS, Realtime, & Storage schema
├── server.ts                     # Lightweight production static & proxy server
├── vite.config.ts                # Vite build configuration
└── package.json                  # Root dependencies & scripts
```

---

## Getting Started

### 1. Web Application Setup

#### Clone & Install
```bash
git clone https://github.com/your-username/little-sun.git
cd little-sun
npm install
```

#### Configure Environment
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

Set your configuration values:
```env
# Supabase project URL and anon public key
VITE_SUPABASE_URL="https://<project-ref>.supabase.co"
VITE_SUPABASE_ANON_KEY="your-supabase-anon-key"

# Public HTTPS URL of your laptop's Tailscale Funnel (or local gateway)
VITE_GATEWAY_URL="https://<your-laptop>.<your-tailnet>.ts.net"
```

*(Note: If you leave `VITE_SUPABASE_URL` unset, Little Sun automatically operates in Local Offline Preview mode with zero external accounts!)*

#### Run Web Development Server
```bash
npm run dev
```

#### Build for Production
```bash
npm run build
npm start
```

---

### 2. Supabase Setup (Multi-Device Sync & Ephemeral Storage)

1. Create a free project at [supabase.com](https://supabase.com).
2. Open the **SQL Editor**, paste the contents of [`supabase/schema.sql`](./supabase/schema.sql), and click **Run**.
   - Creates `chats` and `messages` tables with Row-Level Security (RLS).
   - Creates the `chat-uploads` storage bucket with upload & delete policies.
   - Sets up automatic 1-hour expiration cleanup for uploaded files.
   - Enables `supabase_realtime` publication for instant cross-device synchronization.
3. In **Authentication → Providers → Email**, you can optionally disable public signups to keep your instance private and invite-only.

---

### 3. Local Gateway Setup (`little-sun-gateway`)

The gateway runs locally on your laptop or server and bridges incoming requests to `llama.cpp` and `piper-tts`.

```bash
cd little-sun-gateway
npm install
cp .env.example .env
```

Configure `little-sun-gateway/.env`:
```env
PORT=8790
SUPABASE_URL=https://<project-ref>.supabase.co
ALLOWED_ORIGINS=https://<your-app>.netlify.app,https://<your-app>.vercel.app,http://localhost:3000
OWNER_EMAIL=you@example.com
ALLOWED_EMAILS=you@example.com
PUBLIC_FUNNEL_URL=https://<your-laptop>.<your-tailnet>.ts.net
LLAMA_BIN=bin/llama-server.exe
LLAMA_PORT=8089
IDLE_UNLOAD_SECONDS=60
```

#### Windows One-Click Setup
1. Run `download_llama.bat` inside `little-sun-gateway/` to automatically fetch `llama-server.exe`.
2. Place any GGUF models in `little-sun-gateway/models/`.
3. Run `start_little_sun.bat` to launch the supervisor and Tailscale Funnel.

#### Linux / macOS Setup
1. Download or compile [`llama-server`](https://github.com/ggerganov/llama.cpp/releases).
2. Start the gateway:
   ```bash
   node server.mjs
   ```
3. Expose via Tailscale Funnel:
   ```bash
   tailscale funnel --bg --yes 8790
   ```

#### Model Configuration (`models.json`)
Configure your available GGUF models in `little-sun-gateway/models.json`:
```json
{
  "default": "sun-light",
  "systemPrompt": "You are Little Sun, a calm, direct, and thoughtful personal assistant. Answer questions concisely, naturally, and with intellectual clarity. Do not overexplain unless requested.",
  "models": [
    {
      "id": "sun-light",
      "name": "Sun Light",
      "file": "models/Llama-3.2-1B-Instruct-Q4_K_M.gguf",
      "enabled": true,
      "contextSize": 16384,
      "threads": 4,
      "temperature": 0.7,
      "maxTokens": 4096
    },
    {
      "id": "sun-core",
      "name": "Sun Core",
      "file": "models/qwen2.5-3b-instruct-q4_k_m.gguf",
      "enabled": true,
      "contextSize": 16384,
      "threads": 4,
      "temperature": 0.7,
      "maxTokens": 4096
    },
    {
      "id": "sun-ultra",
      "name": "Sun Ultra",
      "file": "models/Qwen3-4B-Q4_K_M.gguf",
      "enabled": true,
      "contextSize": 16384,
      "threads": 4,
      "temperature": 0.7,
      "maxTokens": 4096
    }
  ]
}
```

---

## Deployment

Deploy the frontend anywhere with zero vendor lock-in:

- **Netlify**: Pre-configured with `netlify.toml`. Connect your repository and configure environment variables in Site settings.
- **Vercel**: Pre-configured with `vercel.json` SPA rewrite rules.
- **Self-Hosted / Docker**: Build static assets with `npm run build` and serve via Node or Nginx.

---

## Keyboard Shortcuts

| Shortcut | Action |
| :--- | :--- |
| `Ctrl` / `Cmd` + `K` | New chat (sleeps current model slot) |
| `Ctrl` / `Cmd` + `Shift` + `O` | New chat alternative |
| `?` or `Ctrl` + `/` | Open Keyboard Shortcuts cheatsheet |
| `Esc` | Close modals and dialogs |
| `Enter` | Send prompt |
| `Shift` + `Enter` | Insert new line in composer |

---

## License

This project is open-source under the [MIT License](LICENSE). Feel free to fork, customize, and build your own private AI workspace.
