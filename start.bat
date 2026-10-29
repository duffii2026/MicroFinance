@echo off
setlocal
cd /d "%~dp0"
where python >nul 2>nul
if errorlevel 1 (
  echo Python 3 was not found. Install Python 3, then run this file again.
  pause
  exit /b 1
)
echo Starting MM1 Micro Finance Systems...
if not exist .env (
  echo .env is missing. Run setup.bat first and configure MySQL settings.
  pause
  exit /b 1
)
for /f "tokens=1,* delims==" %%A in ('findstr /b "MM1_APP_PORT=" .env') do set MM1_APP_PORT=%%B
if "%MM1_APP_PORT%"=="" set MM1_APP_PORT=8080
start "" http://127.0.0.1:%MM1_APP_PORT%
python server.py
pause
