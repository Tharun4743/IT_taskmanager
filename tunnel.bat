@echo off
title VSBEC Task Manager - Internet Tunnel
color 0B

echo =================================================
echo    VSBEC Task Manager - Internet Sharing
echo =================================================
echo.
echo [INFO] This will create a public internet link to your running server.
echo [INFO] Make sure the server is already running (via run.bat) before continuing.
echo [INFO] The link will be active as long as this window is open.
echo.
echo [INFO] Starting tunnel on port 3000...
echo.

lt --port 3000

echo.
echo [INFO] Tunnel closed.
pause
