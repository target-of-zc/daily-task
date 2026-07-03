import { useCallback, useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import {
  addTask,
  clearCompleted,
  deleteTask,
  listTasks,
  toggleTask,
} from "../api";
import type { Task } from "../types";
import { PRIORITIES, TAGS } from "../types";

export default function PanelWindow() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [text, setText] = useState("");
  const [recurring, setRecurring] = useState(false);
  const [tag, setTag] = useState<string>(TAGS[3]);
  const [priority, setPriority] = useState<string>(PRIORITIES[1]);
  const [remindAt, setRemindAt] = useState("");

  const refresh = useCallback(async () => {
    setTasks(await listTasks());
  }, []);

  useEffect(() => {
    refresh();
    const unlisten = listen("tasks-updated", () => refresh());
    return () => {
      unlisten.then((fn) => fn());
    };
  }, [refresh]);

  const onAdd = async () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    await addTask(trimmed, recurring, tag, priority, remindAt);
    setText("");
    setRemindAt("");
    refresh();
  };

  const pending = tasks.filter((t) => !t.done);
  const done = tasks.filter((t) => t.done);

  return (
    <div className="panel-root">
      <header className="panel-header">
        <h1>每日任务</h1>
        <p className="panel-date">{new Date().toLocaleDateString("zh-CN")}</p>
        <p className="panel-stats">
          待办 {pending.length} · 已完成 {done.length}
        </p>
      </header>

      <section className="panel-add">
        <input
          type="text"
          placeholder="添加新任务…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onAdd()}
        />
        <div className="panel-add-row">
          <select value={tag} onChange={(e) => setTag(e.target.value)}>
            {TAGS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <select value={priority} onChange={(e) => setPriority(e.target.value)}>
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          <input
            type="time"
            value={remindAt}
            onChange={(e) => setRemindAt(e.target.value)}
            title="提醒时间"
          />
        </div>
        <div className="panel-add-row">
          <label>
            <input
              type="checkbox"
              checked={recurring}
              onChange={(e) => setRecurring(e.target.checked)}
            />
            常驻（每天自动添加）
          </label>
          <button type="button" className="btn-primary" onClick={onAdd}>
            添加
          </button>
        </div>
      </section>

      <section className="panel-list">
        <h2>待办</h2>
        {pending.length === 0 ? (
          <p className="empty-hint">暂无待办，享受轻松一天吧</p>
        ) : (
          <ul>
            {pending.map((t) => (
              <TaskRow
                key={t.id}
                task={t}
                onToggle={async () => {
                  await toggleTask(t.id);
                  refresh();
                }}
                onDelete={async () => {
                  await deleteTask(t.id);
                  refresh();
                }}
              />
            ))}
          </ul>
        )}

        {done.length > 0 && (
          <>
            <div className="done-header">
              <h2>已完成</h2>
              <button type="button" className="btn-link" onClick={() => clearCompleted().then(refresh)}>
                清除已完成
              </button>
            </div>
            <ul className="done-list">
              {done.map((t) => (
                <TaskRow
                  key={t.id}
                  task={t}
                  onToggle={async () => {
                    await toggleTask(t.id);
                    refresh();
                  }}
                  onDelete={async () => {
                    await deleteTask(t.id);
                    refresh();
                  }}
                />
              ))}
            </ul>
          </>
        )}
      </section>
    </div>
  );
}

function TaskRow({
  task,
  onToggle,
  onDelete,
}: {
  task: Task;
  onToggle: () => void;
  onDelete: () => void;
}) {
  return (
    <li className={`task-row ${task.done ? "done" : ""}`}>
      <label>
        <input type="checkbox" checked={task.done} onChange={onToggle} />
        <span className={`prio-${task.priority}`}>{task.text}</span>
      </label>
      <div className="task-meta">
        {task.tag && <span className="tag">{task.tag}</span>}
        {task.carried_from && <span className="carried">顺延</span>}
        {task.recurring_id && <span className="recurring">常驻</span>}
        {task.remind_at && <span className="remind">⏰ {task.remind_at}</span>}
      </div>
      <button type="button" className="btn-delete" onClick={onDelete} title="删除">
        ×
      </button>
    </li>
  );
}
