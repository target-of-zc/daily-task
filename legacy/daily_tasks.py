#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""桌面每日任务清单 - 全功能版"""

import csv
import json
import shutil
import socket
import sys
import threading
import uuid
import tkinter as tk
import winreg
from datetime import date, datetime, timedelta
from pathlib import Path
from tkinter import font as tkfont, messagebox, ttk

APP_DIR = Path(__file__).parent
DATA_FILE = APP_DIR / "tasks_data.json"
CSV_LOG_FILE = APP_DIR / "task_log.csv"
BACKUP_DIR = APP_DIR / "backups"
LOCK_PORT = 58472
AUTOSTART_NAME = "DailyTaskList"

BALL_SIZE = 64
BALL_DOCK_VISIBLE = BALL_SIZE // 3   # 贴边时只露出 1/3
BALL_ALPHA_IDLE = 0.48               # 贴边闲置透明度
BALL_ALPHA_ACTIVE = 0.92             # 悬停/展开透明度
PANEL_ALPHA = 0.96
TRANSPARENT = "#010101"
PREVIEW_WIDTH = 300
PREVIEW_MAX_ITEMS = 8
FULL_WIDTH = 380
FULL_HEIGHT = 640
AUTO_COLLAPSE_MS = 2000
HOVER_DELAY_MS = 350

TAGS = ["工作", "生活", "学习", "其他"]
PRIORITIES = ["高", "中", "低"]

BALL = {
    "shadow": "#B8C0C8", "shadow_soft": "#D0D6DC", "ring": "#E0E0E0",
    "ring_hover": "#D0D0D0", "body": "#FFFFFF", "shade": "#F4F4F4",
    "icon": "#4ECDC4", "icon_dark": "#38B2AA",
    "badge": "#FF6B6B", "badge_light": "#FF8787", "badge_text": "#FFFFFF",
    "badge_high": "#E63946",
}

COLORS = {
    "bg": "#1e1e2e", "surface": "#2a2a3e", "surface_hover": "#35354a",
    "accent": "#7c9cff", "accent_hover": "#9ab4ff", "text": "#e8e8f0",
    "text_muted": "#9898a8", "done": "#6bcb77", "border": "#3d3d52",
    "danger": "#ff6b6b", "recurring": "#ffd166", "carryover": "#ff9f43",
}
TAG_COLORS = {"工作": "#7c9cff", "生活": "#6bcb77", "学习": "#ffd166", "其他": "#9898a8"}
PRIORITY_COLORS = {"高": "#ff6b6b", "中": "#ffd166", "低": "#9898a8"}


# ── 工具函数 ─────────────────────────────────────────────

def _new_id():
    return uuid.uuid4().hex[:8]


def _now_str():
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")


def format_date(iso_date):
    try:
        return datetime.strptime(iso_date, "%Y-%m-%d").date().strftime("%m月%d日")
    except ValueError:
        return iso_date


def format_time(iso_datetime):
    if not iso_datetime:
        return ""
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d"):
        try:
            return datetime.strptime(iso_datetime, fmt).strftime("%H:%M")
        except ValueError:
            continue
    return iso_datetime


def acquire_single_instance():
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        sock.bind(("127.0.0.1", LOCK_PORT))
        return sock
    except OSError:
        return None


def normalize_remind_time(text):
    """解析提醒时间，返回 HH:MM 或 None。"""
    text = text.strip()
    if not text:
        return ""
    parts = text.split(":")
    if len(parts) != 2:
        return None
    try:
        h, m = int(parts[0]), int(parts[1])
        if 0 <= h <= 23 and 0 <= m <= 59:
            return f"{h:02d}:{m:02d}"
    except ValueError:
        pass
    return None


def show_notification(title, message):
    title = title.replace("'", "`'").replace('"', '`"')
    message = message.replace("'", "`'").replace('"', '`"')
    try:
        from plyer import notification
        notification.notify(title=title, message=message, app_name="每日任务", timeout=8)
        return
    except Exception:
        pass
    try:
        import subprocess
        ps = (
            "[reflection.assembly]::LoadWithPartialName('System.Windows.Forms')|Out-Null;"
            "[reflection.assembly]::LoadWithPartialName('System.Drawing')|Out-Null;"
            "$n=New-Object System.Windows.Forms.NotifyIcon;"
            "$n.Icon=[System.Drawing.SystemIcons]::Information;"
            "$n.Visible=$true;"
            f"$n.ShowBalloonTip(8000,'{title}','{message}',"
            "[System.Windows.Forms.ToolTipIcon]::Info);"
            "Start-Sleep -Milliseconds 800;$n.Dispose()"
        )
        subprocess.run(
            ["powershell", "-NoProfile", "-WindowStyle", "Hidden", "-Command", ps],
            creationflags=0x08000000, timeout=10,
        )
    except Exception:
        pass


def set_autostart(enable):
    script = APP_DIR / "启动任务清单.bat"
    key_path = r"Software\Microsoft\Windows\CurrentVersion\Run"
    with winreg.OpenKey(winreg.HKEY_CURRENT_USER, key_path, 0, winreg.KEY_SET_VALUE) as key:
        if enable:
            winreg.SetValueEx(key, AUTOSTART_NAME, 0, winreg.REG_SZ, f'"{script}"')
        else:
            try:
                winreg.DeleteValue(key, AUTOSTART_NAME)
            except FileNotFoundError:
                pass


def is_autostart_enabled():
    try:
        with winreg.OpenKey(
            winreg.HKEY_CURRENT_USER,
            r"Software\Microsoft\Windows\CurrentVersion\Run", 0, winreg.KEY_READ,
        ) as key:
            winreg.QueryValueEx(key, AUTOSTART_NAME)
            return True
    except FileNotFoundError:
        return False


def backup_data():
    if not DATA_FILE.exists():
        return None
    BACKUP_DIR.mkdir(exist_ok=True)
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    dst = BACKUP_DIR / f"tasks_{ts}.json"
    shutil.copy2(DATA_FILE, dst)
    if CSV_LOG_FILE.exists():
        shutil.copy2(CSV_LOG_FILE, BACKUP_DIR / f"log_{ts}.csv")
    files = sorted(BACKUP_DIR.glob("tasks_*.json"), reverse=True)
    for old in files[30:]:
        old.unlink(missing_ok=True)
        log = BACKUP_DIR / old.name.replace("tasks_", "log_")
        log.unlink(missing_ok=True)
    return dst


