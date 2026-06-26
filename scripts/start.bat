@echo off
echo === Materials Tracker ===
echo.
echo Building frontend...
cd /d "%~dp0\..\web" && npm run build
if %ERRORLEVEL% neq 0 (
    echo ERROR: Failed to build frontend
    exit /b 1
)
echo.
echo Starting server...
cd /d "%~dp0\..\api"
set NODE_ENV=production
set PORT=3000
npm start
