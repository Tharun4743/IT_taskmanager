@echo off
echo ==========================================
echo Starting IT Task Manager local dev server...
echo ==========================================
npm run dev
if %ERRORLEVEL% neq 0 (
    echo.
    echo Something went wrong. Retrying with npx tsx directly...
    npx tsx watch server.ts
)
pause
