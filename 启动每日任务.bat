@echo off
chcp 65001 >nul
cd /d "%~dp0"
start "" "release\daily-task.exe" 2>nul || (
  echo 请先运行: npm run tauri:build
  pause
)
