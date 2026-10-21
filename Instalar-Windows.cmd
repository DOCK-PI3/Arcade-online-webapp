@echo off
setlocal
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\windows-server.ps1" -Mode Install %*
set "arcadeExit=%errorlevel%"
if not "%~1"=="-Check" pause
exit /b %arcadeExit%
