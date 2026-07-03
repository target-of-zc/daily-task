/** 宏观日历：仅 ES 季末交割、非农、CPI、FOMC */

export type MacroCategory = "futures" | "employment" | "inflation" | "fed";

export interface MacroEvent {
  id: string;
  name: string;
  date: string;
  timeEt: string;
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

/** BLS 官方 CPI 发布日 */
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

/** 美联储 FOMC 利率决议公布日（会议次日 14:00 ET） */
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
  2027: [
    { date: "2027-01-27" },
  ],
};

const QUARTER_MONTHS = [3, 6, 9, 12];

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function fmtDate(y: number, m: number, d: number) {
  return `${y}-${pad(m)}-${pad(d)}`;
}

function nthWeekday(y: number, m: number, weekday: number, n: number): number {
  let count = 0;
  for (let d = 1; d <= 31; d++) {
    if (new Date(y, m - 1, d).getMonth() !== m - 1) break;
    if (new Date(y, m - 1, d).getDay() === weekday) {
      count++;
      if (count === n) return d;
    }
  }
  return 1;
}

function isUsDst(dateStr: string): boolean {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const dstStart = new Date(y, 2, nthWeekday(y, 3, 0, 2));
  const dstEnd = new Date(y, 10, nthWeekday(y, 11, 0, 1));
  return date >= dstStart && date < dstEnd;
}

export function etToBeijing(dateStr: string, timeEt: string): string {
  const [h, min] = timeEt.split(":").map(Number);
  const offset = isUsDst(dateStr) ? 12 : 13;
  let bh = h + offset;
  let dayNote = "";
  if (bh >= 24) {
    bh -= 24;
    dayNote = "次日";
  }
  return `${dayNote ? `${dayNote} ` : ""}${pad(bh)}:${pad(min)}`;
}

export function formatEventTime(ev: MacroEvent): string {
  const bj = etToBeijing(ev.date, ev.timeEt);
  return `东八区 ${bj}（美东 ${ev.timeEt}）`;
}

function ev(partial: Omit<MacroEvent, "id"> & { id?: string }): MacroEvent {
  return { id: partial.id ?? `${partial.date}-${partial.name}`, ...partial };
}

function addNfp(events: MacroEvent[], year: number, month: number) {
  const day = nthWeekday(year, month, 5, 1);
  events.push(
    ev({
      name: "非农就业 NFP",
      date: fmtDate(year, month, day),
      timeEt: "08:30",
      category: "employment",
      note: "每月第一个周五",
    })
  );
}

function addEsExpiry(events: MacroEvent[], year: number, month: number) {
  if (!QUARTER_MONTHS.includes(month)) return;
  const labels: Record<number, string> = { 3: "H", 6: "M", 9: "U", 12: "Z" };
  const day = nthWeekday(year, month, 5, 3);
  events.push(
    ev({
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
      ev({
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
      ev({
        name: "FOMC 利率决议",
        date: f.date,
        timeEt: "14:00",
        category: "fed",
        note: f.note,
      })
    );
  }
}

const cache = new Map<string, MacroEvent[]>();

export function getMacroEventsForMonth(year: number, month: number): MacroEvent[] {
  const key = `${year}-${month}`;
  if (cache.has(key)) return cache.get(key)!;

  const events: MacroEvent[] = [];
  addNfp(events, year, month);
  addEsExpiry(events, year, month);
  addCpi(events, year, month);
  addFomc(events, year, month);

  events.sort((a, b) => a.date.localeCompare(b.date) || a.timeEt.localeCompare(b.timeEt));
  cache.set(key, events);
  return events;
}

export function getEventsOnDate(year: number, month: number, day: number): MacroEvent[] {
  const dateStr = fmtDate(year, month, day);
  return getMacroEventsForMonth(year, month).filter((e) => e.date === dateStr);
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
