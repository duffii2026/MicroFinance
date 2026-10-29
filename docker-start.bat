@echo off
setlocal
cd /d "%~dp0"
where docker >nul 2>nul
if errorlevel 1 (
  echo Docker Desktop was not found. Install and start Docker Desktop, or configure a local MySQL server and run setup.bat.
  pause
  exit /b 1
)
if not exist .env (
  copy .env.example .env >nul
  echo Created .env from the example. Edit the initial admin and database passwords before operational use.
  notepad .env
)
docker compose up --build
pause
