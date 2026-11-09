#!/usr/bin/env bash
set -e

cd "$(dirname "$0")"

if [ ! -d "node_modules" ]; then
  echo "Installing gateway dependencies..."
  npm install
fi

# Pre-enable Tailscale Funnel if tailscale is installed
if command -v tailscale >/dev/null 2>&1; then
  tailscale funnel --bg --yes 8790 >/dev/null 2>&1 || true
fi

# Launch Little Sun Supervisor and Live CLI Dashboard
node server.mjs
