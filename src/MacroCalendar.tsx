import { useCallback, useEffect, useMemo, useState } from "react";
import { addTask, getTaskCountsByDate } from "./api";
import {
  buildMonthGrid,
  CATEGORY_LABELS,
  formatEventTime,
  getEventsOnDate,
  getMacroEventsForMonth,
} from "./data/usMacroCalendar";
import { cstYmd, isCstToday, todayIsoDate } from "./utils/timezone";

const WEEK = ["日", "一", "二", "三", "四", "五", "六"];

function dateKey(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export default function MacroCalendar({
  onTasksChanged,
}: {
  onTasksChanged?: () => void;
}) {
  const cst = cstYmd();
  const [year, setYear] = useState(cst.year);
  const [month, setMonth] = useState(cst.month);
  const [day, setDay] = useState(cst.day);
  const [taskCounts, setTaskCounts] = useState<Record<string, number>>({});
  const [addingMacro, setAddingMacro] = useState(false);
  const [macroMsg, setMacroMsg] = useState("");

  const refreshCounts = useCallback(async () => {
    try {
      setTaskCounts(await getTaskCountsByDate());
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    refreshCounts();
  }, [refreshCounts, year, month]);

  const events = useMemo(() => getMacroEventsForMonth(year, month), [year, month]);
  const grid = useMemo(() => buildMonthGrid(year, month), [year, month]);
  const byDay = useMemo(() => {
    const m = new Map<number, typeof events>();
    for (const e of events) {
      const d = +e.beijingDate.split("-")[2];
      if (!m.has(d)) m.set(d, []);
      m.get(d)!.push(e);
    }
    return m;
  }, [events]);

  const selected = getEventsOnDate(year, month, day);
  const selectedKey = dateKey(year, month, day);
  const today = todayIsoDate();

  const shift = (d: number) => {
    let m = month + d;
    let y = year;
    if (m < 1) {
      m = 12;
      y--;
    } else if (m > 12) {
      m = 1;
      y++;
    }
    setYear(y);
    setMonth(m);
    setDay(1);
  };

  const goToday = () => {
    const t = cstYmd();
    setYear(t.year);
    setMonth(t.month);
    setDay(t.day);
  };

  const addMacroReminders = async () => {
    if (addingMacro || selected.length === 0) return;
    setAddingMacro(true);
    try {
      const dateArg = selectedKey === today ? "" : selectedKey;
      for (const e of selected) {
        await addTask(
          `${CATEGORY_LABELS[e.category]} · ${e.name}`,
          false,
          e.beijingTime,
          dateArg
        );
      }
      setMacroMsg(`已添加 ${selected.length} 条提醒任务`);
      setTimeout(() => setMacroMsg(""), 3000);
      await refreshCounts();
      onTasksChanged?.();
    } catch (e) {
      setMacroMsg(e instanceof Error ? e.message : String(e));
      setTimeout(() => setMacroMsg(""), 5000);
    } finally {
      setAddingMacro(false);
    }
  };

  return (
    <div className="cal">
      <div className="cal-bar">
        <button type="button" onClick={() => shift(-1)}>
          ◀
        </button>
        <strong>
          {year}年{month}月
        </strong>
        <button type="button" onClick={() => shift(1)}>
          ▶
        </button>
        <button type="button" className="cal-today" onClick={goToday}>
          今天
        </button>
      </div>
      <div className="cal-week">
        {WEEK.map((w) => (
          <span key={w}>{w}</span>
        ))}
      </div>
      <div className="cal-grid">
        {grid.map((d, i) => {
          if (d === null) {
            return <span key={`e${i}`} className="cal-cell empty" />;
          }
          const key = dateKey(year, month, d);
          const count = taskCounts[key] ?? 0;
          return (
            <button
              key={d}
              type="button"
              className={[
                "cal-cell",
                day === d ? "on" : "",
                byDay.has(d) ? "has-event" : "",
                count > 0 ? "has-tasks" : "",
                isCstToday(year, month, d) && byDay.has(d) ? "today-event" : "",
                isCstToday(year, month, d) ? "is-today" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              onClick={() => setDay(d)}
            >
              <span className="cal-day-num">{d}</span>
              {count > 0 ? (
                <span className="cal-task-count">{count}</span>
              ) : (
                <span
                  className={`cal-event-dot${byDay.has(d) ? " show" : ""}`}
                  aria-hidden
                />
              )}
            </button>
          );
        })}
      </div>
      <div className="cal-legend">
        {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
          <span key={k} className={`lg-${k}`}>
            {v}
          </span>
        ))}
        <span className="lg-today">今日有数据</span>
        <span className="lg-tasks">数字=当日任务</span>
      </div>
      <div className="cal-detail">
        <div className="cal-detail-head">
          <h4>
            {month}/{day} · {selected.length} 项（东八区）
            {taskCounts[selectedKey] ? ` · ${taskCounts[selectedKey]} 个任务` : ""}
          </h4>
          {selected.length > 0 && (
            <button
              type="button"
              className="cal-add-remind"
              disabled={addingMacro}
              onClick={addMacroReminders}
            >
              {addingMacro ? "添加中…" : "添加宏观提醒任务"}
            </button>
          )}
        </div>
        {macroMsg && <p className="cal-macro-msg">{macroMsg}</p>}
        {selected.length === 0 ? (
          <p className="empty">当日无宏观数据发布</p>
        ) : (
          <ul>
            {selected.map((e) => (
              <li key={e.id}>
                <span className={`lg-${e.category}`}>{CATEGORY_LABELS[e.category]}</span>
                <b>{e.name}</b>
                {e.refMonth && <span className="cal-ref">数据：{e.refMonth}</span>}
                <small>{formatEventTime(e)}</small>
                {e.note && <small className="cal-note">{e.note}</small>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
