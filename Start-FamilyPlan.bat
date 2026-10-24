@echo off
title FamilyPlan — Local Family Finance Server
cd /d "%~dp0"

echo ========================================================
echo   Starting FamilyPlan (Windows + Mobile Local Server)
echo ========================================================
echo.

echo Building latest app bundle...
call npm.cmd run build

start "" http://localhost:3456
node server/index.mjs
pause
