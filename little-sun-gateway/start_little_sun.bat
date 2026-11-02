@echo off
chcp 65001 >nul
title Little Sun - Local AI Supervisor
cd /d "%~dp0"

if not exist "node_modules" (
  echo Installing gateway dependencies...
  call npm install
)

REM Ensure Tailscale CLI is in PATH if installed in standard location
if exist "C:\Program Files\Tailscale\tailscale.exe" set "PATH=%PATH%;C:\Program Files\Tailscale"

REM Pre-enable Tailscale Funnel if tailscale is installed
where tailscale >nul 2>nul
if %ERRORLEVEL% equ 0 (
  tailscale funnel --bg --yes 8790 >nul 2>nul
)

REM Launch Little Sun Supervisor and Live CLI Dashboard
REM Automatically starts Tailscale Funnel, Pocket TTS (port 8000), and Llama Server
node server.mjs
pause