def _normalize_task(raw, fallback_date):
    created_at = raw.get("created_at") or f"{raw.get('created_date') or fallback_date} 00:00:00"
    return {
        "id": raw.get("id") or _new_id(),
        "text": raw["text"],
        "done": bool(raw.get("done", False)),
        "recurring_id": raw.get("recurring_id"),
        "created_date": raw.get("created_date") or fallback_date,
        "created_at": created_at,
        "completed_at": raw.get("completed_at"),
        "carried_from": raw.get("carried_from"),
        "tag": raw.get("tag") or "其他",
        "priority": raw.get("priority") or "中",
        "remind_at": raw.get("remind_at") or "",
        "reminded": bool(raw.get("reminded", False)),
    }


# ── CSV 日志 ─────────────────────────────────────────────

class TaskLogger:
    HEADERS = [
        "event_time", "event", "task_id", "text", "created_at", "completed_at",
        "recurring", "carried_from", "tag", "priority",
    ]

    def __init__(self, path):
        self.path = path
        if not path.exists():
            with open(path, "w", encoding="utf-8-sig", newline="") as f:
                csv.writer(f).writerow(self.HEADERS)

    def log(self, event, task):
        with open(self.path, "a", encoding="utf-8-sig", newline="") as f:
            csv.writer(f).writerow([
                _now_str(), event, task.get("id", ""), task.get("text", ""),
                task.get("created_at", ""), task.get("completed_at") or "",
                "yes" if task.get("recurring_id") else "no",
                task.get("carried_from") or "",
                task.get("tag", ""), task.get("priority", ""),
            ])


# ── 数据存储 ─────────────────────────────────────────────

class TaskStore:
    def __init__(self, path, logger):
        self.path = path
        self.logger = logger
        self.data = {
            "version": 3, "recurring": [], "daily": {},
            "meta": {"last_opened": None, "ball_y": None, "dock_side": "right"},
        }
        self.tasks = []
        self._load()
        self._prepare_today()

    def _load(self):
        if not self.path.exists():
            return
        try:
            with open(self.path, "r", encoding="utf-8") as f:
                self.data = self._migrate(json.load(f))
        except (json.JSONDecodeError, OSError):
            pass

    def _migrate(self, raw):
        if not isinstance(raw, dict):
            return self.data
        if raw.get("version", 2) < 3:
            raw["version"] = 3
            raw.setdefault("meta", {})
            for day, tasks in raw.get("daily", {}).items():
                if isinstance(tasks, list):
                    raw["daily"][day] = [_normalize_task(t, day) for t in tasks]
        if "ball_y" not in raw.get("meta", {}):
            raw.setdefault("meta", {})["ball_y"] = None
            raw["meta"]["dock_side"] = "right"
        return raw

    def get_ball_pos(self):
        m = self.data.get("meta", {})
        return m.get("ball_y"), m.get("dock_side", "right")

    def save_ball_pos(self, y, side):
        self.data.setdefault("meta", {})["ball_y"] = y
        self.data["meta"]["dock_side"] = side

    def _save(self):
        today = date.today().isoformat()
        self.data["daily"][today] = self.tasks
        self.data["meta"]["last_opened"] = today
        with open(self.path, "w", encoding="utf-8") as f:
            json.dump(self.data, f, ensure_ascii=False, indent=2)
        backup_data()

    def _task_from_template(self, text, today, now, **extra):
        return {
            "id": _new_id(), "text": text, "done": False,
            "created_date": today, "created_at": now,
            "completed_at": None, "carried_from": None,
            "tag": extra.get("tag", "其他"),
            "priority": extra.get("priority", "中"),
            "remind_at": extra.get("remind_at", ""),
            "reminded": False,
            **{k: v for k, v in extra.items() if k in ("recurring_id",)},
        }

    def _build_new_day_tasks(self, last_date):
        today = date.today().isoformat()
        now = _now_str()
        new_tasks, seen = [], set()

        for item in self.data.get("recurring", []):
            task = self._task_from_template(
                item["text"], today, now, recurring_id=item["id"],
                tag=item.get("tag", "其他"), priority=item.get("priority", "中"),
                remind_at=item.get("remind_at", ""),
            )
            new_tasks.append(task)
            seen.add(item["text"])
            self.logger.log("recurring_spawn", task)

        if last_date and last_date < today:
            for task in self.data["daily"].get(last_date, []):
                if task.get("done") or task.get("recurring_id"):
                    continue
                if task["text"] in seen:
                    continue
                carried = self._task_from_template(
                    task["text"], today, now,
                    created_date=task.get("created_date", last_date),
                    created_at=task.get("created_at") or f"{task.get('created_date', last_date)} 00:00:00",
                    carried_from=last_date,
                    tag=task.get("tag", "其他"), priority=task.get("priority", "中"),
                    remind_at=task.get("remind_at", ""),
                )
                new_tasks.append(carried)
                seen.add(task["text"])
                self.logger.log("carryover", carried)
        return new_tasks

    def _prepare_today(self):
        today = date.today().isoformat()
        last = self.data["meta"].get("last_opened")
        if last == today:
            self.tasks = [_normalize_task(t, today) for t in self.data["daily"].get(today, [])]
            return
        if last is None:
            if today in self.data["daily"]:
                self.tasks = [_normalize_task(t, today) for t in self.data["daily"][today]]
            else:
                self.tasks = self._build_new_day_tasks(None)
                self.data["daily"][today] = self.tasks
        else:
            self.tasks = self._build_new_day_tasks(last)
            self.data["daily"][today] = self.tasks
        self.data["meta"]["last_opened"] = today
        self._save()

    def add_task(self, text, recurring=False, tag="其他", priority="中", remind_at=""):
        today, now = date.today().isoformat(), _now_str()
        if recurring:
            rid = _new_id()
            self.data.setdefault("recurring", []).append({
                "id": rid, "text": text, "created": today,
                "tag": tag, "priority": priority, "remind_at": remind_at,
            })
            task = self._task_from_template(text, today, now, recurring_id=rid,
                                            tag=tag, priority=priority, remind_at=remind_at)
        else:
            task = self._task_from_template(text, today, now,
                                            tag=tag, priority=priority, remind_at=remind_at)
        self.tasks.append(task)
        self.logger.log("add", task)
        self._save()

    def toggle_task(self, index):
        task = self.tasks[index]
        if task["done"]:
            task["done"] = False
            task["completed_at"] = None
            task["reminded"] = False
            self.logger.log("uncomplete", task)
        else:
            task["done"] = True
            task["completed_at"] = _now_str()
            self.logger.log("complete", task)
        self._save()

    def delete_task(self, index):
        self.logger.log("delete", self.tasks[index])
        self.tasks.pop(index)
        self._save()

    def stop_recurring(self, index):
        task = self.tasks[index]
        rid = task.get("recurring_id")
        if rid:
            self.data["recurring"] = [r for r in self.data.get("recurring", []) if r["id"] != rid]
        self.logger.log("stop_recurring", task)
        self.tasks.pop(index)
        self._save()

    def clear_completed(self):
        for task in self.tasks:
            if task["done"]:
                self.logger.log("clear_completed", task)
        self.tasks = [t for t in self.tasks if not t["done"]]
        self._save()

    def check_reminders(self):
        now = datetime.now()
        hm = now.strftime("%H:%M")
        triggered = []
        for task in self.tasks:
            if task["done"] or not task.get("remind_at") or task.get("reminded"):
                continue
            if task["remind_at"] == hm:
                task["reminded"] = True
                triggered.append(task)
        if triggered:
            self._save()
        return triggered

    def weekly_stats(self):
        today = date.today()
        week_start = today - timedelta(days=6)
        total, done, by_tag, delayed = 0, 0, {}, []
        for i in range(7):
            d = (week_start + timedelta(days=i)).isoformat()
            for task in self.data.get("daily", {}).get(d, []):
                total += 1
                tag = task.get("tag", "其他")
                by_tag[tag] = by_tag.get(tag, 0) + 1
                if task.get("done"):
                    done += 1
                elif d < today.isoformat() and not task.get("done"):
                    delayed.append(task.get("text", ""))
        rate = f"{done * 100 // total}%" if total else "—"
        return {
            "total": total, "done": done, "rate": rate,
            "by_tag": by_tag,
            "delayed": list(dict.fromkeys(delayed))[:8],
            "week_start": week_start.strftime("%m月%d日"),
            "week_end": today.strftime("%m月%d日"),
        }


