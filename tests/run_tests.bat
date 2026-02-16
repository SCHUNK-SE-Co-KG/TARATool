@echo off
REM ═══════════════════════════════════════════════════════════════
REM  TARATool Test Runner
REM  Usage:  run_tests.bat [options]
REM ═══════════════════════════════════════════════════════════════

echo.
echo ╔══════════════════════════════════════════╗
echo ║        TARATool Test Framework           ║
echo ╚══════════════════════════════════════════╝
echo.

cd /d "%~dp0"

REM ── Check Python ──────────────────────────────────────────────
python --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python not found. Please install Python 3.10+.
    pause
    exit /b 1
)

REM ── Install dependencies if needed ────────────────────────────
if not exist ".venv" (
    echo [SETUP] Creating virtual environment...
    python -m venv .venv
)

call .venv\Scripts\activate.bat

echo [SETUP] Installing dependencies...
pip install -q -r requirements.txt
playwright install chromium --with-deps

echo.
echo ═══════════════════════════════════════════
echo   Running tests...
echo ═══════════════════════════════════════════
echo.

REM ── Parse arguments ───────────────────────────────────────────
if "%1"=="" (
    pytest --html=report.html --self-contained-html %*
) else (
    pytest %*
)

echo.
echo ═══════════════════════════════════════════
echo   Done. HTML report: tests\report.html
echo ═══════════════════════════════════════════

pause
