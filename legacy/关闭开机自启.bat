@echo off
chcp 65001 >nul
powershell -Command "Remove-ItemProperty -Path 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run' -Name 'DailyTaskList' -ErrorAction SilentlyContinue"
echo 已关闭开机自启。
pause
