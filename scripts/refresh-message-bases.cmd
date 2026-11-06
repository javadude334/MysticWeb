@echo off
setlocal
set "SCRIPT=%~dp0refresh-message-bases.ps1"
if not defined MYSTICWEB_BASE_URL set "MYSTICWEB_BASE_URL=http://127.0.0.1:3000"
powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "%SCRIPT%" -BaseUrl "%MYSTICWEB_BASE_URL%"
exit /b %ERRORLEVEL%
