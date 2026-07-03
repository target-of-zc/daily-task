@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo 正在安装打包工具...
python -m pip install pyinstaller pystray Pillow plyer -q
echo 正在打包 exe（需数分钟）...
python -m PyInstaller --onefile --windowed --name "每日任务" --clean daily_tasks.py
if errorlevel 1 (
    echo 打包失败。
    pause
    exit /b 1
)
echo.
echo 打包完成：dist\每日任务.exe
echo 可将 exe 复制到任意目录使用，数据文件保存在 exe 同目录。
pause
