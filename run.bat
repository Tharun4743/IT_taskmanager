@echo off
setlocal
title VSBEC Academic Task Management System
color 0A

echo =================================================
echo    VSBEC Academic Task Management System
echo =================================================
echo.

:: Check for Node.js
where.exe node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js is not installed or not in PATH.
    echo [ACTION] Please install Node.js from https://nodejs.org/
    pause
    exit /b
)

:: Check for .env file
if not exist ".env" (
    echo [INFO] .env file not found. Creating from template...
    copy .env.example .env >nul
)

:: Check if node_modules exists
if not exist "node_modules\" (
    echo [INFO] Installing dependencies. This may take a minute...
    call npm install
    if %ERRORLEVEL% NEQ 0 (
        echo [ERROR] npm install failed. Check your internet connection.
        pause
        exit /b
    )
)

echo.
echo [INFO] Starting the development server...
echo [INFO] Once started, open your browser at: http://localhost:3000
echo [INFO] Press Ctrl+C to stop the server.
echo.

:: Run the dev server
call npm run dev

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] The server failed to start.
    echo.
    echo Troubleshooting Steps:
    echo 1. Make sure PostgreSQL is accessible (check your .env DATABASE_URL).
    echo 2. Run 'npm install' manually in this folder.
    echo 3. Check if another process is using port 3000.
    echo.
)

echo.
echo Press any key to exit...
pause >nul
