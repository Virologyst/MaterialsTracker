@echo off
echo === Materials Tracker ===
echo.

REM Auto-install dependencies if missing
if not exist "%~dp0\..\api\node_modules" (
    echo Installing API dependencies...
    cd /d "%~dp0\..\api" && call npm install
    if %ERRORLEVEL% neq 0 (
        echo ERROR: Failed to install API dependencies
        pause
        exit /b 1
    )
    echo.
)

if not exist "%~dp0\..\web\node_modules" (
    echo Installing Web dependencies...
    cd /d "%~dp0\..\web" && call npm install
    if %ERRORLEVEL% neq 0 (
        echo ERROR: Failed to install Web dependencies
        pause
        exit /b 1
    )
    echo.
)

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
