@echo off
cd /d "%~dp0"
node scripts\pc\update.mjs %*
echo.
if "%~1"=="" pause
