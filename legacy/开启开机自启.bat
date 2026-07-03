@echo off
chcp 65001 >nul
cd /d "%~dp0"
powershell -Command "$p='%CD%\启动任务清单.bat'; $k='HKCU:\Software\Microsoft\Windows\CurrentVersion\Run'; Set-ItemProperty -Path $k -Name 'DailyTaskList' -Value $p"
echo 已开启开机自启。
pause
