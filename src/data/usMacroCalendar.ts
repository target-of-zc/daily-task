/** 宏观日历：ES 季末交割、非农、CPI、PCE、PPI、ISM 服务业、FOMC（按东八区日期展示） */

export type MacroCategory =
  | "futures"
  | "employment"
  | "inflation"
  | "pce"
  | "ppi"
  | "ism"
  | "fed";

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
  pce: "核心 PCE",
  ppi: "PPI",
  ism: "ISM 服务业",
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
    { date: "2025-10-24", ref: "2025年9月", note: "政府关门延期" },
    // 2025-10 CPI 因政府关门取消，不在日历展示
    { date: "2025-12-18", ref: "2025年11月", note: "政府关门延期" },
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

/** BEA 个人收支（含核心 PCE）；默认 8:30 ET，部分合并发布为 10:00 */
type ScheduledRelease = { date: string; ref: string; note?: string; timeEt?: string };

const PCE_DATES: Record<number, ScheduledRelease[]> = {
  2025: [
    { date: "2025-01-31", ref: "2024年12月" },
    { date: "2025-02-28", ref: "2025年1月" },
    { date: "2025-03-28", ref: "2025年2月" },
    { date: "2025-04-30", ref: "2025年3月" },
    { date: "2025-05-30", ref: "2025年4月" },
    { date: "2025-06-27", ref: "2025年5月" },
    { date: "2025-07-31", ref: "2025年6月" },
    { date: "2025-08-29", ref: "2025年7月" },
    { date: "2025-09-26", ref: "2025年8月" },
    // 2025-09~11 单独 PCE 因关门取消，10-11 月合并见 2026-01-22
  ],
  2026: [
    { date: "2026-01-22", ref: "2025年10-11月", note: "关门后合并补发", timeEt: "10:00" },
    { date: "2026-02-20", ref: "2025年12月" },
    { date: "2026-03-13", ref: "2026年1月" },
    { date: "2026-04-09", ref: "2026年2月" },
    { date: "2026-04-30", ref: "2026年3月" },
    { date: "2026-05-28", ref: "2026年4月" },
    { date: "2026-06-25", ref: "2026年5月" },
    { date: "2026-07-30", ref: "2026年6月" },
    { date: "2026-08-26", ref: "2026年7月" },
    { date: "2026-09-30", ref: "2026年8月" },
    { date: "2026-10-29", ref: "2026年9月" },
    { date: "2026-11-25", ref: "2026年10月" },
    { date: "2026-12-23", ref: "2026年11月" },
  ],
};

/** BLS 生产者物价指数 PPI，美东 8:30（常与 CPI 相邻） */
const PPI_DATES: Record<number, { date: string; ref: string }[]> = {
  2025: [
    { date: "2025-01-15", ref: "2024年12月" },
    { date: "2025-02-13", ref: "2025年1月" },
    { date: "2025-03-13", ref: "2025年2月" },
    { date: "2025-04-11", ref: "2025年3月" },
    { date: "2025-05-14", ref: "2025年4月" },
    { date: "2025-06-12", ref: "2025年5月" },
    { date: "2025-07-11", ref: "2025年6月" },
    { date: "2025-08-14", ref: "2025年7月" },
    { date: "2025-09-10", ref: "2025年8月" },
    { date: "2025-11-25", ref: "2025年9月", note: "政府关门延期" },
    // 2025-10 PPI 取消；11 月数据见 2026-01-14
  ],
  2026: [
    { date: "2026-01-14", ref: "2025年10-11月", note: "含取消的10月数据" },
    { date: "2026-01-30", ref: "2025年12月" },
    { date: "2026-02-27", ref: "2026年1月" },
    { date: "2026-03-18", ref: "2026年2月" },
    { date: "2026-04-14", ref: "2026年3月" },
    { date: "2026-05-13", ref: "2026年4月" },
    { date: "2026-06-11", ref: "2026年5月" },
    { date: "2026-07-15", ref: "2026年6月" },
    { date: "2026-08-13", ref: "2026年7月" },
    { date: "2026-09-10", ref: "2026年8月" },
    { date: "2026-10-15", ref: "2026年9月" },
    { date: "2026-11-13", ref: "2026年10月" },
    { date: "2026-12-15", ref: "2026年11月" },
  ],
};

