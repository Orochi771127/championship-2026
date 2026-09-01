@echo off
setlocal
title Championship 2026 Local Server
cd /d "%~dp0"

where node.exe >nul 2>nul
if errorlevel 1 (
  echo Node.js was not found. Install Node.js 22 or newer, then run this file again.
  pause
  exit /b 1
)

start "" powershell.exe -NoProfile -WindowStyle Hidden -Command "Start-Sleep -Milliseconds 900; Start-Process 'http://127.0.0.1:8732/championship.html'"
echo Starting Championship 2026...
echo Keep this window open while playing. Close it to stop the local server.
node scripts\serve.mjs

if errorlevel 1 (
  echo.
  echo The local server could not start. Port 8732 may already be in use.
  pause
)
