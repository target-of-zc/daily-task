# 每日任务（Daily Task）

Windows 桌面每日任务清单 —— 基于 **Tauri 2 + React** 的悬浮球应用。

## 功能

- 屏幕边缘悬浮球（贴边仅露出 1/3，闲置半透明）
- 悬停预览待办、快速勾选
- 单击打开完整任务面板
- 任务顺延、常驻任务、标签与优先级
- 提醒通知、系统托盘、防多开
- 数据本地 JSON 存储（`%LOCALAPPDATA%\DailyTask\`）

## 环境要求

- [Node.js](https://nodejs.org/) 18+
- [Rust](https://www.rust-lang.org/tools/install)（含 **MSVC** 工具链，Windows）
- [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) — 安装时勾选「使用 C++ 的桌面开发」或「C++ 生成工具」
- [WebView2](https://developer.microsoft.com/microsoft-edge/webview2/)（Windows 10/11 通常已预装）

> 若 `cargo build` 报错 `link.exe not found`，说明尚未安装 MSVC 链接器，请先安装上述 Build Tools 后重启终端。

## 开发

```bash
npm install
npm run tauri:dev
```

## 打包

```bash
npm run tauri:build
```

安装包输出在 `src-tauri/target/release/bundle/`。

## 从 Python 版迁移

旧版 `tasks_data.json` 放在项目根目录时，首次启动会自动复制到应用数据目录。

Python 版源码保留在 `legacy/` 目录。

## 许可证

MIT
