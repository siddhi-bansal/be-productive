@echo off
REM Start the Be Productive service in the background using PM2
REM Note: Must be run as Administrator for DNS port 53

echo Starting Be Productive DNS blocker in background...
echo.
echo WARNING: This script must be run as Administrator
echo Right-click and select "Run as Administrator"
echo.

REM Ensure dependencies are installed
if not exist "node_modules" (
    echo Installing dependencies...
    call npm install
)

REM Check if already running
tasklist /FI "IMAGENAME eq node.exe" /FI "WINDOWTITLE eq server-dns.js*" 2>nul | find /I "node.exe" >nul
if %ERRORLEVEL% EQU 0 (
    echo Service is already running!
    echo Stop it first with: npm run stop
    exit /b 1
)

REM Start in background
echo Starting DNS server in background...
start /B node server-dns.js > be-productive.log 2>&1

timeout /t 2 /nobreak >nul

tasklist /FI "IMAGENAME eq node.exe" 2>nul | find /I "node.exe" >nul
if %ERRORLEVEL% EQU 0 (
    echo.
    echo Be Productive is now running in the background!
    echo View logs with: npm run logs
    echo Stop with: npm run stop (requires parent code)
    echo.
    echo Visit http://localhost:8888/setup.html to configure
    echo.
    echo Configure your system DNS to 127.0.0.1 to activate blocking
) else (
    echo Failed to start. Check be-productive.log for errors
    exit /b 1
)
pause
