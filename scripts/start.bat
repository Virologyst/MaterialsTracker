@echo off
echo === Materials Tracker ===
echo.
echo Building frontend...
cd /d "%~dp0\..\web" && call npm run build
if %ERRORLEVEL% neq 0 (
    echo ERROR: Failed to build frontend
    pause
    exit /b 1
)
echo.
echo Building API...
cd /d "%~dp0\..\api" && call npm run build
if %ERRORLEVEL% neq 0 (
    echo ERROR: Failed to build API
    pause
    exit /b 1
)
echo.
echo Starting server at http://localhost:3000
echo Press Ctrl+C to stop.
echo.
set NODE_ENV=production
set PORT=3000
npm start
