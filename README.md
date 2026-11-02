# Little Sun ☀️ (v1.3)

> **A calm, private intelligence workspace connecting an editorial web interface to your personal local LLM and neural voice engine.**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Version: 1.3.0](https://img.shields.io/badge/Version-1.3.0-orange.svg)]()
[![React 19](https://img.shields.io/badge/React-19.0-blue.svg)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-8.x-purple.svg)](https://vitejs.dev/)
[![Tailscale](https://img.shields.io/badge/Network-Tailscale_Funnel-blue.svg)](https://tailscale.com/)

---

## Overview

**Little Sun** pairs an elegant, distraction-free web client with your own laptop's local inference gateway (`little-sun-gateway`). Powered by [`llama.cpp`](https://github.com/ggerganov/llama.cpp) for offline intelligence and [`piper-tts`](https://github.com/rhasspy/piper) for natural neural voice streaming, your conversations, prompts, and model weights remain completely under your control.

With **Supabase Auth & Realtime**, your chats, history, and voice preferences synchronize instantaneously across all your devices—desktop, laptop, tablet, and mobile.

---

## Architecture

```text
┌─────────────────────────────────────────────────────────────────┐
│                       Web Client (React)                        │
│   • Editorial typography, dark & light ambient solar themes     │
│   • KaTeX & Interactive 2D function visualizers (vertex, roots) │
│   • Real-time token streaming with animated solar state emblem  │
│   • Full multi-device sync, /account & /voices controls         │
└───────────────┬─────────────────────────────────┬───────────────┘
                │                                 │
    Supabase Auth & Realtime             Tailscale Funnel (HTTPS)
    (Chats, Messages, Preferences)       (SSE Stream, Piper TTS, Slots)
                │                                 │
                ▼                                 ▼
┌───────────────────────────────┐ ┌───────────────────────────────┐
│       Supabase Postgres       │ │      little-sun-gateway       │
│   • Row-Level Security (RLS)  │ │   • Node.js gateway (Port 8790)│
│   • Realtime publication sync │ │   • llama-server (GGUF slot)  │
│   • Invite-only user auth     │ │   • Piper neural voice engine │
└───────────────────────────────┘ └───────────────────────────────┘
```

---

## Key Features

- **📐 Interactive Math Visualizer (V1.3)**:
  - **Dynamic 2D Function Plotting**: Automatic interactive SVG curves for quadratic and linear equations with hover crosshairs and analytical point markers (roots, vertex, y-intercept, axis of symmetry).
  - **Analytical Derivations**: Step-by-step breakdown of quadratic formula, vertex coordinates, and discriminant ($\Delta$).
  - **KaTeX Mathematical Typesetting**: Beautiful inline and display rendering of algebra, calculus, matrices, and arithmetic.

- **🔒 Zero Model & Data Leakage**:
  - Raw GGUF model file names, quantization formats, and local filesystem paths stay strictly on your hardware.
  - Web clients interact with clean, customizable aliases (e.g., `Sun Core`, `Sun Fast`).

- **⚡ Per-Chat Memory & Slot Isolation**:
  - Switching or creating chats automatically sleeps or evicts inactive KV cache slots on your laptop to minimize VRAM/RAM consumption.
  - Live context usage gauge warns you when approaching token limits with a one-click **Continue in new chat** handoff.

- **🎙️ Neural Voice & Web Speech**:
  - High-fidelity neural voice synthesis streamed directly from your local hardware via `piper-tts`.
  - Instant browser-native Web Speech fallback for offline or zero-latency mobile listening.

- **📱 Seamless Cross-Device Sync**:
  - Instant database-level sync across phone, tablet, and desktop using Supabase PostgreSQL with strict Row-Level Security (RLS).

---

## Project Structure

```text
little-sun/
├── src/                          # Frontend React SPA
│   ├── components/               # UI components (MathVisualizer, ChatView, Composer, etc.)
│   ├── lib/                      # Core utilities (gateway client, Supabase client, TTS, tokens)
│   ├── state/                    # Global state & conversation store
│   └── styles/                   # Solar theme tokens and Tailwind CSS
├── little-sun-gateway/           # Local Laptop Inference Gateway
│   ├── models/                   # Local GGUF models directory (gitignored)
│   ├── bin/                      # llama-server executable (gitignored)
│   ├── llama-manager.mjs         # Process lifecycle & KV slot controller
│   ├── tts-proxy.mjs             # Piper neural voice proxy
│   ├── models.json               # Gateway models configuration
│   ├── download_llama.bat        # Windows one-click llama-server downloader
│   └── start_little_sun.bat      # Windows one-click gateway & Funnel launcher
├── supabase/
│   └── schema.sql                # Complete Supabase RLS and Realtime schema
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

# Public HTTPS URL of your laptop's Tailscale Funnel
VITE_GATEWAY_URL="https://<your-laptop>.<your-tailnet>.ts.net"
```

#### Run Web Development Server
```bash
# Start Vite development server
npm run dev
```

#### Build for Production
```bash
npm run build
npm start
```

---

### 2. Supabase Setup

1. Create a free project at [supabase.com](https://supabase.com).
2. Open the **SQL Editor**, paste the contents of [`supabase/schema.sql`](./supabase/schema.sql), and click **Run**.
   - This sets up `chats` and `messages` tables, enables Row-Level Security (RLS), adds timestamp triggers, and enables the `supabase_realtime` publication.
3. In **Authentication → Providers → Email**, you can optionally disable public signups to keep your instance private and invite-only.
4. Add your personal email under **Authentication → Users**.

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
ALLOWED_ORIGINS=https://<your-app>.netlify.app,https://<your-app>.vercel.app,http://localhost:5173
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
  "default": "sun-core",
  "systemPrompt": "You are Little Sun, a private, calm personal assistant running locally on your user's laptop. Keep answers clear, direct, and thoughtful. When performing calculations, solving math, or analyzing equations, always present mathematical formulas, calculations, and functions in clear LaTeX (use $$...$$ for display equations and $...$ for inline math) so they render with interactive visual graphs and mathematical typesetting.",
  "models": [
    {
      "id": "sun-core",
      "name": "Sun Core",
      "file": "models/my-model-q4.gguf",
      "enabled": true,
      "contextSize": 16384,
      "threads": 6,
      "temperature": 0.7,
      "maxTokens": 4096
    }
  ]
}
```

---

## Deployment

Deploy the frontend anywhere with zero backend lock-in:

- **Netlify**: Pre-configured with `netlify.toml`. Push your repo to GitHub and connect it to Netlify. Set your environment variables in Site settings.
- **Vercel**: Pre-configured with `vercel.json` SPA rewrite rules.
- **Self-Hosted / Docker**: Build static assets with `npm run build` and serve via Node or Nginx.

---

## Keyboard Shortcuts

| Shortcut | Action |
| :--- | :--- |
| `Ctrl` / `Cmd` + `Shift` + `O` | New chat (sleeps current model slot) |
| `Ctrl` / `Cmd` + `K` | Toggle sidebar navigation |
| `Enter` | Send prompt |
| `Shift` + `Enter` | Insert new line in composer |

---

## License

This project is open-source under the [MIT License](LICENSE). Feel free to fork, customize, and build your own private AI workspace.
