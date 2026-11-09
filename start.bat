@echo off
chcp 65001 >nul
title Little Sun - Web Application
cd /d "%~dp0"

echo =======================================================
echo          LITTLE SUN - LOCAL WEB SERVER
echo =======================================================
echo.

where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
  echo [ERROR] Node.js is not installed or not in PATH.
  echo Please install Node.js 18+ from https://nodejs.org/
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo [INFO] Installing web dependencies...
  call npm.cmd install
)

echo [INFO] Starting Little Sun server at http://localhost:3000 ...
echo [INFO] Press Ctrl+C in this window to stop the server anytime.
echo.
call npm.cmd run dev
pause
