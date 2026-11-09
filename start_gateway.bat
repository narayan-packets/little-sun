@echo off
chcp 65001 >nul
title Little Sun - AI Gateway Supervisor
cd /d "%~dp0\little-sun-gateway"

if exist "start_little_sun.bat" (
  call start_little_sun.bat
) else (
  echo [ERROR] start_little_sun.bat not found in little-sun-gateway directory.
  pause
)
