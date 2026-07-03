import { useCallback, useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import {
  addTask,
  clearCompleted,
  deleteTask,
  getAutostart,
  getWeeklyStats,
  listTasks,
  manualBackup,
  setAutostart,
  toggleTask,
} from "./api";
import MacroCalendar from "./MacroCalendar";
import type { Task, WeeklyStats } from "./types";
import { PRIORITIES, TAGS } from "./types";

type Tab = "tasks" | "calendar";

export default function App() {
  const [tab, setTab] = useState<Tab>("tasks");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [text, setText] = useState("");
  const [recurring, setRecurring] = useState(false);
  const [tag, setTag] = useState(TAGS[3]);
  const [priority, setPriority] = useState(PRIORITIES[1]);
  const [remindAt, setRemindAt] = useState("");
  const [autostart, setAutostartOn] = useState(false);
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
    } catch (e) {
      showErr(e);
    }
  }, []);

  useEffect(() => {
    refresh();
    getAutostart().then(setAutostartOn);
    listen("tasks-updated", refresh).then((fn) => () => fn());
  }, [refresh]);

  const pending = tasks.filter((t) => !t.done);
  const done = tasks.filter((t) => t.done);

  const onAdd = async () => {
    const t = text.trim();
    if (!t || adding) return;
    setAdding(true);
    try {
      const created = await addTask(t, recurring, tag, priority, remindAt);
      setTasks((prev) => [...prev.filter((x) => x.id !== created.id), created]);
      setText("");
      setRemindAt("");
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
        <h1>每日任务</h1>
        <nav className="tabs">
          <button
            type="button"
            className={tab === "tasks" ? "on" : ""}
            onClick={() => setTab("tasks")}
          >
            任务
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
          <section className="composer">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && onAdd()}
              placeholder="新任务…"
            />
            <div className="row">
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
              />
            </div>
            <div className="row">
              <label>
                <input
                  type="checkbox"
                  checked={recurring}
                  onChange={(e) => setRecurring(e.target.checked)}
                />
                每天自动添加
              </label>
              <button type="button" className="primary" onClick={onAdd} disabled={adding}>
                {adding ? "添加中…" : "添加"}
              </button>
            </div>
            <p className="hint">
              待办 {pending.length} · 完成 {done.length}
            </p>
            {msg && <p className="msg err">{msg}</p>}
          </section>

          <section className="list">
            {pending.map((t) => (
              <TaskItem
                key={t.id}
                task={t}
                onToggle={() => toggleTask(t.id).then(refresh)}
                onDelete={() => deleteTask(t.id).then(refresh)}
              />
            ))}
            {pending.length === 0 && <p className="empty">今天没有待办</p>}
            {done.length > 0 && (
              <>
                <div className="divider">
                  <span>已完成</span>
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
                    onDelete={() => deleteTask(t.id).then(refresh)}
                  />
                ))}
              </>
            )}
          </section>
        </>
      )}

      <footer className="footer">
        <label>
          <input
            type="checkbox"
            checked={autostart}
            onChange={(e) =>
              setAutostart(e.target.checked).then(() => setAutostartOn(e.target.checked))
            }
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
        {msg && <span className="msg">{msg}</span>}
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
  onToggle,
  onDelete,
}: {
  task: Task;
  done?: boolean;
  onToggle: () => void;
  onDelete: () => void;
}) {
  return (
    <div className={`task ${done ? "is-done" : ""}`}>
      <label>
        <input type="checkbox" checked={task.done} onChange={onToggle} />
        <span>{task.text}</span>
      </label>
      <button type="button" className="del" onClick={onDelete}>
        ×
      </button>
    </div>
  );
}
