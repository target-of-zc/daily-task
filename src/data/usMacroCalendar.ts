/** 宏观日历：ES 季末交割、非农、CPI、FOMC（按东八区日期展示） */

export type MacroCategory = "futures" | "employment" | "inflation" | "fed";

export interface MacroEvent {
  id: string;
  name: string;
  /** 美东发布日期 YYYY-MM-DD */
  date: string;
  /** 美东发布时间 HH:MM */
  timeEt: string;
  /** 东八区日历日期 YYYY-MM-DD */
  beijingDate: string;
  /** 东八区时间 HH:MM */
  beijingTime: string;
  category: MacroCategory;
  refMonth?: string;
  note?: string;
}

export const CATEGORY_LABELS: Record<MacroCategory, string> = {
  futures: "ES 交割",
  employment: "非农",
  inflation: "CPI",
  fed: "FOMC",
};

const CPI_DATES: Record<number, { date: string; ref: string }[]> = {
  2025: [
    { date: "2025-01-15", ref: "2024年12月" },
    { date: "2025-02-12", ref: "2025年1月" },
    { date: "2025-03-12", ref: "2025年2月" },
    { date: "2025-04-10", ref: "2025年3月" },
    { date: "2025-05-13", ref: "2025年4月" },
    { date: "2025-06-11", ref: "2025年5月" },
    { date: "2025-07-11", ref: "2025年6月" },
    { date: "2025-08-12", ref: "2025年7月" },
    { date: "2025-09-11", ref: "2025年8月" },
    { date: "2025-10-15", ref: "2025年9月" },
    { date: "2025-11-13", ref: "2025年10月" },
    { date: "2025-12-10", ref: "2025年11月" },
  ],
  2026: [
    { date: "2026-01-13", ref: "2025年12月" },
    { date: "2026-02-13", ref: "2026年1月" },
    { date: "2026-03-11", ref: "2026年2月" },
    { date: "2026-04-10", ref: "2026年3月" },
    { date: "2026-05-12", ref: "2026年4月" },
    { date: "2026-06-10", ref: "2026年5月" },
    { date: "2026-07-14", ref: "2026年6月" },
    { date: "2026-08-12", ref: "2026年7月" },
    { date: "2026-09-11", ref: "2026年8月" },
    { date: "2026-10-14", ref: "2026年9月" },
    { date: "2026-11-10", ref: "2026年10月" },
    { date: "2026-12-10", ref: "2026年11月" },
  ],
};

const FOMC_DECISIONS: Record<number, { date: string; note?: string }[]> = {
  2025: [
    { date: "2025-01-29" },
    { date: "2025-03-19", note: "含点阵图/经济预测" },
    { date: "2025-05-07" },
    { date: "2025-06-18", note: "含点阵图/经济预测" },
    { date: "2025-07-30" },
    { date: "2025-09-17", note: "含点阵图/经济预测" },
    { date: "2025-10-29" },
    { date: "2025-12-10", note: "含点阵图/经济预测" },
  ],
  2026: [
    { date: "2026-01-28" },
    { date: "2026-03-18", note: "含点阵图/经济预测" },
    { date: "2026-04-29" },
    { date: "2026-06-17", note: "含点阵图/经济预测" },
    { date: "2026-07-29" },
    { date: "2026-09-16", note: "含点阵图/经济预测" },
    { date: "2026-10-28" },
    { date: "2026-12-09", note: "含点阵图/经济预测" },
  ],
  2027: [{ date: "2027-01-27" }],
};

const QUARTER_MONTHS = [3, 6, 9, 12];

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function fmtDate(y: number, m: number, d: number) {
  return `${y}-${pad(m)}-${pad(d)}`;
}

/** 纯日历 weekday：0=周日 … 5=周五（与本地时区无关） */
function weekday(y: number, m: number, d: number): number {
  if (m < 3) {
    m += 12;
    y -= 1;
  }
  const k = y % 100;
  const j = Math.floor(y / 100);
  return (d + Math.floor((13 * (m + 1)) / 5) + k + Math.floor(k / 4) + Math.floor(j / 4) + 5 * j) % 7;
}

function nthWeekday(y: number, m: number, weekdayTarget: number, n: number): number {
  let count = 0;
  const daysInMonth = new Date(y, m, 0).getDate();
  for (let d = 1; d <= daysInMonth; d++) {
    if (weekday(y, m, d) === weekdayTarget) {
      count++;
      if (count === n) return d;
    }
  }
  return 1;
}

/** 美国东部是否夏令时（3 月第 2 个周日 – 11 月第 1 个周日） */
function isUsDst(dateStr: string): boolean {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dstStartDay = nthWeekday(y, 3, 0, 2);
  const dstEndDay = nthWeekday(y, 11, 0, 1);
  if (m < 3 || (m === 3 && d < dstStartDay)) return false;
  if (m > 11 || (m === 11 && d >= dstEndDay)) return false;
  return true;
}

/** 美东时间 → 东八区日期与时间（UTC 换算，避免本地时区干扰） */
export function etToBeijingParts(
  dateStr: string,
  timeEt: string
): { beijingDate: string; beijingTime: string } {
  const [y, mo, d] = dateStr.split("-").map(Number);
  const [h, min] = timeEt.split(":").map(Number);
  const etToUtcHours = isUsDst(dateStr) ? 4 : 5;
  const utcMs = Date.UTC(y, mo - 1, d, h + etToUtcHours, min);
  const bjMs = utcMs + 8 * 60 * 60 * 1000;
  const bj = new Date(bjMs);
  return {
    beijingDate: fmtDate(bj.getUTCFullYear(), bj.getUTCMonth() + 1, bj.getUTCDate()),
    beijingTime: `${pad(bj.getUTCHours())}:${pad(bj.getUTCMinutes())}`,
  };
}

