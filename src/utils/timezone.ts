const TZ = "Asia/Shanghai";

export function cstYmd(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(date);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  return { year: get("year"), month: get("month"), day: get("day") };
}

export function isCstToday(year: number, month: number, day: number) {
  const t = cstYmd();
  return t.year === year && t.month === month && t.day === day;
}

export function formatCstNow() {
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date());
}

/** 将后端时间戳格式化为东八区可读文本 */
export function formatTaskTime(ts?: string | null): string {
  if (!ts) return "";
  const m = ts.match(/^(\d{4})-(\d{2})-(\d{2})(?: (\d{2}):(\d{2}))?/);
  if (!m) return ts;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const h = m[4];
  const min = m[5];
  const today = cstYmd();
  const isToday = y === today.year && mo === today.month && d === today.day;
  if (h && min) {
    return isToday ? `${h}:${min}` : `${mo}月${d}日 ${h}:${min}`;
  }
  return `${mo}月${d}日`;
}

export function formatTodayHeader() {
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: TZ,
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(new Date());
}

export function todayIsoDate() {
  const t = cstYmd();
  return `${t.year}-${String(t.month).padStart(2, "0")}-${String(t.day).padStart(2, "0")}`;
}

export function formatScheduleDate(iso: string) {
  const today = todayIsoDate();
  if (iso === today) return "今天";
  const [y, m, d] = iso.split("-").map(Number);
  const t = cstYmd();
  const tomorrow = new Date(Date.UTC(t.year, t.month - 1, t.day + 1));
  const tomIso = `${tomorrow.getUTCFullYear()}-${String(tomorrow.getUTCMonth() + 1).padStart(2, "0")}-${String(tomorrow.getUTCDate()).padStart(2, "0")}`;
  if (iso === tomIso) return "明天";
  const week = ["日", "一", "二", "三", "四", "五", "六"];
  const wd = week[new Date(y, m - 1, d).getDay()];
  return `${m}月${d}日 周${wd}`;
}
