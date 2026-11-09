#!/usr/bin/env bash
set -e

# Change directory to the script root
cd "$(dirname "$0")"

echo "======================================================="
echo "         LITTLE SUN - LOCAL WEB SERVER                 "
echo "======================================================="
echo ""

if ! command -v node >/dev/null 2>&1; then
  echo "[ERROR] Node.js is not installed or not in PATH."
  echo "Please install Node.js 18+ from https://nodejs.org/"
  exit 1
fi

if [ ! -d "node_modules" ]; then
  echo "[INFO] Installing web dependencies..."
  npm install
fi

echo "[INFO] Starting Little Sun server at http://localhost:3000 ..."
echo "[INFO] Press Ctrl+C in this terminal to stop the server anytime."
echo ""
npm run dev