/** @deprecated 保留兼容 */
export function etToBeijing(dateStr: string, timeEt: string): string {
  const { beijingTime } = etToBeijingParts(dateStr, timeEt);
  return beijingTime;
}

export function formatEventTime(ev: MacroEvent): string {
  const [, mo, d] = ev.beijingDate.split("-");
  return `东八区 ${Number(mo)}月${Number(d)}日 ${ev.beijingTime} · 美东 ${ev.date.slice(5).replace("-", "/")} ${ev.timeEt}`;
}

function withBeijing(partial: Omit<MacroEvent, "id" | "beijingDate" | "beijingTime"> & { id?: string }): MacroEvent {
  const { beijingDate, beijingTime } = etToBeijingParts(partial.date, partial.timeEt);
  return {
    id: partial.id ?? `${partial.date}-${partial.name}`,
    ...partial,
    beijingDate,
    beijingTime,
  };
}

/** 非农：每月第一个周五 08:30 ET；若遇 7/4 独立日则提前至周四 */
function nfpUsReleaseDay(year: number, month: number): number {
  const firstFriday = nthWeekday(year, month, 5, 1);
  if (month === 7 && firstFriday === 4) {
    return 3;
  }
  return firstFriday;
}

function prevMonthLabel(year: number, month: number): string {
  if (month === 1) return `${year - 1}年12月`;
  return `${year}年${month - 1}月`;
}

function addNfp(events: MacroEvent[], year: number, month: number) {
  const day = nfpUsReleaseDay(year, month);
  events.push(
    withBeijing({
      name: "非农就业 NFP",
      date: fmtDate(year, month, day),
      timeEt: "08:30",
      category: "employment",
      refMonth: prevMonthLabel(year, month),
      note: month === 7 && day === 3 && nthWeekday(year, 7, 5, 1) === 4 ? "独立日前提前发布" : "每月第一个周五",
    })
  );
}

function addEsExpiry(events: MacroEvent[], year: number, month: number) {
  if (!QUARTER_MONTHS.includes(month)) return;
  const labels: Record<number, string> = { 3: "H", 6: "M", 9: "U", 12: "Z" };
  const day = nthWeekday(year, month, 5, 3);
  events.push(
    withBeijing({
      name: `ES 季末交割 (${labels[month]} 合约)`,
      date: fmtDate(year, month, day),
      timeEt: "09:30",
      category: "futures",
      note: "E-mini 标普500 · 当季第三个周五 09:30 ET 到期",
    })
  );
}

function addCpi(events: MacroEvent[], year: number, month: number) {
  const list = CPI_DATES[year];
  if (!list) return;
  for (const c of list) {
    if (Number(c.date.split("-")[1]) !== month) continue;
    events.push(
      withBeijing({
        name: "CPI 消费者物价指数",
        date: c.date,
        timeEt: "08:30",
        category: "inflation",
        refMonth: c.ref,
      })
    );
  }
}

function addFomc(events: MacroEvent[], year: number, month: number) {
  const list = FOMC_DECISIONS[year];
  if (!list) return;
  for (const f of list) {
    if (Number(f.date.split("-")[1]) !== month) continue;
    events.push(
      withBeijing({
        name: "FOMC 利率决议",
        date: f.date,
        timeEt: "14:00",
        category: "fed",
        note: f.note,
      })
    );
  }
}

function generateRawEvents(year: number, month: number): MacroEvent[] {
  const events: MacroEvent[] = [];
  addNfp(events, year, month);
  addEsExpiry(events, year, month);
  addCpi(events, year, month);
  addFomc(events, year, month);
  return events;
}

function shiftMonth(year: number, month: number, delta: number) {
  let m = month + delta;
  let y = year;
  while (m < 1) {
    m += 12;
    y--;
  }
  while (m > 12) {
    m -= 12;
    y++;
  }
  return { year: y, month: m };
}

const cache = new Map<string, MacroEvent[]>();

/** 按东八区月份筛选事件（含跨月：如 FOMC 美东下午 → 东八区次日凌晨） */
export function getMacroEventsForMonth(year: number, month: number): MacroEvent[] {
  const key = `${year}-${month}`;
  if (cache.has(key)) return cache.get(key)!;

  const raw: MacroEvent[] = [];
  for (const delta of [-1, 0, 1]) {
    const { year: y, month: m } = shiftMonth(year, month, delta);
    raw.push(...generateRawEvents(y, m));
  }

  const events = raw
    .filter((e) => {
      const [by, bm] = e.beijingDate.split("-").map(Number);
      return by === year && bm === month;
    })
    .sort(
      (a, b) =>
        a.beijingDate.localeCompare(b.beijingDate) || a.beijingTime.localeCompare(b.beijingTime)
    );

  cache.set(key, events);
  return events;
}

/** 按东八区日期查询 */
export function getEventsOnDate(year: number, month: number, day: number): MacroEvent[] {
  const dateStr = fmtDate(year, month, day);
  return getMacroEventsForMonth(year, month).filter((e) => e.beijingDate === dateStr);
}

export function buildMonthGrid(year: number, month: number) {
  const first = new Date(year, month - 1, 1);
  const startPad = first.getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < startPad; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}
