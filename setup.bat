@echo off
setlocal
cd /d "%~dp0"
where python >nul 2>nul
if errorlevel 1 (
  echo Python 3 was not found. Install Python 3, then run this file again.
  pause
  exit /b 1
)
python -m pip install -r requirements.txt
if errorlevel 1 (
  echo Could not install the MySQL Python connector.
  pause
  exit /b 1
)
if not exist .env copy .env.example .env >nul
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js was not found. Install Node.js 22 or newer, then run this file again.
  pause
  exit /b 1
)
where pnpm >nul 2>nul
if errorlevel 1 (
  echo pnpm was not found. Run: corepack enable
  pause
  exit /b 1
)
pnpm install
if errorlevel 1 (
  echo Could not install the React workspace dependencies.
  pause
  exit /b 1
)
pnpm build
if errorlevel 1 (
  echo Could not build the React workspace.
  pause
  exit /b 1
)
echo React workspace and MySQL connector setup is complete.
echo Configure .env for your MySQL server, then run start.bat.
pause
