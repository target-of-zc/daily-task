import { useCallback, useEffect, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import {
  addTask,
  clearCompleted,
  deleteTask,
  exportWeekCsv,
  getAlwaysOnTop,
  getAutostart,
  getDarkTheme,
  getEmailSettings,
  getMacroAlarmEnabled,
  getWeeklyStats,
  listBackups,
  listScheduledDays,
  listTasks,
  manualBackup,
  minimizeMainWindow,
  reorderTasks,
  expandMainWindow,
  restoreBackup,
  setAutostart,
  setDarkTheme,
  setEmailSettings,
  setMacroAlarmEnabled,
  snoozeTask,
  syncMacroReminders,
  testEmailSettings,
  toggleTask,
  updateTask,
  stopRecurring,
} from "./api";
import MacroCalendar from "./MacroCalendar";
import BallDock from "./BallDock";
import TitleBar from "./TitleBar";
import type { BackupEntry, ScheduledDay, Task, WeeklyStats } from "./types";
import { playMacroAlarm } from "./utils/alarm";
import { buildTodayMacroAlertSlots } from "./utils/macroReminders";
import { formatScheduleDate, formatTaskTime, formatTodayHeader, todayIsoDate } from "./utils/timezone";
import { onWindowDragMouseDown, isWindowDragging } from "./utils/windowDrag";

type Tab = "tasks" | "calendar";
type WindowMode = "expanded" | "ball";

export default function App() {
  const [tab, setTab] = useState<Tab>("tasks");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [text, setText] = useState("");
  const [recurring, setRecurring] = useState(false);
  const [remindAt, setRemindAt] = useState("");
  const [targetDate, setTargetDate] = useState(todayIsoDate());
  const [autostart, setAutostartOn] = useState(false);
  const [alwaysOnTop, setAlwaysOnTopOn] = useState(false);
  const [weekly, setWeekly] = useState<WeeklyStats | null>(null);
  const [msg, setMsg] = useState("");
  const [adding, setAdding] = useState(false);
  const [showEmail, setShowEmail] = useState(false);
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [emailFrom, setEmailFrom] = useState("");
  const [emailTo, setEmailTo] = useState("");
  const [authCode, setAuthCode] = useState("");
  const [emailConfigured, setEmailConfigured] = useState(false);
  const [emailSaving, setEmailSaving] = useState(false);
  const [darkTheme, setDarkThemeOn] = useState(false);
  const [showPlans, setShowPlans] = useState(false);
  const [scheduledDays, setScheduledDays] = useState<ScheduledDay[]>([]);
  const [planCount, setPlanCount] = useState(0);
  const [showRestore, setShowRestore] = useState(false);
  const [backups, setBackups] = useState<BackupEntry[]>([]);
  const [restoring, setRestoring] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [editText, setEditText] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editRemind, setEditRemind] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [macroAlarmOn, setMacroAlarmOn] = useState(true);
  const [reminderBanner, setReminderBanner] = useState<Task | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [windowMode, setWindowMode] = useState<WindowMode>("expanded");
  const collapseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pointerInside = useRef(false);
  const windowModeRef = useRef<WindowMode>("expanded");
  windowModeRef.current = windowMode;

  const isInputFocused = () => {
    const el = document.activeElement;
    if (!el || !(el instanceof HTMLElement)) return false;
    return !!el.closest("input, textarea, select, [contenteditable='true']");
  };

  const shouldStayExpanded = useCallback(() => {
    if (pointerInside.current) return true;
    if (dragId || isWindowDragging()) return true;
    if (isInputFocused()) return true;
    if (reminderBanner) return true;
    if (showSettings || showPlans || editing || showEmail || showRestore || weekly) return true;
    return false;
  }, [dragId, reminderBanner, showSettings, showPlans, editing, showEmail, showRestore, weekly]);

  const showErr = (e: unknown) => {
    setMsg(e instanceof Error ? e.message : String(e));
    setTimeout(() => setMsg(""), 5000);
  };

  const refresh = useCallback(async () => {
    try {
      setTasks(await listTasks());
      const days = await listScheduledDays();
      setScheduledDays(days);
      setPlanCount(days.reduce((n, d) => n + d.tasks.length, 0));
    } catch (e) {
      showErr(e);
    }
  }, []);

  const applyTheme = (dark: boolean) => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
  };

  const openPlans = async () => {
    try {
      setScheduledDays(await listScheduledDays());
      setShowPlans(true);
    } catch (e) {
      showErr(e);
    }
  };

  const openRestore = async () => {
    try {
      setBackups(await listBackups());
      setShowRestore(true);
    } catch (e) {
      showErr(e);
    }
  };

  const resolveEditDate = (task: Task) => {
    const t = todayIsoDate();
    if (task.carried_from || task.created_date < t) return t;
    return task.created_date;
  };

  const openEdit = (task: Task) => {
    setEditing(task);
    setEditText(task.text);
    setEditDate(resolveEditDate(task));
    setEditRemind(task.remind_at || "");
  };

  const saveEdit = async () => {
    if (!editing || editSaving || !editText.trim()) return;
    setEditSaving(true);
    try {
      const t = todayIsoDate();
      const effectiveDate = editDate < t ? t : editDate;
      const dateArg = effectiveDate === t ? "" : effectiveDate;
      await updateTask(editing.id, editText.trim(), dateArg, editRemind);
      setEditing(null);
      await refresh();
      const days = await listScheduledDays();
      setScheduledDays(days);
      setPlanCount(days.reduce((n, d) => n + d.tasks.length, 0));
      setMsg("已保存");
      setTimeout(() => setMsg(""), 3000);
    } catch (e) {
      showErr(e);
    } finally {
      setEditSaving(false);
    }
  };

  useEffect(() => {
    refresh();
    getAutostart().then(setAutostartOn);
    getAlwaysOnTop().then(setAlwaysOnTopOn);
    getDarkTheme().then((v) => {
      setDarkThemeOn(v);
      applyTheme(v);
    });
    getMacroAlarmEnabled().then(setMacroAlarmOn);
  }, [refresh]);

  useEffect(() => {
    let unlistenTasks: (() => void) | undefined;
    let unlistenReminder: (() => void) | undefined;
    let unlistenMacro: (() => void) | undefined;
    let unlistenMode: (() => void) | undefined;
    void listen("tasks-updated", refresh).then((fn) => {
      unlistenTasks = fn;
    });
    void listen<Task>("task-reminder", (e) => {
      setReminderBanner(e.payload);
      if (windowModeRef.current === "ball") {
        void expandMainWindow();
      }
    }).then((fn) => {
      unlistenReminder = fn;
    });
    void listen<{ name: string; eventAt: string }>("macro-alarm", (e) => {
      if (macroAlarmOn) playMacroAlarm(10_000);
      setMsg(`宏观提醒：${e.payload.name}（${e.payload.eventAt} 发布）`);
      setTimeout(() => setMsg(""), 8000);
    }).then((fn) => {
      unlistenMacro = fn;
    });
    void listen<string>("window-mode-changed", (e) => {
      const mode = e.payload === "ball" ? "ball" : "expanded";
      setWindowMode(mode);
      if (mode === "expanded") {
        pointerInside.current = true;
        if (collapseTimer.current) {
          clearTimeout(collapseTimer.current);
          collapseTimer.current = null;
        }
      }
    }).then((fn) => {
      unlistenMode = fn;
    });
    return () => {
      unlistenTasks?.();
      unlistenReminder?.();
      unlistenMacro?.();
      unlistenMode?.();
    };
  }, [refresh, macroAlarmOn]);

  const syncMacro = useCallback(async () => {
    const todayKey = todayIsoDate();
    const slots = buildTodayMacroAlertSlots().map((s) => ({
      id: s.id,
      name: s.name,
      alertAt: s.alertAt,
      eventAt: s.eventAt,
      fired: false,
    }));
    try {
      await syncMacroReminders(todayKey, slots);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    syncMacro();
    const t = setInterval(syncMacro, 60_000);
    return () => clearInterval(t);
  }, [syncMacro]);

  useEffect(() => {
    document.body.classList.toggle("ball-mode", windowMode === "ball");
    return () => document.body.classList.remove("ball-mode");
  }, [windowMode]);

  const cancelAutoCollapse = useCallback(() => {
    if (collapseTimer.current) {
      clearTimeout(collapseTimer.current);
      collapseTimer.current = null;
    }
  }, []);

  const scheduleAutoCollapse = useCallback(() => {
    if (shouldStayExpanded()) return;
    cancelAutoCollapse();
    collapseTimer.current = setTimeout(() => {
      collapseTimer.current = null;
      if (!shouldStayExpanded()) {
        void minimizeMainWindow();
      }
    }, 350);
  }, [shouldStayExpanded, cancelAutoCollapse]);

  useEffect(() => {
    if (windowMode !== "expanded") return;
    const onFocusIn = (e: FocusEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest("input, textarea, select, [contenteditable='true']")) {
        cancelAutoCollapse();
      }
    };
    const onFocusOut = () => {
      window.setTimeout(() => {
        if (!shouldStayExpanded()) scheduleAutoCollapse();
      }, 0);
    };
    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", onFocusOut);
    return () => {
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", onFocusOut);
    };
  }, [windowMode, cancelAutoCollapse, scheduleAutoCollapse, shouldStayExpanded]);

  useEffect(() => {
    if (windowMode !== "expanded") {
      cancelAutoCollapse();
      return;
    }
    return () => cancelAutoCollapse();
  }, [windowMode, cancelAutoCollapse]);

  const today = todayIsoDate();
  const isFutureDate = targetDate > today;
  const pending = tasks.filter((t) => !t.done);
  const done = tasks.filter((t) => t.done);

  const onReorder = useCallback(
    async (fromId: string, toId: string) => {
      if (fromId === toId) return;
      const ids = tasks.filter((t) => !t.done).map((t) => t.id);
      const fi = ids.indexOf(fromId);
      const ti = ids.indexOf(toId);
      if (fi < 0 || ti < 0) return;
      ids.splice(fi, 1);
      ids.splice(ti, 0, fromId);
      try {
        await reorderTasks(ids);
        await refresh();
      } catch (e) {
        showErr(e);
      }
    },
    [tasks, refresh]
  );

  useEffect(() => {
    if (!dragId) return;

    const findTarget = (x: number, y: number) => {
      const el = document.elementFromPoint(x, y);
      const row = el?.closest("[data-sortable-task-id]") as HTMLElement | null;
      return row?.dataset.sortableTaskId ?? null;
    };

    const onMove = (e: PointerEvent) => {
      setDragOverId(findTarget(e.clientX, e.clientY));
    };

    const finish = (e: PointerEvent) => {
      const toId = findTarget(e.clientX, e.clientY);
      if (toId && toId !== dragId) {
        void onReorder(dragId, toId);
      }
      setDragId(null);
      setDragOverId(null);
    };

    document.body.classList.add("task-dragging");
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", finish);
    window.addEventListener("pointercancel", finish);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setDragId(null);
        setDragOverId(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.classList.remove("task-dragging");
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", finish);
      window.removeEventListener("pointercancel", finish);
      window.removeEventListener("keydown", onKey);
    };
  }, [dragId, onReorder]);
  const total = tasks.length;
  const pct = total > 0 ? Math.round((done.length / total) * 100) : 0;

  const openEmailSettings = async () => {
    try {
      const s = await getEmailSettings();
      setEmailEnabled(s.enabled);
      setEmailFrom(s.from || "3521771097@qq.com");
      setEmailTo(s.to || s.from || "3521771097@qq.com");
      setEmailConfigured(s.configured);
      setAuthCode("");
      setShowEmail(true);
    } catch (e) {
      showErr(e);
    }
  };

  const saveEmailSettings = async () => {
    setEmailSaving(true);
    try {
      await setEmailSettings(
        emailEnabled,
        emailFrom,
        emailTo || emailFrom,
        authCode
      );
      setEmailConfigured(true);
      setAuthCode("");
      setMsg("邮件配置已保存");
      setTimeout(() => setMsg(""), 3000);
    } catch (e) {
      showErr(e);
    } finally {
      setEmailSaving(false);
    }
  };

  const onAdd = async () => {
    const t = text.trim();
    if (!t || adding) return;
    setAdding(true);
    try {
      const dateArg = targetDate === today ? "" : targetDate;
      await addTask(t, recurring && !isFutureDate, remindAt, dateArg);
      setText("");
      setRemindAt("");
      if (dateArg) {
        setMsg(`已添加到 ${formatScheduleDate(dateArg)}`);
        setTimeout(() => setMsg(""), 3000);
      }
      await refresh();
    } catch (e) {
      showErr(e);
    } finally {
      setAdding(false);
    }
  };

  if (windowMode === "ball") {
    return <BallDock pendingCount={pending.length} dark={darkTheme} />;
  }

  return (
    <div
      className={`app${darkTheme ? " dark" : ""}`}
      onPointerEnter={() => {
        pointerInside.current = true;
        cancelAutoCollapse();
      }}
      onPointerLeave={() => {
        pointerInside.current = false;
        scheduleAutoCollapse();
      }}
      onPointerDown={cancelAutoCollapse}
      onFocusCapture={cancelAutoCollapse}
    >
      {reminderBanner && (
        <div className="reminder-banner">
          <span>⏰ {reminderBanner.text}</span>
          <button
            type="button"
            onClick={async () => {
              await snoozeTask(reminderBanner.id, 10);
              setReminderBanner(null);
              await refresh();
            }}
          >
            10 分钟后
          </button>
          <button type="button" className="banner-close" onClick={() => setReminderBanner(null)}>
            ×
          </button>
        </div>
      )}
      <TitleBar alwaysOnTop={alwaysOnTop} onAlwaysOnTopChange={setAlwaysOnTopOn} />
      <header className="header" onMouseDown={onWindowDragMouseDown}>
        <div className="header-top">
          <h1>每日任务</h1>
          <span className="header-date">{formatTodayHeader()}</span>
        </div>
        <nav className="tabs" data-no-drag>
          <button
            type="button"
            className={tab === "tasks" ? "on" : ""}
            onClick={() => setTab("tasks")}
          >
            任务
            {pending.length > 0 && <em className="tab-badge">{pending.length}</em>}
          </button>
          <button
            type="button"
            className={tab === "calendar" ? "on" : ""}
            onClick={() => setTab("calendar")}
          >
            宏观日历
          </button>
        </nav>
      </header>

      <main className="app-main">
        {tab === "calendar" ? (
          <MacroCalendar onTasksChanged={refresh} />
        ) : (
          <div className="tasks-pane">
            {total > 0 && (
              <section className="stats-bar">
              <div className="stats-text">
                <strong>{done.length}</strong>
                <span>/ {total} 已完成</span>
              </div>
              <div className="progress-track">
                <div className="progress-fill" style={{ width: `${pct}%` }} />
              </div>
              <span className="stats-pct">{pct}%</span>
            </section>
          )}

          <section className="composer">
            <input
              className="task-input"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && onAdd()}
              placeholder={isFutureDate ? "输入计划要做的事…" : "输入今日要做的事…"}
            />
            <div className="row">
              <input
                type="date"
                className="date-input"
                value={targetDate}
                min={today}
                onChange={(e) => {
                  const v = e.target.value;
                  setTargetDate(v);
                  if (v > today) setRecurring(false);
                }}
                title="计划日期"
              />
              <input
                type="time"
                value={remindAt}
                onChange={(e) => setRemindAt(e.target.value)}
                title="提醒时间"
              />
            </div>
            <div className="row">
              <label className={`check-label${isFutureDate ? " disabled" : ""}`}>
                <input
                  type="checkbox"
                  checked={recurring}
                  disabled={isFutureDate}
                  onChange={(e) => setRecurring(e.target.checked)}
                />
                每天自动添加
              </label>
              <button type="button" className="primary" onClick={onAdd} disabled={adding}>
                {adding ? "添加中…" : isFutureDate ? "+ 计划任务" : "+ 添加任务"}
              </button>
            </div>
            {isFutureDate && (
              <p className="schedule-hint">将计划在 {formatScheduleDate(targetDate)} 显示，到当天自动进入今日待办</p>
            )}
            {msg && !msg.includes("备份") && (
              <p className={`msg ${msg.startsWith("已添加") ? "ok" : "err"}`}>{msg}</p>
            )}
          </section>

          <section className={`list${dragId ? " is-dragging" : ""}`}>
            <div className="list-head">
              <h2>今日待办</h2>
              <span className="list-count">{pending.length} 项</span>
            </div>

            {pending.map((t) => (
              <TaskItem
                key={t.id}
                task={t}
                sortable
                dragging={dragId === t.id}
                dragOver={dragOverId === t.id && dragOverId !== dragId}
                onGripDown={() => setDragId(t.id)}
                onToggle={() => toggleTask(t.id).then(refresh)}
                onEdit={() => openEdit(t)}
                onDelete={() => deleteTask(t.id).then(refresh)}
                onStopRecurring={
                  t.recurring_id ? () => stopRecurring(t.id).then(refresh) : undefined
                }
              />
            ))}
            {pending.length === 0 && (
              <div className="empty-card">
                <p>今天没有待办</p>
                <small>在上方输入框添加任务</small>
              </div>
            )}

            {done.length > 0 && (
              <>
                <div className="divider">
                  <span>已完成 · {done.length}</span>
                  <button type="button" onClick={() => clearCompleted().then(refresh)}>
                    清除
                  </button>
                </div>
                {done.map((t) => (
                  <TaskItem
                    key={t.id}
                    task={t}
                    done
                    onToggle={() => toggleTask(t.id).then(refresh)}
                    onEdit={() => openEdit(t)}
                    onDelete={() => deleteTask(t.id).then(refresh)}
                    onStopRecurring={
                      t.recurring_id ? () => stopRecurring(t.id).then(refresh) : undefined
                    }
                  />
                ))}
              </>
            )}
          </section>
          </div>
        )}
      </main>

      <footer className="footer footer-compact">
        <button
          type="button"
          className={`footer-plan${planCount > 0 ? " has-plan" : ""}`}
          onClick={openPlans}
        >
          我的计划
          {planCount > 0 && <em>{planCount}</em>}
        </button>
        <button type="button" className="footer-settings" onClick={() => setShowSettings(true)}>
          ⚙ 设置
        </button>
        <label className="footer-check footer-dark">
          <input
            type="checkbox"
            checked={darkTheme}
            onChange={async (e) => {
              const v = e.target.checked;
              try {
                await setDarkTheme(v);
                setDarkThemeOn(v);
                applyTheme(v);
              } catch (err) {
                showErr(err);
              }
            }}
          />
          夜色
        </label>
        {(msg === "备份完成" || msg === "无数据" || msg.startsWith("已导出") || msg.startsWith("宏观提醒")) && (
          <span className="msg">{msg}</span>
        )}
      </footer>

      {showSettings && (
        <div className="modal-bg" onClick={() => setShowSettings(false)}>
          <div className="modal settings-modal" onClick={(e) => e.stopPropagation()}>
            <h3>设置</h3>
            <section className="settings-section">
              <h4>窗口</h4>
              <label className="settings-row footer-check">
                <input
                  type="checkbox"
                  checked={autostart}
                  onChange={async (e) => {
                    const v = e.target.checked;
                    try {
                      await setAutostart(v);
                      setAutostartOn(v);
                    } catch (err) {
                      showErr(err);
                    }
                  }}
                />
                开机自启（后台运行）
              </label>
              <p className="modal-desc">
                关闭窗口会缩到托盘，提醒与宏观警报在后台继续运行；托盘右键「退出」才会完全停止。
              </p>
            </section>
            <section className="settings-section">
              <h4>提醒</h4>
              <label className="settings-row footer-check">
                <input
                  type="checkbox"
                  checked={macroAlarmOn}
                  onChange={async (e) => {
                    const v = e.target.checked;
                    try {
                      await setMacroAlarmEnabled(v);
                      setMacroAlarmOn(v);
                    } catch (err) {
                      showErr(err);
                    }
                  }}
                />
                宏观数据提前 5 分钟警报（10 秒）
              </label>
              <button type="button" className="settings-link" onClick={() => { setShowSettings(false); openEmailSettings(); }}>
                QQ 邮件提醒…
              </button>
            </section>
            <section className="settings-section">
              <h4>数据</h4>
              <button
                type="button"
                className="settings-link"
                onClick={async () => {
                  setWeekly(await getWeeklyStats());
                  setShowSettings(false);
                }}
              >
                每周回顾
              </button>
              <button
                type="button"
                className="settings-link"
                onClick={async () => {
                  try {
                    const p = await exportWeekCsv();
                    setMsg(`已导出：${p.split(/[/\\]/).pop()}`);
                    setTimeout(() => setMsg(""), 4000);
                  } catch (e) {
                    showErr(e);
                  }
                }}
              >
                导出本周 CSV
              </button>
              <button
                type="button"
                className="settings-link"
                onClick={async () => {
                  const p = await manualBackup();
                  setMsg(p ? "备份完成" : "无数据");
                  setTimeout(() => setMsg(""), 3000);
                }}
              >
                手动备份
              </button>
              <button
                type="button"
                className="settings-link"
                onClick={() => {
                  setShowSettings(false);
                  openRestore();
                }}
              >
                从备份恢复
              </button>
            </section>
            <button type="button" className="primary" onClick={() => setShowSettings(false)}>
              关闭
            </button>
          </div>
        </div>
      )}

      {showEmail && (
        <div className="modal-bg" onClick={() => setShowEmail(false)}>
          <div className="modal email-modal" onClick={(e) => e.stopPropagation()}>
            <h3>QQ 邮件提醒</h3>
            <p className="modal-desc">
              到期未完成的计划任务、到提醒时间的任务会发送邮件（需应用保持运行）。
            </p>
            <label className="email-field footer-check">
              <input
                type="checkbox"
                checked={emailEnabled}
                onChange={(e) => setEmailEnabled(e.target.checked)}
              />
              启用邮件提醒
            </label>
            <label className="email-field">
              <span>QQ 邮箱</span>
              <input
                type="email"
                value={emailFrom}
                onChange={(e) => setEmailFrom(e.target.value)}
                placeholder="3521771097@qq.com"
              />
            </label>
            <label className="email-field">
              <span>收件邮箱</span>
              <input
                type="email"
                value={emailTo}
                onChange={(e) => setEmailTo(e.target.value)}
                placeholder="默认同发件邮箱"
              />
            </label>
            <label className="email-field">
              <span>授权码</span>
              <input
                type="password"
                value={authCode}
                onChange={(e) => setAuthCode(e.target.value)}
                placeholder={emailConfigured ? "已配置，留空则不修改" : "QQ 邮箱 SMTP 授权码"}
              />
            </label>
            <div className="email-actions">
              <button
                type="button"
                className="primary"
                disabled={emailSaving}
                onClick={saveEmailSettings}
              >
                {emailSaving ? "保存中…" : "保存"}
              </button>
              <button
                type="button"
                disabled={!emailConfigured}
                onClick={async () => {
                  try {
                    await testEmailSettings();
                    setMsg("测试邮件已发送");
                    setTimeout(() => setMsg(""), 3000);
                  } catch (e) {
                    showErr(e);
                  }
                }}
              >
                发送测试
              </button>
              <button type="button" onClick={() => setShowEmail(false)}>
                关闭
              </button>
            </div>
          </div>
        </div>
      )}

      {showPlans && (
        <div className="modal-bg" onClick={() => setShowPlans(false)}>
          <div className="modal plans-modal" onClick={(e) => e.stopPropagation()}>
            <h3>我的计划</h3>
            <p className="modal-desc">未来日期的计划任务，到当天自动进入今日待办。</p>
            {scheduledDays.length === 0 ? (
              <p className="empty">暂无计划任务</p>
            ) : (
              <ul className="plan-list">
                {scheduledDays.map((day) => (
                  <li key={day.date}>
                    <h4>{formatScheduleDate(day.date)}</h4>
                    {day.tasks.map((t) => (
                      <div key={t.id} className="plan-item">
                        <span>{t.text}</span>
                        {t.remind_at && <small>⏰ {t.remind_at}</small>}
                        <button type="button" className="plan-edit" onClick={() => openEdit(t)}>
                          编辑
                        </button>
                        <button
                          type="button"
                          className="plan-cancel"
                          onClick={async () => {
                            await deleteTask(t.id);
                            const days = await listScheduledDays();
                            setScheduledDays(days);
                            setPlanCount(days.reduce((n, d) => n + d.tasks.length, 0));
                            await refresh();
                          }}
                        >
                          取消
                        </button>
                      </div>
                    ))}
                  </li>
                ))}
              </ul>
            )}
            <button type="button" className="primary" onClick={() => setShowPlans(false)}>
              关闭
            </button>
          </div>
        </div>
      )}

      {editing && (
        <div
          className="modal-bg"
          onClick={() => setEditing(null)}
          onKeyDown={(e) => e.key === "Escape" && setEditing(null)}
        >
          <div
            className="modal edit-modal"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.target as HTMLElement).tagName !== "BUTTON") {
                e.preventDefault();
                saveEdit();
              }
            }}
          >
            <h3>编辑任务</h3>
            <label className="email-field">
              <span>标题</span>
              <input
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                placeholder="任务内容"
                autoFocus
              />
            </label>
            <label className="email-field">
              <span>日期</span>
              <div className="date-field-row">
                <input
                  type="date"
                  value={editDate}
                  min={today}
                  disabled={!!editing.recurring_id}
                  onChange={(e) => setEditDate(e.target.value)}
                />
                <button
                  type="button"
                  className={`date-today-btn${editDate === today ? " on" : ""}`}
                  disabled={!!editing.recurring_id}
                  onClick={() => setEditDate(today)}
                >
                  今天
                </button>
              </div>
            </label>
            <label className="email-field">
              <span>提醒时间</span>
              <input
                type="time"
                value={editRemind}
                onChange={(e) => setEditRemind(e.target.value)}
              />
            </label>
            {editing.recurring_id && (
              <p className="modal-desc">常驻任务日期固定为今天</p>
            )}
            <div className="modal-footer">
              <button type="button" className="modal-btn" onClick={() => setEditing(null)}>
                取消
              </button>
              <button
                type="button"
                className="modal-btn primary"
                disabled={editSaving || !editText.trim()}
                onClick={saveEdit}
              >
                {editSaving ? "保存中…" : "确认"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showRestore && (
        <div className="modal-bg" onClick={() => setShowRestore(false)}>
          <div className="modal restore-modal" onClick={(e) => e.stopPropagation()}>
            <h3>从备份恢复</h3>
            <p className="modal-desc">恢复前会自动备份当前数据。</p>
            {backups.length === 0 ? (
              <p className="empty">暂无备份文件</p>
            ) : (
              <ul className="backup-list">
                {backups.map((b) => (
                  <li key={b.name}>
                    <div>
                      <strong>{b.name}</strong>
                      <small>{b.modified}</small>
                    </div>
                    <button
                      type="button"
                      disabled={restoring}
                      onClick={async () => {
                        if (!window.confirm(`确定从 ${b.name} 恢复？`)) return;
                        setRestoring(true);
                        try {
                          await restoreBackup(b.name);
                          setShowRestore(false);
                          await refresh();
                          setMsg("已恢复");
                          setTimeout(() => setMsg(""), 3000);
                        } catch (e) {
                          showErr(e);
                        } finally {
                          setRestoring(false);
                        }
                      }}
                    >
                      恢复
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <button type="button" className="primary" onClick={() => setShowRestore(false)}>
              关闭
            </button>
          </div>
        </div>
      )}

      {weekly && (
        <div className="modal-bg" onClick={() => setWeekly(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>
              {weekly.week_start} — {weekly.week_end}
            </h3>
            <p>
              共 {weekly.total} 项，完成 {weekly.done} 项（{weekly.rate}）
            </p>
            <button type="button" className="primary" onClick={() => setWeekly(null)}>
              关闭
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function TaskItem({
  task,
  done,
  sortable,
  dragging,
  dragOver,
  onGripDown,
  onToggle,
  onEdit,
  onDelete,
  onStopRecurring,
}: {
  task: Task;
  done?: boolean;
  sortable?: boolean;
  dragging?: boolean;
  dragOver?: boolean;
  onGripDown?: () => void;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onStopRecurring?: () => void;
}) {
  const created = formatTaskTime(task.created_at);
  const completed = formatTaskTime(task.completed_at);

  return (
    <div
      className={`task ${done ? "is-done" : ""}${dragging ? " dragging" : ""}${dragOver ? " drag-over" : ""}`}
      {...(sortable && !done ? { "data-sortable-task-id": task.id } : {})}
    >
      {sortable && !done && (
        <span
          className="drag-handle"
          title="按住拖动排序"
          onPointerDown={(e) => {
            if (e.button !== 0) return;
            e.preventDefault();
            e.stopPropagation();
            onGripDown?.();
          }}
        >
          ⋮⋮
        </span>
      )}
      <label className="task-check">
        <input type="checkbox" checked={task.done} onChange={onToggle} />
        <span className="check-ui" />
      </label>
      <div className="task-body">
        <div className="task-title-row">
          <span className="task-text">{task.text}</span>
        </div>
        <div className="task-meta">
          {task.recurring_id && <span className="meta-chip recurring">常驻</span>}
          {task.carried_from && (
            <span className="meta-chip carry">延自 {formatTaskTime(task.carried_from)}</span>
          )}
          {task.remind_at && !done && (
            <span className="meta-chip remind">⏰ {task.remind_at}</span>
          )}
        </div>
        <div className="task-times">
          <span className="time-created">创建 {created}</span>
          {done && completed && (
            <span className="time-done">完成 {completed}</span>
          )}
        </div>
      </div>
      {onStopRecurring && (
        <button
          type="button"
          className="stop-recurring"
          onClick={onStopRecurring}
          title="停止常驻（以后不再自动添加）"
        >
          停
        </button>
      )}
      <button type="button" className="edit-btn" onClick={onEdit} title="编辑">
        ✎
      </button>
      <button type="button" className="del" onClick={onDelete} title={onStopRecurring ? "仅删除今天（明天仍会出现）" : "删除"}>
        ×
      </button>
    </div>
  );
}
