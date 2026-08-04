@echo off
REM Sync assessment_config.json -> assessment_config.js (Windows)
REM Linux/macOS: tools/sync_assessment_config.sh  oder  python3 tools/sync_assessment_config.py
cd /d "%~dp0.."
py -3 "%~dp0sync_assessment_config.py"
if errorlevel 1 (
  echo Sync fehlgeschlagen.
  pause
  exit /b 1
)
echo Fertig. index.html neu laden (F5).
pause
