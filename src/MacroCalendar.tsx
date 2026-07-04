import { useMemo, useState } from "react";
import {
  buildMonthGrid,
  CATEGORY_LABELS,
  formatEventTime,
  getEventsOnDate,
  getMacroEventsForMonth,
} from "./data/usMacroCalendar";
import { cstYmd, isCstToday } from "./utils/timezone";

const WEEK = ["日", "一", "二", "三", "四", "五", "六"];

export default function MacroCalendar() {
  const cst = cstYmd();
  const [year, setYear] = useState(cst.year);
  const [month, setMonth] = useState(cst.month);
  const [day, setDay] = useState(cst.day);

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
        {grid.map((d, i) =>
          d === null ? (
            <span key={`e${i}`} className="cal-cell empty" />
          ) : (
            <button
              key={d}
              type="button"
              className={[
                "cal-cell",
                day === d ? "on" : "",
                byDay.has(d) ? "has-event" : "",
                isCstToday(year, month, d) && byDay.has(d) ? "today-event" : "",
                isCstToday(year, month, d) ? "is-today" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              onClick={() => setDay(d)}
            >
              <span className="cal-day-num">{d}</span>
              <span
                className={`cal-event-dot${byDay.has(d) ? " show" : ""}`}
                aria-hidden
              />
            </button>
          )
        )}
      </div>
      <div className="cal-legend">
        {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
          <span key={k} className={`lg-${k}`}>
            {v}
          </span>
        ))}
        <span className="lg-today">今日有数据</span>
      </div>
      <div className="cal-detail">
        <h4>
          {month}/{day} · {selected.length} 项（东八区）
        </h4>
        {selected.length === 0 ? (
          <p className="empty">无 ES / 非农 / CPI / FOMC</p>
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
