@echo off
chcp 65001 >nul
cd /d "%~dp0"
start "" pythonw daily_tasks.py
if errorlevel 1 (
    echo 启动失败，请确认已安装 Python 3。
    python daily_tasks.py
    pause
)
