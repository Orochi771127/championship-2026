@echo off
setlocal enabledelayedexpansion
title Digimon Championship 2026
color 0B

rem ---------------------------------------------------------------------------
rem Repo-local one-click launcher for DIGIMON CHAMPIONSHIP - 2026 MODERN REBUILD.
rem
rem This launcher is part of the product repository. It resolves everything from
rem its own folder (%~dp0), starts the product's own Node server
rem (scripts/serve.mjs via "npm run serve"), and opens the game. It depends on no
rem other project and hardcodes no external path.
rem
rem Usage:
rem   PLAY_CHAMPIONSHIP.bat        play on this computer only (loopback)
rem   PLAY_CHAMPIONSHIP.bat lan    also allow phones on the same Wi-Fi to connect
rem
rem Loopback is the default on purpose: "lan" binds the development server to
rem every network interface, so it is an explicit opt-in rather than a silent one.
rem ---------------------------------------------------------------------------

set "REPO=%~dp0"
if "%REPO:~-1%"=="\" set "REPO=%REPO:~0,-1%"

set "PORT=8732"
if not "%CHAMPIONSHIP_PORT%"=="" set "PORT=%CHAMPIONSHIP_PORT%"

set "BINDHOST=127.0.0.1"
set "SHARE="
if /I "%~1"=="lan" (
  set "BINDHOST=0.0.0.0"
  set "SHARE=1"
)

set "URL=http://127.0.0.1:%PORT%/championship.html"

echo.
echo   ============================================
echo      DIGIMON CHAMPIONSHIP - 2026
echo   ============================================
echo.

if not exist "%REPO%\championship.html" (
  echo   This launcher is not sitting in the game folder.
  echo   Expected to find: %REPO%\championship.html
  echo.
  echo   Keep PLAY_CHAMPIONSHIP.bat in the repository root.
  echo.
  pause
  exit /b 1
)

where node >nul 2>&1
if errorlevel 1 (
  echo   Node.js was not found on this computer.
  echo.
  echo   Install Node.js 22 or newer from https://nodejs.org/
  echo   then run this file again.
  echo.
  pause
  exit /b 1
)

rem Already listening? Just reopen it rather than starting a second server.
set "ALREADY="
for /f "tokens=*" %%L in ('netstat -ano ^| findstr /R /C:"TCP.*:%PORT% .*LISTENING"') do set "ALREADY=1"
if defined ALREADY (
  echo   The game is already running - reopening it.
  goto :open
)

if not exist "%REPO%\node_modules\pixi.js" (
  echo   First run: installing dependencies. This happens once.
  echo.
  pushd "%REPO%"
  call npm install
  set "INSTALLFAILED=!errorlevel!"
  popd
  if not "!INSTALLFAILED!"=="0" (
    echo.
    echo   npm install did not finish. Read the messages above and try again.
    echo.
    pause
    exit /b 1
  )
  echo.
)

echo   Starting up...
start "Championship 2026 server" /min cmd /c "cd /d "%REPO%" && set CHAMPIONSHIP_HOST=%BINDHOST%&& set CHAMPIONSHIP_PORT=%PORT%&& npm run serve"

set /a TRIES=0
:wait
set /a TRIES+=1
set "UP="
for /f "tokens=*" %%L in ('netstat -ano ^| findstr /R /C:"TCP.*:%PORT% .*LISTENING"') do set "UP=1"
if defined UP goto :open
if !TRIES! GEQ 40 (
  echo   The server did not start in time. Close this window and try again.
  echo.
  pause
  exit /b 1
)
ping -n 1 -w 500 127.0.0.1 >nul
goto :wait

:open
start "" "%URL%"

echo.
echo   ============================================
echo      The game is opening in your browser.
echo.
if defined SHARE (
  set "LAN="
  for /f "tokens=2 delims=:" %%A in ('ipconfig ^| findstr /C:"IPv4"') do (
    if not defined LAN (
      set "CAND=%%A"
      set "CAND=!CAND: =!"
      if not "!CAND!"=="127.0.0.1" set "LAN=!CAND!"
    )
  )
  if defined LAN (
    echo      TO PLAY ON YOUR PHONE
    echo      Same Wi-Fi, then open this address:
    echo.
    echo      http://!LAN!:%PORT%/championship.html
    echo.
  ) else (
    echo      No Wi-Fi address was found for phone play.
    echo.
  )
) else (
  echo      Phone play is off. To turn it on, run:
  echo      PLAY_CHAMPIONSHIP.bat lan
  echo.
)
echo      A small server window is running, minimised.
echo      Close it when you are done playing.
echo   ============================================
echo.
pause >nul
