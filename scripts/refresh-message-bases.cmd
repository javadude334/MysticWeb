@echo off
setlocal
cd /d "C:\work\javadude_dev\MysticWeb"
node "scripts\refresh-message-bases.cjs"
exit /b %ERRORLEVEL%
