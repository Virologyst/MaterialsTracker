@echo off
echo === Materials Tracker Setup ===
echo.
echo Installing API dependencies...
cd /d "%~dp0\..\api" && npm install
if %ERRORLEVEL% neq 0 (
    echo ERROR: Failed to install API dependencies
    exit /b 1
)
echo.
echo Installing Web dependencies...
cd /d "%~dp0\..\web" && npm install
if %ERRORLEVEL% neq 0 (
    echo ERROR: Failed to install Web dependencies
    exit /b 1
)
echo.
echo === Setup complete ===
