@echo off
setlocal enabledelayedexpansion
title Little Sun - One-Click Downloader
echo =======================================================
echo          LITTLE SUN - SETUP ^& DOWNLOADER
echo =======================================================
echo.

cd /d "%~dp0"

:: 1. Create bin and models directory if they don't exist
if not exist "bin" mkdir "bin"
if not exist "models" mkdir "models"

:: 2. Check if llama-server.exe already exists
if exist "bin\llama-server.exe" (
    echo [OK] bin\llama-server.exe is already present.
) else (
    echo [INFO] Downloading llama-server for Windows (CPU/AVX2)...
    echo Please wait a moment...
    
    :: Download official release zip from llama.cpp GitHub
    powershell -Command "Invoke-WebRequest -Uri 'https://github.com/ggerganov/llama.cpp/releases/latest/download/llama-b4400-bin-win-avx2-x64.zip' -OutFile 'bin\llama.zip'"
    
    if exist "bin\llama.zip" (
        echo [INFO] Extracting llama-server.exe...
        powershell -Command "Expand-Archive -Path 'bin\llama.zip' -DestinationPath 'bin\extracted' -Force"
        
        if exist "bin\extracted\build\bin\llama-server.exe" (
            move "bin\extracted\build\bin\llama-server.exe" "bin\llama-server.exe" >nul
            copy "bin\extracted\build\bin\*.dll" "bin\" >nul 2>&1
        ) else if exist "bin\extracted\llama-server.exe" (
            move "bin\extracted\llama-server.exe" "bin\llama-server.exe" >nul
            copy "bin\extracted\*.dll" "bin\" >nul 2>&1
        )
        
        :: Cleanup zip
        rmdir /s /q "bin\extracted" >nul 2>&1
        del /f /q "bin\llama.zip" >nul 2>&1
        echo [OK] llama-server.exe installed successfully into bin\
    ) else (
        echo [ERROR] Failed to download automatically. Please check your internet connection.
    )
)

echo.
echo [INFO] Place your GGUF model files inside the "models\" folder
echo        and configure their display names in "models.json".
echo.
echo =======================================================
echo Setup complete! You can now run start_little_sun.bat
echo =======================================================
pause
