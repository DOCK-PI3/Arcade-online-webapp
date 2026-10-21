@echo off
setlocal
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\windows-server.ps1" -Mode Start %*
set "arcadeExit=%errorlevel%"
if not "%arcadeExit%"=="0" pause
exit /b %arcadeExit%
