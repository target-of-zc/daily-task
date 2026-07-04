import { useCallback, useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import {
  addTask,
  clearCompleted,
  deleteTask,
  getAlwaysOnTop,
  getAutostart,
  getWeeklyStats,
  listScheduledDays,
  listTasks,
  manualBackup,
  setAlwaysOnTop,
  setAutostart,
  toggleTask,
} from "./api";
import MacroCalendar from "./MacroCalendar";
import type { ScheduledDay, Task, WeeklyStats } from "./types";
import { PRIORITIES, TAGS } from "./types";
import { formatScheduleDate, formatTaskTime, formatTodayHeader, todayIsoDate } from "./utils/timezone";

type Tab = "tasks" | "calendar";

const PRIORITY_CLASS: Record<string, string> = {
  高: "pri-high",
  中: "pri-mid",
  低: "pri-low",
};

export default function App() {
  const [tab, setTab] = useState<Tab>("tasks");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [text, setText] = useState("");
  const [recurring, setRecurring] = useState(false);
  const [tag, setTag] = useState(TAGS[3]);
  const [priority, setPriority] = useState(PRIORITIES[1]);
  const [remindAt, setRemindAt] = useState("");
  const [targetDate, setTargetDate] = useState(todayIsoDate());
  const [scheduled, setScheduled] = useState<ScheduledDay[]>([]);
  const [autostart, setAutostartOn] = useState(false);
  const [alwaysOnTop, setAlwaysOnTopOn] = useState(false);
  const [weekly, setWeekly] = useState<WeeklyStats | null>(null);
  const [msg, setMsg] = useState("");
  const [adding, setAdding] = useState(false);

  const showErr = (e: unknown) => {
    setMsg(e instanceof Error ? e.message : String(e));
    setTimeout(() => setMsg(""), 5000);
  };

  const refresh = useCallback(async () => {
    try {
      setTasks(await listTasks());
      setScheduled(await listScheduledDays());
    } catch (e) {
      showErr(e);
    }
  }, []);

  useEffect(() => {
    refresh();
    getAutostart().then(setAutostartOn);
    getAlwaysOnTop().then(setAlwaysOnTopOn);
    listen("tasks-updated", refresh).then((fn) => () => fn());
  }, [refresh]);

  const today = todayIsoDate();
  const isFutureDate = targetDate > today;
  const displayTasks = isFutureDate
    ? scheduled.find((d) => d.date === targetDate)?.tasks ?? []
    : tasks;
  const pending = displayTasks.filter((t) => !t.done);
  const done = displayTasks.filter((t) => t.done);
  const total = displayTasks.length;
  const pct = total > 0 ? Math.round((done.length / total) * 100) : 0;
  const todayPending = tasks.filter((t) => !t.done).length;

  const onAdd = async () => {
    const t = text.trim();
    if (!t || adding) return;
    setAdding(true);
    try {
      const dateArg = targetDate === today ? "" : targetDate;
      await addTask(t, recurring && !isFutureDate, tag, priority, remindAt, dateArg);
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

  return (
    <div className="app">
      <header className="header">
        <div className="header-top">
          <h1>
            每日任务
            {alwaysOnTop && <span className="pin-badge">置顶</span>}
          </h1>
          <span className="header-date">{formatTodayHeader()}</span>
        </div>
        <nav className="tabs">
          <button
            type="button"
            className={tab === "tasks" ? "on" : ""}
            onClick={() => setTab("tasks")}
          >
            任务
            {todayPending > 0 && <em className="tab-badge">{todayPending}</em>}
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

      {tab === "calendar" ? (
        <MacroCalendar />
      ) : (
        <>
          {total > 0 && !isFutureDate && (
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
              <select value={tag} onChange={(e) => setTag(e.target.value)}>
                {TAGS.map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
              <select value={priority} onChange={(e) => setPriority(e.target.value)}>
                {PRIORITIES.map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
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
              <p className="schedule-hint">查看 {formatScheduleDate(targetDate)} 的计划，到当天自动进入今日待办</p>
            )}
            {msg && !msg.includes("备份") && (
              <p className={`msg ${msg.startsWith("已添加") ? "ok" : "err"}`}>{msg}</p>
            )}
          </section>

          <section className="list">
            <div className="list-head">
              <h2>{isFutureDate ? `${formatScheduleDate(targetDate)} 计划` : "今日待办"}</h2>
              <span className="list-count">{pending.length} 项</span>
            </div>

            {pending.map((t) => (
              <TaskItem
                key={t.id}
                task={t}
                planned={isFutureDate}
                onToggle={() => toggleTask(t.id).then(refresh)}
                onDelete={() => deleteTask(t.id).then(refresh)}
              />
            ))}
            {pending.length === 0 && (
              <div className="empty-card">
                <p>{isFutureDate ? "该日暂无计划" : "今天没有待办"}</p>
                <small>{isFutureDate ? "在上方添加该日的计划任务" : "在上方输入框添加任务"}</small>
              </div>
            )}

            {done.length > 0 && (
              <>
                <div className="divider">
                  <span>已完成 · {done.length}</span>
                  {!isFutureDate && (
                    <button type="button" onClick={() => clearCompleted().then(refresh)}>
                      清除
                    </button>
                  )}
                </div>
                {done.map((t) => (
                  <TaskItem
                    key={t.id}
                    task={t}
                    done
                    planned={isFutureDate}
                    onToggle={() => toggleTask(t.id).then(refresh)}
                    onDelete={() => deleteTask(t.id).then(refresh)}
                  />
                ))}
              </>
            )}
          </section>
        </>
      )}

      <footer className="footer">
        <label className="footer-check">
          <input
            type="checkbox"
            checked={alwaysOnTop}
            onChange={async (e) => {
              const v = e.target.checked;
              try {
                await setAlwaysOnTop(v);
                setAlwaysOnTopOn(v);
              } catch (err) {
                showErr(err);
              }
            }}
          />
          窗口置顶
        </label>
        <label className="footer-check">
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
          开机自启
        </label>
        <button
          type="button"
          onClick={async () => {
            setWeekly(await getWeeklyStats());
          }}
        >
          每周回顾
        </button>
        <button
          type="button"
          onClick={async () => {
            const p = await manualBackup();
            setMsg(p ? "备份完成" : "无数据");
            setTimeout(() => setMsg(""), 3000);
          }}
        >
          备份
        </button>
        {(msg === "备份完成" || msg === "无数据") && (
          <span className="msg">{msg}</span>
        )}
      </footer>

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
  planned,
  onToggle,
  onDelete,
}: {
  task: Task;
  done?: boolean;
  planned?: boolean;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const priClass = PRIORITY_CLASS[task.priority] ?? "pri-mid";
  const created = formatTaskTime(task.created_at);
  const completed = formatTaskTime(task.completed_at);

  return (
    <div className={`task ${done ? "is-done" : ""} ${priClass}`}>
      <label className="task-check">
        <input type="checkbox" checked={task.done} onChange={onToggle} />
        <span className="check-ui" />
      </label>
      <div className="task-body">
        <div className="task-title-row">
          <span className="task-text">{task.text}</span>
          <span className={`pri-badge ${priClass}`}>{task.priority}</span>
        </div>
        <div className="task-meta">
          <span className="tag-chip">{task.tag}</span>
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
      <button
        type="button"
        className={planned ? "del cancel-plan-btn" : "del"}
        onClick={onDelete}
        title={planned ? "取消计划" : "删除"}
      >
        {planned ? "取消" : "×"}
      </button>
    </div>
  );
}
