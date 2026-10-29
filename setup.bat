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
echo MM1 MySQL connector setup is complete.
echo Configure .env for your MySQL server, then run start.bat.
pause
