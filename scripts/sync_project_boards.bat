@echo off
REM Windows Wrapper for sync_project_boards.py
REM Handles encoding issues on Windows

setlocal enabledelayedexpansion
set "PYTHON_PATH=%~dp0sync_project_boards.py"

REM Set UTF-8 encoding for Python
set PYTHONIOENCODING=utf-8

REM Run with encoding override
python "%PYTHON_PATH%" %* 2>&1 | chcp 65001 > nul

exit /b %ERRORLEVEL%
