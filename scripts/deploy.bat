@echo off
cd /d "%~dp0.."
node scripts\deploy.mjs %*
if errorlevel 1 pause
