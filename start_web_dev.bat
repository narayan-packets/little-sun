@echo off
chcp 65001 >nul
title Little Sun - Local Web Server
cd /d "%~dp0"

echo =======================================================
echo          LITTLE SUN - LOCAL TEST SERVER
echo =======================================================
echo.

if not exist "node_modules" (
  echo [INFO] Installing web dependencies...
  call npm.cmd install
)

echo [INFO] Starting Little Sun server at http://localhost:3000 ...
echo [INFO] Press Ctrl+C in this window to stop the server anytime.
echo.
call npm.cmd run dev
pause

