#!/usr/bin/env bash
set -e

cd "$(dirname "$0")/little-sun-gateway"

if [ -f "./start_little_sun.sh" ]; then
  bash ./start_little_sun.sh
else
  if [ ! -d "node_modules" ]; then
    echo "Installing gateway dependencies..."
    npm install
  fi
  node server.mjs
fi