/** 非农：政府关门等异常年份按 BLS 实际发布日 */
const NFP_DATES: Record<number, { date: string; ref: string; note?: string }[]> = {
  2025: [
    { date: "2025-01-10", ref: "2024年12月" },
    { date: "2025-02-07", ref: "2025年1月" },
    { date: "2025-03-07", ref: "2025年2月" },
    { date: "2025-04-04", ref: "2025年3月" },
    { date: "2025-05-02", ref: "2025年4月" },
    { date: "2025-06-06", ref: "2025年5月" },
    { date: "2025-07-03", ref: "2025年6月", note: "独立日前提前发布" },
    { date: "2025-08-01", ref: "2025年7月" },
    { date: "2025-11-20", ref: "2025年9月", note: "政府关门延期" },
    { date: "2025-12-16", ref: "2025年11月", note: "含10月合并/延期" },
  ],
  2026: [
    { date: "2026-01-09", ref: "2025年12月" },
    { date: "2026-02-11", ref: "2026年1月", note: "政府关门延期" },
    { date: "2026-03-06", ref: "2026年2月" },
    { date: "2026-04-03", ref: "2026年3月" },
    { date: "2026-05-01", ref: "2026年4月" },
    { date: "2026-06-05", ref: "2026年5月" },
    { date: "2026-07-03", ref: "2026年6月" },
    { date: "2026-08-07", ref: "2026年7月" },
    { date: "2026-09-04", ref: "2026年8月" },
    { date: "2026-10-02", ref: "2026年9月" },
    { date: "2026-11-06", ref: "2026年10月" },
    { date: "2026-12-04", ref: "2026年11月" },
  ],
};