# ── 主界面 ─────────────────────────────────────────────

class DailyTaskApp:
    def __init__(self):
        self.root = tk.Tk()
        self.root.title("每日任务")
        self.root.configure(bg=COLORS["bg"])
        self.root.attributes("-topmost", True)
        self.root.attributes("-alpha", BALL_ALPHA_IDLE)
        self.root.overrideredirect(True)

        self.store = TaskStore(DATA_FILE, TaskLogger(CSV_LOG_FILE))
        self.mode = "ball"
        self._drag_x = self._drag_y = 0
        self._ball_dragged = False
        self._hover_timer = self._collapse_timer = self._retract_timer = None
        self._hovering = False
        self._in_tray = False
        self.task_widgets = []
        self.preview_widgets = []
        self.tray_icon = None

        saved_y, saved_side = self.store.get_ball_pos()
        self._ball_y = saved_y
        self._dock_side = saved_side or "right"

        self._setup_fonts()
        self._build_ball_ui()
        self._build_preview_ui()
        self._build_full_ui()
        self._setup_tray()
        self._refresh_all()

        self.root.bind("<Enter>", self._on_window_enter)
        self.root.bind("<Leave>", self._on_window_leave)
        self.root.protocol("WM_DELETE_WINDOW", self.hide_to_tray)
        self._schedule_reminders()
        self._apply_ball_theme()
        self._show_ball()

    @property
    def tasks(self):
        return self.store.tasks

    def _setup_fonts(self):
        self.font_title = tkfont.Font(family="Microsoft YaHei UI", size=12, weight="bold")
        self.font_body = tkfont.Font(family="Microsoft YaHei UI", size=10)
        self.font_small = tkfont.Font(family="Microsoft YaHei UI", size=9)
        self.font_icon = tkfont.Font(family="Segoe UI Symbol", size=11)
        self.font_badge = tkfont.Font(family="Microsoft YaHei UI", size=9, weight="bold")
        self.font_tag = tkfont.Font(family="Microsoft YaHei UI", size=8)

    # ── 托盘 ──

    def _create_tray_image(self):
        from PIL import Image, ImageDraw
        img = Image.new("RGBA", (64, 64), (0, 0, 0, 0))
        d = ImageDraw.Draw(img)
        d.ellipse((4, 4, 60, 60), fill="#FFFFFF", outline="#4ECDC4", width=3)
        d.line((20, 32, 28, 40, 38, 24), fill="#4ECDC4", width=3)
        d.line((42, 28, 52, 28), fill="#4ECDC4", width=2)
        d.line((42, 36, 52, 36), fill="#4ECDC4", width=2)
        return img

    def _setup_tray(self):
        try:
            import pystray
            menu = pystray.Menu(
                pystray.MenuItem("打开面板", lambda: self.root.after(0, self._tray_open)),
                pystray.MenuItem("显示悬浮球", lambda: self.root.after(0, self._tray_show_ball)),
                pystray.Menu.SEPARATOR,
                pystray.MenuItem("完全退出", lambda: self.root.after(0, self._quit)),
            )
            self.tray_icon = pystray.Icon(
                "daily_tasks", self._create_tray_image(), "每日任务", menu,
            )
            threading.Thread(target=self.tray_icon.run, daemon=True).start()
        except Exception:
            self.tray_icon = None

    def _tray_open(self):
        self._in_tray = False
        self.root.deiconify()
        self.root.attributes("-topmost", True)
        self._open_full()

    def _tray_show_ball(self):
        self._in_tray = False
        self.root.deiconify()
        self.root.attributes("-topmost", True)
        self._show_ball()

    def hide_to_tray(self):
        if self.tray_icon is None:
            messagebox.showinfo(
                "系统托盘",
                "托盘功能需要安装依赖。\n请双击运行「安装依赖.bat」后重启程序。",
            )
            return
        self._in_tray = True
        self.root.withdraw()

    def _quit(self):
        if self.tray_icon:
            self.tray_icon.stop()
        self.root.destroy()

    # ── 悬浮球 ──

    def _set_ball_opacity(self, active):
        self.root.attributes("-alpha", BALL_ALPHA_ACTIVE if active else BALL_ALPHA_IDLE)

    def _apply_ball_theme(self):
        self.root.attributes("-transparentcolor", TRANSPARENT)
        self.root.configure(bg=TRANSPARENT)
        self.ball_frame.configure(bg=TRANSPARENT)
        self.ball_canvas.configure(bg=TRANSPARENT)
        self._set_ball_opacity(active=False)

    def _apply_full_theme(self):
        self.root.attributes("-transparentcolor", "")
        self.root.configure(bg=COLORS["bg"])
        self.full_frame.configure(bg=COLORS["bg"])
        self.root.attributes("-alpha", PANEL_ALPHA)

    def _build_ball_ui(self):
        self.ball_frame = tk.Frame(self.root, bg=TRANSPARENT)
        self.ball_canvas = tk.Canvas(
            self.ball_frame, width=BALL_SIZE, height=BALL_SIZE,
            bg=TRANSPARENT, highlightthickness=0, cursor="hand2",
        )
        self.ball_canvas.pack()
        self._draw_ball()
        self.ball_canvas.bind("<Button-1>", self._ball_press)
        self.ball_canvas.bind("<B1-Motion>", self._ball_drag)
        self.ball_canvas.bind("<ButtonRelease-1>", self._ball_release)
        self.ball_canvas.bind("<Button-3>", self._show_ball_menu)
        self.ball_canvas.bind("<Enter>", self._on_ball_enter)
        self.ball_canvas.bind("<Leave>", self._on_ball_leave)

    def _on_ball_enter(self):
        self._cancel_retract_timer()
        self._expand_ball()
        self._draw_ball(hover=True)
        if self.mode == "ball":
            self._cancel_hover_timer()
            self._hover_timer = self.root.after(HOVER_DELAY_MS, self._show_preview)

    def _on_ball_leave(self):
        self._draw_ball(hover=False)
        self._cancel_hover_timer()
        if self.mode == "ball":
            self._schedule_retract()

    def _cancel_retract_timer(self):
        if self._retract_timer:
            self.root.after_cancel(self._retract_timer)
            self._retract_timer = None

    def _schedule_retract(self):
        self._cancel_retract_timer()
        self._retract_timer = self.root.after(280, self._retract_ball)

    def _expand_ball(self):
        """悬停时完全滑出并提高透明度。"""
        if self.mode != "ball":
            return
        if self._ball_y is None:
            sh = self.root.winfo_screenheight()
            self._ball_y = max(0, (sh - BALL_SIZE) // 2)
        sw = self.root.winfo_screenwidth()
        x = sw - BALL_SIZE if self._dock_side == "right" else 0
        self.root.geometry(f"{BALL_SIZE}x{BALL_SIZE}+{x}+{self._ball_y}")
        self._set_ball_opacity(active=True)

    def _retract_ball(self):
        """移开后贴边收起，只露 1/3。"""
        if self.mode != "ball":
            return
        self._dock_to_edge(keep_side=True, partial=True)

    def _cancel_hover_timer(self):
        if self._hover_timer:
            self.root.after_cancel(self._hover_timer)
            self._hover_timer = None

    def _show_ball_menu(self, event):
        menu = tk.Menu(self.root, tearoff=0, bg=COLORS["surface"], fg=COLORS["text"],
                       activebackground=COLORS["accent"], activeforeground="#ffffff",
                       font=self.font_small, bd=0)
        menu.add_command(label="打开面板", command=self._open_full)
        menu.add_command(label="隐藏到托盘", command=self.hide_to_tray)
        menu.add_separator()
        menu.add_command(label="完全退出", command=self._quit)
        menu.tk_popup(event.x_root, event.y_root)

    def _draw_ball(self, hover=False):
        c = self.ball_canvas
        c.delete("all")
        cx, cy, r = BALL_SIZE // 2, BALL_SIZE // 2, 27
        idle = self.mode == "ball" and not hover
        if not idle:
            c.create_oval(cx - r + 2, cy - r + 6, cx + r + 2, cy + r + 6, fill=BALL["shadow"], outline="")
            c.create_oval(cx - r + 1, cy - r + 4, cx + r + 1, cy + r + 4, fill=BALL["shadow_soft"], outline="")
        ring = BALL["ring_hover"] if hover else ("#ECECEC" if idle else BALL["ring"])
        body = "#F8F8F8" if idle else BALL["body"]
        c.create_oval(cx - r, cy - r, cx + r, cy + r, fill=body, outline=ring, width=1.2 if idle else 1.5)
        if not idle:
            c.create_oval(cx - r + 3, cy - r + 8, cx + r - 3, cy + r - 2, fill=BALL["shade"], outline="")
            c.create_oval(cx - r + 2, cy - r + 2, cx + r - 4, cy + r - 8, fill=BALL["body"], outline="")
            c.create_oval(cx - r + 7, cy - r + 5, cx - r + 22, cy - r + 18, fill="#FFFFFF", outline="")
        self._draw_hd_icon(cx, cy, faint=idle)
        count, is_high = self._badge_info()
        if count > 0:
            self._draw_hd_badge(count, is_high)

    def _draw_hd_icon(self, cx, cy, faint=False):
        c, lw = self.ball_canvas, 2.2
        color = "#B0DDD8" if faint else BALL["icon"]
        dark = "#90CFC9" if faint else BALL["icon_dark"]
        fill = "#F8F8F8" if faint else BALL["body"]
        c.create_rectangle(cx - 13, cy - 11, cx - 5, cy - 3, outline=color, width=1.4 if faint else 1.6, fill=fill)
        c.create_line(cx - 12, cy - 7, cx - 9, cy - 4, cx - 6, cy - 9,
                      fill=dark, width=lw, capstyle=tk.ROUND, joinstyle=tk.ROUND)
        for yoff in (-8, -1, 6, 13):
            c.create_line(cx - 2, cy + yoff, cx + 15, cy + yoff, fill=color, width=lw, capstyle=tk.ROUND)

    def _draw_hd_badge(self, count, is_high):
        c = self.ball_canvas
        bx, by, br = BALL_SIZE - 13, 13, 11
        fill = BALL["badge_high"] if is_high else BALL["badge"]
        c.create_oval(bx - br, by - br, bx + br, by + br, fill=fill, outline="#FFFFFF", width=2)
        c.create_oval(bx - br + 2, by - br + 2, bx + br - 5, by + br - 5, fill=BALL["badge_light"], outline="")
        text = str(count) if count < 100 else "99+"
        c.create_text(bx, by, text=text, fill=BALL["badge_text"], font=self.font_badge)

    def _badge_info(self):
        pending = [t for t in self.tasks if not t["done"]]
        high = [t for t in pending if t.get("priority") == "高"]
        if high:
            return len(high), True
        return len(pending), False

    def _pending_count(self):
        return self._badge_info()[0]

    def _ball_press(self, event):
        self._ball_dragged = False
        self._drag_x, self._drag_y = event.x_root, event.y_root
        self._win_x, self._win_y = self.root.winfo_x(), self.root.winfo_y()

    def _ball_drag(self, event):
        dx, dy = event.x_root - self._drag_x, event.y_root - self._drag_y
        if abs(dx) > 3 or abs(dy) > 3:
            self._ball_dragged = True
            self._cancel_retract_timer()
            self._set_ball_opacity(active=True)
        self.root.geometry(f"+{self._win_x + dx}+{self._win_y + dy}")

    def _ball_release(self, event):
        if self._ball_dragged:
            self._ball_y = self.root.winfo_y()
            sw = self.root.winfo_screenwidth()
            cx = self.root.winfo_x() + BALL_SIZE // 2
            self._dock_side = "left" if cx < sw // 2 else "right"
            self._dock_to_edge(keep_side=True, partial=True)
            self.store.save_ball_pos(self._ball_y, self._dock_side)
        else:
            self._cancel_hover_timer()
            self._open_full()

    # ── 悬停预览（快速勾选）──

    def _build_preview_ui(self):
        self.preview_frame = tk.Frame(self.root, bg=COLORS["bg"])
        header = tk.Frame(self.preview_frame, bg=COLORS["surface"], height=40)
        header.pack(fill=tk.X)
        header.pack_propagate(False)
        self.preview_title = tk.Label(
            header, text="待完成", bg=COLORS["surface"], fg=COLORS["text"],
            font=self.font_title, anchor="w", padx=12,
        )
        self.preview_title.pack(side=tk.LEFT, fill=tk.Y)
        btns = tk.Frame(header, bg=COLORS["surface"])
        btns.pack(side=tk.RIGHT, padx=8)
        for text, cmd in [("管理", self._open_full), ("─", self._collapse_preview)]:
            b = self._make_title_btn(btns, text, cmd, COLORS["accent"] if text == "管理" else COLORS["text_muted"])
            b.pack(side=tk.LEFT, padx=2)
        self.preview_list = tk.Frame(self.preview_frame, bg=COLORS["bg"], padx=10, pady=8)
        self.preview_list.pack(fill=tk.BOTH, expand=True)

    def _collapse_preview(self):
        self._ball_y = self.root.winfo_y()
        self._show_ball()

    def _refresh_preview(self):
        for w in self.preview_widgets:
            w.destroy()
        self.preview_widgets.clear()
        pending = [(i, t) for i, t in enumerate(self.tasks) if not t["done"]]
        self.preview_title.configure(text=f"待完成 ({len(pending)})")
        if not pending:
            lbl = tk.Label(self.preview_list, text="🎉 全部完成！", bg=COLORS["bg"],
                           fg=COLORS["done"], font=self.font_body, pady=16)
            lbl.pack()
            self.preview_widgets.append(lbl)
        else:
            for idx, task in pending[:PREVIEW_MAX_ITEMS]:
                row = tk.Frame(self.preview_list, bg=COLORS["surface"])
                row.pack(fill=tk.X, pady=3)
                check = tk.Label(row, text="☐", bg=COLORS["surface"],
                                 fg=TAG_COLORS.get(task.get("tag"), COLORS["text_muted"]),
                                 font=self.font_icon, cursor="hand2", padx=8)
                check.pack(side=tk.LEFT)
                check.bind("<Button-1>", lambda e, i=idx: self._toggle_task(i))
                text = task["text"][:26] + ("…" if len(task["text"]) > 26 else "")
                pri = task.get("priority", "中")
                lbl = tk.Label(
                    row, text=f"[{pri}] {text}", bg=COLORS["surface"], fg=COLORS["text"],
                    font=self.font_body, anchor="w", cursor="hand2",
                )
                lbl.pack(side=tk.LEFT, fill=tk.X, expand=True, pady=8, padx=(0, 8))
                lbl.bind("<Button-1>", lambda e, i=idx: self._toggle_task(i))
                self.preview_widgets.extend([row, check, lbl])
            if len(pending) > PREVIEW_MAX_ITEMS:
                m = tk.Label(self.preview_list, text=f"还有 {len(pending) - PREVIEW_MAX_ITEMS} 项…",
                             bg=COLORS["bg"], fg=COLORS["text_muted"], font=self.font_small)
                m.pack()
                self.preview_widgets.append(m)
        self._draw_ball()

    def _preview_height(self):
        n = len([t for t in self.tasks if not t["done"]])
        if n == 0:
            return 100
        return 72 + min(n, PREVIEW_MAX_ITEMS) * 40 + (24 if n > PREVIEW_MAX_ITEMS else 0)

    # ── 完整面板 ──

    def _build_full_ui(self):
        self.full_frame = tk.Frame(self.root, bg=COLORS["bg"])
        title_bar = tk.Frame(self.full_frame, bg=COLORS["surface"], height=44)
        title_bar.pack(fill=tk.X)
        title_bar.pack_propagate(False)
        title_bar.bind("<Button-1>", self._start_drag)
        title_bar.bind("<B1-Motion>", self._on_drag)
        wd = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"]
        tl = tk.Label(
            title_bar,
            text=f"📋 今日任务 · {date.today().strftime('%Y年%m月%d日')} {wd[date.today().weekday()]}",
            bg=COLORS["surface"], fg=COLORS["text"], font=self.font_title, anchor="w", padx=14,
        )
        tl.pack(side=tk.LEFT, fill=tk.Y)
        tl.bind("<Button-1>", self._start_drag)
        tl.bind("<B1-Motion>", self._on_drag)
        bf = tk.Frame(title_bar, bg=COLORS["surface"])
        bf.pack(side=tk.RIGHT, padx=8)
        self._make_title_btn(bf, "收起", self._close_full, COLORS["text_muted"]).pack(side=tk.LEFT, padx=2)
        self._make_title_btn(bf, "托盘", self.hide_to_tray, COLORS["text_muted"]).pack(side=tk.LEFT, padx=2)

        pf = tk.Frame(self.full_frame, bg=COLORS["bg"], pady=10)
        pf.pack(fill=tk.X, padx=14)
        self.progress_label = tk.Label(pf, text="0 / 0 已完成", bg=COLORS["bg"],
                                       fg=COLORS["text_muted"], font=self.font_small, anchor="w")
        self.progress_label.pack(fill=tk.X)
        self.progress_canvas = tk.Canvas(pf, height=6, bg=COLORS["surface"], highlightthickness=0)
        self.progress_canvas.pack(fill=tk.X, pady=(6, 0))

        lo = tk.Frame(self.full_frame, bg=COLORS["bg"])
        lo.pack(fill=tk.BOTH, expand=True, padx=14, pady=(4, 8))
        self.canvas = tk.Canvas(lo, bg=COLORS["bg"], highlightthickness=0)
        sb = tk.Scrollbar(lo, orient=tk.VERTICAL, command=self.canvas.yview)
        self.task_frame = tk.Frame(self.canvas, bg=COLORS["bg"])
        self.task_frame.bind("<Configure>", lambda e: self.canvas.configure(scrollregion=self.canvas.bbox("all")))
        self.canvas_window = self.canvas.create_window((0, 0), window=self.task_frame, anchor="nw")
        self.canvas.configure(yscrollcommand=sb.set)
        self.canvas.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        sb.pack(side=tk.RIGHT, fill=tk.Y)
        self.canvas.bind("<Configure>", lambda e: self.canvas.itemconfig(self.canvas_window, width=e.width))
        self.canvas.bind("<MouseWheel>", lambda e: self.canvas.yview_scroll(int(-1 * (e.delta / 120)), "units"))

        af = tk.Frame(self.full_frame, bg=COLORS["bg"], pady=8)
        af.pack(fill=tk.X, padx=14)
        self.entry = tk.Entry(af, font=self.font_body, bg=COLORS["surface"], fg=COLORS["text"],
                              insertbackground=COLORS["text"], relief=tk.FLAT,
                              highlightthickness=1, highlightbackground=COLORS["border"],
                              highlightcolor=COLORS["accent"])
        self.entry.pack(fill=tk.X, ipady=8, pady=(0, 6))
        self.entry.bind("<Return>", lambda e: self._add_task())

        opt1 = tk.Frame(self.full_frame, bg=COLORS["bg"])
        opt1.pack(fill=tk.X, padx=14, pady=(0, 4))
        tk.Label(opt1, text="标签", bg=COLORS["bg"], fg=COLORS["text_muted"], font=self.font_small).pack(side=tk.LEFT)
        self.tag_var = tk.StringVar(value="其他")
        ttk.Combobox(opt1, textvariable=self.tag_var, values=TAGS, width=6, state="readonly").pack(side=tk.LEFT, padx=6)
        tk.Label(opt1, text="优先级", bg=COLORS["bg"], fg=COLORS["text_muted"], font=self.font_small).pack(side=tk.LEFT, padx=(8, 0))
        self.priority_var = tk.StringVar(value="中")
        ttk.Combobox(opt1, textvariable=self.priority_var, values=PRIORITIES, width=4, state="readonly").pack(side=tk.LEFT, padx=6)
        tk.Label(opt1, text="提醒", bg=COLORS["bg"], fg=COLORS["text_muted"], font=self.font_small).pack(side=tk.LEFT, padx=(8, 0))
        self.remind_var = tk.StringVar(value="")
        tk.Entry(opt1, textvariable=self.remind_var, width=6, font=self.font_small,
                 bg=COLORS["surface"], fg=COLORS["text"], insertbackground=COLORS["text"]).pack(side=tk.LEFT, padx=4)
        tk.Label(opt1, text="(时:分)", bg=COLORS["bg"], fg=COLORS["text_muted"], font=self.font_tag).pack(side=tk.LEFT)

        opt2 = tk.Frame(self.full_frame, bg=COLORS["bg"])
        opt2.pack(fill=tk.X, padx=14, pady=(0, 8))
        self.recurring_var = tk.BooleanVar(value=False)
        tk.Checkbutton(opt2, text="常驻任务", variable=self.recurring_var, bg=COLORS["bg"],
                       fg=COLORS["text_muted"], selectcolor=COLORS["surface"],
                       font=self.font_small, highlightthickness=0, bd=0).pack(side=tk.LEFT)
        add_btn = tk.Label(opt2, text="添加任务", bg=COLORS["accent"], fg="#fff",
                           font=self.font_body, padx=14, pady=6, cursor="hand2")
        add_btn.pack(side=tk.RIGHT)
        add_btn.bind("<Button-1>", lambda e: self._add_task())

        footer = tk.Frame(self.full_frame, bg=COLORS["bg"])
        footer.pack(fill=tk.X, padx=14, pady=(0, 12))
        for text, cmd in [
            ("清除已完成", self._clear_completed),
            ("每周回顾", self._show_weekly),
            ("备份", self._manual_backup),
            ("设置", self._show_settings),
        ]:
            lb = tk.Label(footer, text=text, bg=COLORS["bg"], fg=COLORS["text_muted"],
                          font=self.font_small, cursor="hand2", padx=4)
            lb.pack(side=tk.LEFT)
            lb.bind("<Button-1>", lambda e, c=cmd: c())
            lb.bind("<Enter>", lambda e, w=lb: w.configure(fg=COLORS["accent"]))
            lb.bind("<Leave>", lambda e, w=lb: w.configure(fg=COLORS["text_muted"]))

    def _make_title_btn(self, parent, text, command, color):
        btn = tk.Label(parent, text=text, bg=COLORS["surface"], fg=color,
                       font=self.font_small, padx=8, pady=4, cursor="hand2")
        btn.bind("<Button-1>", lambda e: command())
        btn.bind("<Enter>", lambda e: btn.configure(bg=COLORS["surface_hover"]))
        btn.bind("<Leave>", lambda e: btn.configure(bg=COLORS["surface"]))
        return btn

    # ── 设置 / 回顾 / 备份 ──

    def _show_settings(self):
        win = tk.Toplevel(self.root)
        win.title("设置")
        win.configure(bg=COLORS["bg"])
        win.geometry("300x230")
        win.attributes("-topmost", True)
        auto_var = tk.BooleanVar(value=is_autostart_enabled())
        tk.Checkbutton(
            win, text="开机自动启动", variable=auto_var, bg=COLORS["bg"], fg=COLORS["text"],
            selectcolor=COLORS["surface"], font=self.font_body, highlightthickness=0,
        ).pack(anchor="w", padx=20, pady=(20, 8))
        tk.Label(win, text="关闭窗口后隐藏到系统托盘", bg=COLORS["bg"],
                 fg=COLORS["text_muted"], font=self.font_small).pack(anchor="w", padx=20)
        tk.Label(win, text="提醒：添加任务时填 时:分，到点弹通知", bg=COLORS["bg"],
                 fg=COLORS["text_muted"], font=self.font_small).pack(anchor="w", padx=20, pady=(6, 0))

        def test_notify():
            show_notification("📋 任务提醒", "测试成功！到点时会这样提醒你。")

        tk.Button(win, text="测试提醒通知", command=test_notify, bg=COLORS["surface"],
                  fg=COLORS["accent"], font=self.font_small, relief=tk.FLAT, padx=10, pady=4).pack(pady=6)

        def save():
            set_autostart(auto_var.get())
            messagebox.showinfo("设置", "已保存", parent=win)
            win.destroy()

        tk.Button(win, text="保存", command=save, bg=COLORS["accent"], fg="#fff",
                  font=self.font_body, relief=tk.FLAT, padx=20, pady=6).pack(pady=16)

    def _show_weekly(self):
        s = self.store.weekly_stats()
        win = tk.Toplevel(self.root)
        win.title("每周回顾")
        win.configure(bg=COLORS["bg"])
        win.geometry("320x360")
        win.attributes("-topmost", True)
        tk.Label(win, text=f"📊 {s['week_start']} — {s['week_end']}", bg=COLORS["surface"],
                 fg=COLORS["text"], font=self.font_title, anchor="w", padx=14, pady=10).pack(fill=tk.X)
        body = tk.Frame(win, bg=COLORS["bg"], padx=16, pady=12)
        body.pack(fill=tk.BOTH, expand=True)
        lines = [
            f"共 {s['total']} 项任务，完成 {s['done']} 项",
            f"完成率：{s['rate']}",
            "",
            "标签分布：",
        ]
        for tag, cnt in s["by_tag"].items():
            lines.append(f"  · {tag}：{cnt} 项")
        if s["delayed"]:
            lines.extend(["", "常拖延任务："])
            for t in s["delayed"]:
                lines.append(f"  · {t}")
        tk.Label(body, text="\n".join(lines), bg=COLORS["bg"], fg=COLORS["text"],
                 font=self.font_body, anchor="nw", justify=tk.LEFT).pack(fill=tk.BOTH, expand=True)

    def _manual_backup(self):
        path = backup_data()
        if path:
            messagebox.showinfo("备份", f"已备份到：\n{path.parent}\n{path.name}")
        else:
            messagebox.showwarning("备份", "暂无数据可备份")

    # ── 提醒 ──

    def _schedule_reminders(self):
        for task in self.store.check_reminders():
            tag = task.get("tag", "")
            pri = task.get("priority", "")
            extra = f" [{tag}/{pri}]" if tag else ""
            show_notification("📋 任务提醒", f"{task['text']}{extra}")
        self.root.after(15000, self._schedule_reminders)

    # ── 模式切换 ──

    def _on_window_enter(self, event=None):
        self._hovering = True
        self._cancel_collapse()

    def _on_window_leave(self, event=None):
        self._hovering = False
        if self.mode == "preview":
            self._schedule_collapse()

    def _schedule_collapse(self):
        self._cancel_collapse()
        self._collapse_timer = self.root.after(AUTO_COLLAPSE_MS, self._try_collapse)

    def _cancel_collapse(self):
        if self._collapse_timer:
            self.root.after_cancel(self._collapse_timer)
            self._collapse_timer = None

    def _try_collapse(self):
        if self.mode != "preview" or self._hovering:
            return
        self._ball_y = self.root.winfo_y()
        self._show_ball()

    def _show_ball(self):
        self.mode = "ball"
        self.full_frame.pack_forget()
        self.preview_frame.pack_forget()
        self.ball_frame.pack()
        self._apply_ball_theme()
        self.root.deiconify()
        self.root.geometry(f"{BALL_SIZE}x{BALL_SIZE}")
        first = self._ball_y is None
        self._dock_to_edge(force_right=first, keep_side=not first, partial=True)
        self.store.save_ball_pos(self._ball_y, self._dock_side)
        self._draw_ball(hover=False)

    def _show_preview(self):
        if self.mode != "ball":
            return
        self.mode = "preview"
        self.full_frame.pack_forget()
        self.ball_frame.pack_forget()
        self.preview_frame.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        self.ball_frame.pack(side=tk.RIGHT)
        h = self._preview_height()
        w = PREVIEW_WIDTH + BALL_SIZE
        x, y = self._panel_position(w, h)
        self.root.geometry(f"{w}x{h}+{x}+{y}")
        self._set_ball_opacity(active=True)
        self._refresh_preview()

    def _open_full(self):
        self._cancel_hover_timer()
        self._cancel_collapse()
        self.mode = "full"
        self.preview_frame.pack_forget()
        self.ball_frame.pack_forget()
        self._apply_full_theme()
        self.full_frame.pack(fill=tk.BOTH, expand=True)
        if self._ball_y is None:
            self._ball_y = self.root.winfo_y()
        x, y = self._panel_position(FULL_WIDTH, FULL_HEIGHT)
        self.root.geometry(f"{FULL_WIDTH}x{FULL_HEIGHT}+{x}+{y}")
        self.root.deiconify()
        self._refresh_list()
        self.root.after(100, lambda: self.entry.focus_set())

    def _close_full(self):
        self._ball_y = self.root.winfo_y()
        self.store.save_ball_pos(self._ball_y, self._dock_side)
        self._show_ball()

    def _panel_position(self, width, height):
        sw, sh = self.root.winfo_screenwidth(), self.root.winfo_screenheight()
        y = max(0, min(self._ball_y or (sh - height) // 2, sh - height))
        x = sw - width if self._dock_side == "right" else 0
        if self.mode == "full":
            x = max(0, min(self.root.winfo_x(), sw - width))
            y = max(0, min(self.root.winfo_y(), sh - height))
        return x, y

    def _dock_x(self, partial=False):
        sw = self.root.winfo_screenwidth()
        if self._dock_side == "right":
            return sw - (BALL_DOCK_VISIBLE if partial else BALL_SIZE)
        return -(BALL_SIZE - BALL_DOCK_VISIBLE) if partial else 0

    def _dock_to_edge(self, force_right=False, keep_side=False, partial=False):
        sw, sh = self.root.winfo_screenwidth(), self.root.winfo_screenheight()
        if force_right:
            self._dock_side = "right"
        elif not keep_side:
            cx = self.root.winfo_x() + (BALL_DOCK_VISIBLE if partial else BALL_SIZE // 2)
            self._dock_side = "left" if cx < sw // 2 else "right"
        if self._ball_y is None:
            self._ball_y = max(0, (sh - BALL_SIZE) // 2)
        x = self._dock_x(partial=partial)
        self.root.geometry(f"{BALL_SIZE}x{BALL_SIZE}+{x}+{self._ball_y}")
        if partial and self.mode == "ball":
            self._set_ball_opacity(active=False)

    # ── 任务操作 ──

    def _start_drag(self, event):
        self._drag_x, self._drag_y = event.x, event.y

    def _on_drag(self, event):
        self.root.geometry(f"+{self.root.winfo_x() + event.x - self._drag_x}+{self.root.winfo_y() + event.y - self._drag_y}")

    def _add_task(self):
        text = self.entry.get().strip()
        if not text:
            return
        remind = normalize_remind_time(self.remind_var.get())
        if self.remind_var.get().strip() and remind is None:
            messagebox.showwarning("提醒", "提醒时间格式不对，请用 时:分，如 9:30 或 15:00")
            return
        self.store.add_task(
            text, recurring=self.recurring_var.get(),
            tag=self.tag_var.get(), priority=self.priority_var.get(), remind_at=remind or "",
        )
        self.entry.delete(0, tk.END)
        self.remind_var.set("")
        self.recurring_var.set(False)
        self._refresh_all()

    def _toggle_task(self, index):
        self.store.toggle_task(index)
        self._refresh_all()

    def _delete_task(self, index):
        self.store.delete_task(index)
        self._refresh_all()

    def _stop_recurring(self, index):
        self.store.stop_recurring(index)
        self._refresh_all()

    def _clear_completed(self):
        self.store.clear_completed()
        self._refresh_all()

    def _refresh_all(self):
        self._draw_ball()
        if self.mode == "preview":
            self._refresh_preview()
        elif self.mode == "full":
            self._refresh_list()

    def _update_progress(self):
        total = len(self.tasks)
        done = sum(1 for t in self.tasks if t["done"])
        self.progress_label.configure(text=f"{done} / {total} 已完成")
        self.progress_canvas.delete("all")
        w = max(self.progress_canvas.winfo_width(), 300)
        self.progress_canvas.create_rectangle(0, 0, w, 6, fill=COLORS["surface"], outline="")
        if total and done:
            self.progress_canvas.create_rectangle(0, 0, int(w * done / total), 6, fill=COLORS["done"], outline="")

    def _refresh_list(self):
        for w in self.task_widgets:
            w.destroy()
        self.task_widgets.clear()
        if not self.tasks:
            e = tk.Label(self.task_frame, text="还没有任务，在下方添加吧 ✨",
                         bg=COLORS["bg"], fg=COLORS["text_muted"], font=self.font_body, pady=30)
            e.pack(fill=tk.X)
            self.task_widgets.append(e)
        else:
            for i, task in enumerate(self.tasks):
                self._create_task_row(i, task)
        self.root.after(50, self._update_progress)
        self._draw_ball()

    def _create_task_row(self, index, task):
        row = tk.Frame(self.task_frame, bg=COLORS["surface"])
        row.pack(fill=tk.X, pady=3)
        inner = tk.Frame(row, bg=COLORS["surface"])
        inner.pack(fill=tk.X, padx=10, pady=8)
        done = task["done"]
        check = tk.Label(inner, text="☑" if done else "☐", bg=COLORS["surface"],
                         fg=COLORS["done"] if done else COLORS["text_muted"],
                         font=self.font_icon, cursor="hand2")
        check.pack(side=tk.LEFT, padx=(0, 8))
        check.bind("<Button-1>", lambda e, i=index: self._toggle_task(i))
        tf = tk.Frame(inner, bg=COLORS["surface"])
        tf.pack(side=tk.LEFT, fill=tk.X, expand=True)
        tag = task.get("tag", "其他")
        pri = task.get("priority", "中")
        label = tk.Label(
            tf, text=task["text"], bg=COLORS["surface"],
            fg=COLORS["text_muted"] if done else COLORS["text"],
            font=tkfont.Font(family="Microsoft YaHei UI", size=10,
                             overstrike=done), anchor="w", wraplength=200, justify=tk.LEFT,
        )
        label.pack(fill=tk.X, anchor="w")
        label.bind("<Button-1>", lambda e, i=index: self._toggle_task(i))
        meta = [f"#{tag}", pri]
        if task.get("recurring_id"):
            meta.append("🔁常驻")
        if task.get("carried_from"):
            meta.append(f"延自{format_date(task['carried_from'])}")
        if task.get("remind_at"):
            meta.append(f"⏰{task['remind_at']}")
        meta.append(f"{format_time(task.get('created_at'))} 添加")
        if done and task.get("completed_at"):
            meta.append(f"{format_time(task['completed_at'])} 完成")
        tk.Label(tf, text=" · ".join(meta), bg=COLORS["surface"],
                 fg=PRIORITY_COLORS.get(pri, COLORS["text_muted"]), font=self.font_tag, anchor="w").pack(fill=tk.X)
        bf = tk.Frame(inner, bg=COLORS["surface"])
        bf.pack(side=tk.RIGHT)
        if task.get("recurring_id"):
            s = tk.Label(bf, text="停", bg=COLORS["surface"], fg=COLORS["recurring"],
                         font=self.font_small, cursor="hand2", padx=4)
            s.pack(side=tk.LEFT)
            s.bind("<Button-1>", lambda e, i=index: self._stop_recurring(i))
        d = tk.Label(bf, text="×", bg=COLORS["surface"], fg=COLORS["text_muted"],
                     font=self.font_icon, cursor="hand2", padx=4)
        d.pack(side=tk.LEFT)
        d.bind("<Button-1>", lambda e, i=index: self._delete_task(i))
        self.task_widgets.extend([row, inner, check, tf, label, bf, d])

    def run(self):
        self.root.mainloop()


def main():
    lock = acquire_single_instance()
    if lock is None:
        show_notification("每日任务", "程序已在运行中")
        sys.exit(0)
    DailyTaskApp().run()


if __name__ == "__main__":
    main()
