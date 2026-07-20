@echo off
cd /d "%~dp0.."
py -3 "%~dp0sync_assessment_config.py"
if errorlevel 1 (
  echo Sync fehlgeschlagen.
  pause
  exit /b 1
)
echo Fertig. index.html neu laden (F5).
pause