/** ISM 服务业 PMI：1 月发第四次工作日，其余月份第三次工作日（含联邦假日） */
const ISM_DATES: Record<number, { date: string; ref: string }[]> = {
  2025: [
    { date: "2025-01-08", ref: "2024年12月" },
    { date: "2025-02-05", ref: "2025年1月" },
    { date: "2025-03-05", ref: "2025年2月" },
    { date: "2025-04-03", ref: "2025年3月" },
    { date: "2025-05-05", ref: "2025年4月" },
    { date: "2025-06-04", ref: "2025年5月" },
    { date: "2025-07-03", ref: "2025年6月" },
    { date: "2025-08-05", ref: "2025年7月" },
    { date: "2025-09-04", ref: "2025年8月" },
    { date: "2025-10-03", ref: "2025年9月" },
    { date: "2025-11-05", ref: "2025年10月" },
    { date: "2025-12-03", ref: "2025年11月" },
  ],
  2026: [
    { date: "2026-01-07", ref: "2025年12月" },
    { date: "2026-02-04", ref: "2026年1月" },
    { date: "2026-03-05", ref: "2026年2月" },
    { date: "2026-04-06", ref: "2026年3月" },
    { date: "2026-05-05", ref: "2026年4月" },
    { date: "2026-06-04", ref: "2026年5月" },
    { date: "2026-07-06", ref: "2026年6月" },
    { date: "2026-08-05", ref: "2026年7月" },
    { date: "2026-09-04", ref: "2026年8月" },
    { date: "2026-10-03", ref: "2026年9月" },
    { date: "2026-11-05", ref: "2026年10月" },
    { date: "2026-12-03", ref: "2026年11月" },
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
  2027: [
    { date: "2027-01-27" },
    { date: "2027-03-17", note: "含点阵图/经济预测" },
    { date: "2027-04-28" },
    { date: "2027-06-09", note: "含点阵图/经济预测" },
    { date: "2027-07-28" },
    { date: "2027-09-15", note: "含点阵图/经济预测" },
    { date: "2027-10-27" },
    { date: "2027-12-08", note: "含点阵图/经济预测" },
  ],
  2028: [
    { date: "2028-01-26" },
    { date: "2028-03-21", note: "含点阵图/经济预测" },
    { date: "2028-05-03" },
    { date: "2028-06-14", note: "含点阵图/经济预测" },
    { date: "2028-07-26" },
    { date: "2028-09-20", note: "含点阵图/经济预测" },
    { date: "2028-11-01" },
    { date: "2028-12-13", note: "含点阵图/经济预测" },
  ],
};

/** 无硬编码年份时按 BLS 惯例估算 CPI 发布日（约每月 10–13 日） */
function getCpiDatesForYear(year: number): { date: string; ref: string }[] {
  if (CPI_DATES[year]) return CPI_DATES[year];
  const days = [13, 12, 11, 10, 13, 12, 11, 13, 12, 11, 13, 12];
  return days.map((day, i) => {
    const month = i + 1;
    const ref =
      month === 1 ? `${year - 1}年12月` : `${year}年${month - 1}月`;
    return { date: fmtDate(year, month, day), ref };
  });
}

/** 无硬编码年份时：PCE 约在次月 26–28 日（工作日） */
function getPceDatesForYear(year: number): ScheduledRelease[] {
  if (PCE_DATES[year]) return PCE_DATES[year];
  return Array.from({ length: 12 }, (_, i) => {
    const releaseMonth = i + 1;
    const ref =
      releaseMonth === 1 ? `${year - 1}年12月` : `${year}年${releaseMonth - 1}月`;
    let day = 28;
    while (weekday(year, releaseMonth, day) === 0 || weekday(year, releaseMonth, day) === 6) {
      day--;
    }
    return { date: fmtDate(year, releaseMonth, day), ref };
  });
}

/** 无硬编码年份时：PPI 约为 CPI 公布前一个工作日 */
function getPpiDatesForYear(year: number): { date: string; ref: string }[] {
  if (PPI_DATES[year]) return PPI_DATES[year];
  return getCpiDatesForYear(year).map((c) => {
    const [y, m, d] = c.date.split("-").map(Number);
    let day = d - 1;
    let month = m;
    let yr = y;
    while (day < 1 || weekday(yr, month, day) === 0 || weekday(yr, month, day) === 6) {
      day--;
      if (day < 1) {
        month--;
        if (month < 1) {
          month = 12;
          yr--;
        }
        day = new Date(yr, month, 0).getDate();
      }
    }
    return { date: fmtDate(yr, month, day), ref: c.ref };
  });
}

/** 无硬编码年份时按美联储惯例估算 FOMC 决议日（每年 8 次） */
function getFomcDatesForYear(year: number): { date: string; note?: string }[] {
  if (FOMC_DECISIONS[year]) return FOMC_DECISIONS[year];
  const tpl: { m: number; d: number; note?: string }[] = [
    { m: 1, d: 28 },
    { m: 3, d: 18, note: "含点阵图/经济预测（预估）" },
    { m: 5, d: 6 },
    { m: 6, d: 17, note: "含点阵图/经济预测（预估）" },
    { m: 7, d: 29 },
    { m: 9, d: 16, note: "含点阵图/经济预测（预估）" },
    { m: 11, d: 5 },
    { m: 12, d: 16, note: "含点阵图/经济预测（预估）" },
  ];
  return tpl.map((t) => ({
    date: fmtDate(year, t.m, t.d),
    note: t.note ? `${t.note}` : undefined,
  }));
}

const QUARTER_MONTHS = [3, 6, 9, 12];

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function fmtDate(y: number, m: number, d: number) {
  return `${y}-${pad(m)}-${pad(d)}`;
}

/** 纯日历 weekday：0=周日 … 6=周六（与 JS Date.getDay() 一致） */
function weekday(y: number, m: number, d: number): number {
  if (m < 3) {
    m += 12;
    y -= 1;
  }
  const k = y % 100;
  const j = Math.floor(y / 100);
  return (d + Math.floor((13 * (m + 1)) / 5) + k + Math.floor(k / 4) + Math.floor(j / 4) + 5 * j + 6) % 7;
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

function lastWeekday(y: number, m: number, weekdayTarget: number): number {
  const daysInMonth = new Date(y, m, 0).getDate();
  for (let d = daysInMonth; d >= 1; d--) {
    if (weekday(y, m, d) === weekdayTarget) return d;
  }
  return daysInMonth;
}

/** 美国联邦假日（含周末顺延），用于 ISM 等工作日推算 */
function isUsFederalHoliday(y: number, m: number, d: number): boolean {
  const key = fmtDate(y, m, d);
  const observeFixed = (month: number, day: number) => {
    const w = weekday(y, month, day);
    if (w === 6) return fmtDate(y, month, day - 1);
    if (w === 0) return fmtDate(y, month, day + 1);
    return fmtDate(y, month, day);
  };
  const holidays = new Set<string>([
    observeFixed(1, 1),
    fmtDate(y, 1, nthWeekday(y, 1, 1, 3)),
    fmtDate(y, 2, nthWeekday(y, 2, 1, 3)),
    fmtDate(y, 5, lastWeekday(y, 5, 1)),
    observeFixed(6, 19),
    observeFixed(7, 4),
    fmtDate(y, 9, nthWeekday(y, 9, 1, 1)),
    fmtDate(y, 10, nthWeekday(y, 10, 1, 2)),
    observeFixed(11, 11),
    fmtDate(y, 11, nthWeekday(y, 11, 4, 4)),
    observeFixed(12, 25),
  ]);
  return holidays.has(key);
}

/** 每月第 n 个工作日（周一至周五，排除美国联邦假日） */
function nthBusinessDay(y: number, m: number, n: number): number {
  let count = 0;
  const daysInMonth = new Date(y, m, 0).getDate();
  for (let d = 1; d <= daysInMonth; d++) {
    const w = weekday(y, m, d);
    if (w === 0 || w === 6 || isUsFederalHoliday(y, m, d)) continue;
    count++;
    if (count === n) return d;
  }
  return 1;
}

function ismServicesReleaseDay(y: number, m: number): number {
  const n = m === 1 ? 4 : 3;
  return nthBusinessDay(y, m, n);
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

/** 非农：每月第一个周五 08:30 ET；7/4 当周提前至周四；首个周五为联邦假日则顺延至次周五 */
function nfpUsReleaseDay(year: number, month: number): number {
  let day = nthWeekday(year, month, 5, 1);
  if (month === 7 && day === 4) {
    return 3;
  }
  if (isUsFederalHoliday(year, month, day)) {
    day = nthWeekday(year, month, 5, 2);
  }
  return day;
}

function getNfpDatesForYear(year: number): { date: string; ref: string; note?: string }[] {
  if (NFP_DATES[year]) return NFP_DATES[year];
  return Array.from({ length: 12 }, (_, i) => {
    const month = i + 1;
    const day = nfpUsReleaseDay(year, month);
    return {
      date: fmtDate(year, month, day),
      ref: prevMonthLabel(year, month),
      note:
        month === 7 && day === 3 && nthWeekday(year, 7, 5, 1) === 4
          ? "独立日前提前发布"
          : "每月第一个周五",
    };
  });
}

function getIsmDatesForYear(year: number): { date: string; ref: string }[] {
  if (ISM_DATES[year]) return ISM_DATES[year];
  return Array.from({ length: 12 }, (_, i) => {
    const month = i + 1;
    return {
      date: fmtDate(year, month, ismServicesReleaseDay(year, month)),
      ref: prevMonthLabel(year, month),
    };
  });
}

function prevMonthLabel(year: number, month: number): string {
  if (month === 1) return `${year - 1}年12月`;
  return `${year}年${month - 1}月`;
}

function addNfp(events: MacroEvent[], year: number, month: number) {
  const list = getNfpDatesForYear(year);
  for (const n of list) {
    if (Number(n.date.split("-")[1]) !== month) continue;
    const isEstimated = !NFP_DATES[year];
    events.push(
      withBeijing({
        name: "非农就业 NFP",
        date: n.date,
        timeEt: "08:30",
        category: "employment",
        refMonth: n.ref,
        note: n.note ?? (isEstimated ? "每月第一个周五" : undefined),
      })
    );
  }
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
  const list = getCpiDatesForYear(year);
  for (const c of list) {
    if (Number(c.date.split("-")[1]) !== month) continue;
    const isEstimated = !CPI_DATES[year];
    events.push(
      withBeijing({
        name: "CPI 消费者物价指数",
        date: c.date,
        timeEt: "08:30",
        category: "inflation",
        refMonth: c.ref,
        note: isEstimated ? "日期为惯例估算，以 BLS 公布为准" : undefined,
      })
    );
  }
}

function addFomc(events: MacroEvent[], year: number, month: number) {
  const list = getFomcDatesForYear(year);
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

function addPce(events: MacroEvent[], year: number, month: number) {
  const list = getPceDatesForYear(year);
  for (const p of list) {
    if (Number(p.date.split("-")[1]) !== month) continue;
    const isEstimated = !PCE_DATES[year];
    events.push(
      withBeijing({
        name: "核心 PCE 物价指数",
        date: p.date,
        timeEt: p.timeEt ?? "08:30",
        category: "pce",
        refMonth: p.ref,
        note: isEstimated ? "日期为惯例估算，以 BEA 公布为准" : p.note,
      })
    );
  }
}

function addPpi(events: MacroEvent[], year: number, month: number) {
  const list = getPpiDatesForYear(year);
  for (const p of list) {
    if (Number(p.date.split("-")[1]) !== month) continue;
    const isEstimated = !PPI_DATES[year];
    events.push(
      withBeijing({
        name: "PPI 生产者物价指数",
        date: p.date,
        timeEt: "08:30",
        category: "ppi",
        refMonth: p.ref,
        note: isEstimated ? "日期为惯例估算，以 BLS 公布为准" : undefined,
      })
    );
  }
}

function addIsmServices(events: MacroEvent[], year: number, month: number) {
  const list = getIsmDatesForYear(year);
  for (const s of list) {
    if (Number(s.date.split("-")[1]) !== month) continue;
    const isEstimated = !ISM_DATES[year];
    events.push(
      withBeijing({
        name: "ISM 服务业 PMI",
        date: s.date,
        timeEt: "10:00",
        category: "ism",
        refMonth: s.ref,
        note: isEstimated
          ? "每月第 3 个工作日 10:00 ET（1 月为第 4 个；遇假日以 ISM 为准）"
          : undefined,
      })
    );
  }
}

function generateRawEvents(year: number, month: number): MacroEvent[] {
  const events: MacroEvent[] = [];
  addNfp(events, year, month);
  addEsExpiry(events, year, month);
  addCpi(events, year, month);
  addPce(events, year, month);
  addPpi(events, year, month);
  addIsmServices(events, year, month);
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
  const startPad = weekday(year, month, 1);
  const daysInMonth = new Date(year, month, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < startPad; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}
