# 每日任务 v4.1.3

Windows 桌面任务清单 —— Tauri 2 + React，**单窗口 + 系统托盘**，稳定可用。

## 功能

- 每日任务：添加、完成、删除、常驻、标签、优先级、提醒
- 跨日顺延、本地 JSON 存储、CSV 日志、自动备份
- 宏观日历：ES 季末交割、非农、CPI、FOMC
- 右侧悬浮条：收起侧边、右键菜单、不占任务栏
- 系统托盘：关闭隐藏到托盘，左键切换显示
- 开机自启、每周回顾、防多开

## 开发

```bash
npm install
npm run tauri:dev
```

## 打包

```bash
npm run tauri:build
```

输出：`src-tauri/target/release/bundle/nsis/`

## 数据目录

`%LOCALAPPDATA%\DailyTask\`

## 说明

v4.1 单窗口 + 右侧悬浮条 + 鼠标离开自动收起 + 系统托盘后台运行。Python 旧版见 `legacy/`。
