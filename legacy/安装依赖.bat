@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo 正在安装依赖...
python -m pip install -r requirements.txt
if errorlevel 1 (
    echo 安装失败，请确认已安装 Python 3 并配置了 pip。
    pause
    exit /b 1
)
echo 依赖安装完成。
pause
