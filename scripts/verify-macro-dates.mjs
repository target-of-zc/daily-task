/**
 * 宏观日历深度校验：直接复现源码算法，避免「自写一套」导致漏检
 * 运行: node scripts/verify-macro-dates.mjs
 */
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(__dirname, "../src/data/usMacroCalendar.ts"), "utf8");

function extractTable(varName) {
  const re = new RegExp(`const ${varName}[\\s\\S]*?=\\s*\\{([\\s\\S]*?)\\};`, "m");
  const m = src.match(re);
  if (!m) return {};
  const out = {};
  const yearRe = /(\d{4}):\s*\[([\s\S]*?)\]/g;
  let ym;
  while ((ym = yearRe.exec(m[1])) !== null) {
    const year = +ym[1];
    const dates = [...ym[2].matchAll(/date:\s*"(\d{4}-\d{2}-\d{2})"/g)].map((x) => x[1]);
    out[year] = dates;
  }
  return out;
}

// === 与 usMacroCalendar.ts 一致的纯函数 ===
function pad(n) {
  return String(n).padStart(2, "0");
}
function fmtDate(y, m, d) {
  return `${y}-${pad(m)}-${pad(d)}`;
}
function weekday(y, m, d) {
  if (m < 3) {
    m += 12;
    y -= 1;
  }
  const k = y % 100;
  const j = Math.floor(y / 100);
  return (d + Math.floor((13 * (m + 1)) / 5) + k + Math.floor(k / 4) + Math.floor(j / 4) + 5 * j + 6) % 7;
}
function nthWeekday(y, m, weekdayTarget, n) {
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
function isUsDst(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dstStartDay = nthWeekday(y, 3, 0, 2);
  const dstEndDay = nthWeekday(y, 11, 0, 1);
  if (m < 3 || (m === 3 && d < dstStartDay)) return false;
  if (m > 11 || (m === 11 && d >= dstEndDay)) return false;
  return true;
}
function etToBeijing(dateStr, timeEt) {
  const [y, mo, d] = dateStr.split("-").map(Number);
  const [h, min] = timeEt.split(":").map(Number);
  const etToUtc = isUsDst(dateStr) ? 4 : 5;
  const utcMs = Date.UTC(y, mo - 1, d, h + etToUtc, min);
  const bj = new Date(utcMs + 8 * 3600_000);
  return `${bj.getUTCFullYear()}-${pad(bj.getUTCMonth() + 1)}-${pad(bj.getUTCDate())} ${pad(bj.getUTCHours())}:${pad(bj.getUTCMinutes())}`;
}
function buildMonthGrid(year, month) {
  const startPad = weekday(year, month, 1);
  const daysInMonth = new Date(year, month, 0).getDate();
  const cells = [];
  for (let i = 0; i < startPad; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  return { startPad, firstDay: cells[startPad] };
}

const OFFICIAL = {
  CPI_2026: [
    "2026-01-13", "2026-02-13", "2026-03-11", "2026-04-10", "2026-05-12", "2026-06-10",
    "2026-07-14", "2026-08-12", "2026-09-11", "2026-10-14", "2026-11-10", "2026-12-10",
  ],
  PPI_2026: [
    "2026-01-14", "2026-01-30", "2026-02-27", "2026-03-18", "2026-04-14", "2026-05-13",
    "2026-06-11", "2026-07-15", "2026-08-13", "2026-09-10", "2026-10-15", "2026-11-13", "2026-12-15",
  ],
  PCE_2026: [
    "2026-01-22", "2026-02-20", "2026-03-13", "2026-04-09", "2026-04-30", "2026-05-28",
    "2026-06-25", "2026-07-30", "2026-08-26", "2026-09-30", "2026-10-29", "2026-11-25", "2026-12-23",
  ],
  FOMC_2026: [
    "2026-01-28", "2026-03-18", "2026-04-29", "2026-06-17", "2026-07-29",
    "2026-09-16", "2026-10-28", "2026-12-09",
  ],
  FOMC_2027: [
    "2027-01-27", "2027-03-17", "2027-04-28", "2027-06-09", "2027-07-28",
    "2027-09-15", "2027-10-27", "2027-12-08",
  ],
  ISM_2026: [
    "2026-01-07", "2026-02-04", "2026-03-05", "2026-04-06", "2026-05-05", "2026-06-04",
    "2026-07-06", "2026-08-05", "2026-09-04", "2026-10-03", "2026-11-05", "2026-12-03",
  ],
  CPI_2025_SEP: "2025-10-24",
  NFP_2026_JUL: "2026-07-03",
  ES_2026_Q3: "2026-09-18",
};

const cpi = extractTable("CPI_DATES");
const ppi = extractTable("PPI_DATES");
const pce = extractTable("PCE_DATES");
const fomc = extractTable("FOMC_DECISIONS");
const ism = extractTable("ISM_DATES");
const nfp = extractTable("NFP_DATES");

function diff(label, ours, official) {
  const missing = official.filter((d) => !ours.includes(d));
  const extra = ours.filter((d) => !official.includes(d));
  if (missing.length || extra.length) {
    console.log(`\n❌ ${label}`);
    if (missing.length) console.log("  缺少:", missing.join(", "));
    if (extra.length) console.log("  多余/错误:", extra.join(", "));
    return false;
  }
  console.log(`✅ ${label}`);
  return true;
}

let ok = true;
console.log("=== 硬编码 vs 官方 ===");
ok &= diff("CPI 2026", cpi[2026] ?? [], OFFICIAL.CPI_2026);
ok &= diff("PPI 2026", ppi[2026] ?? [], OFFICIAL.PPI_2026);
ok &= diff("PCE 2026", pce[2026] ?? [], OFFICIAL.PCE_2026);
ok &= diff("FOMC 2026", fomc[2026] ?? [], OFFICIAL.FOMC_2026);
ok &= diff("FOMC 2027", fomc[2027] ?? [], OFFICIAL.FOMC_2027);
ok &= diff("ISM 2026", ism[2026] ?? [], OFFICIAL.ISM_2026);

ok &= (cpi[2025] ?? []).includes(OFFICIAL.CPI_2025_SEP);
console.log(ok ? "✅ CPI 2025-09 → 2025-10-24" : "❌ CPI 2025-09 日期错误");

ok &= (nfp[2026] ?? []).includes(OFFICIAL.NFP_2026_JUL);
console.log(ok ? "✅ NFP 2026-07 → 2026-07-03" : "❌ NFP 2026-07 日期错误");

const esDay = nthWeekday(2026, 9, 5, 3);
ok &= esDay === 18;
console.log(esDay === 18 ? "✅ ES 2026-Q3 第三个周五 = 9/18" : `❌ ES 2026-Q3 错误: ${esDay}`);

console.log("\n=== weekday / 网格 ===");
let wdOk = true;
for (const s of ["2025-01-01", "2026-01-01", "2026-03-21", "2026-11-01"]) {
  const [y, m, d] = s.split("-").map(Number);
  const js = new Date(y, m - 1, d).getDay();
  const got = weekday(y, m, d);
  const pass = got === js;
  wdOk &&= pass;
  console.log(`${pass ? "✅" : "❌"} weekday ${s}: ${got} (期望 ${js})`);
}
const grid = buildMonthGrid(2026, 7);
const jul1Wd = new Date(2026, 6, 1).getDay();
wdOk &&= grid.startPad === jul1Wd && grid.firstDay === 1;
console.log(
  grid.startPad === jul1Wd
    ? "✅ 2026-07 月网格首日列对齐"
    : `❌ 2026-07 网格错位 startPad=${grid.startPad} 期望=${jul1Wd}`
);
ok &= wdOk;

console.log("\n=== 时区转换（含 DST）===");
const tzCases = [
  ["2026-03-11", "08:30", "2026-03-11 20:30"],
  ["2026-01-13", "08:30", "2026-01-13 21:30"],
  ["2026-06-17", "14:00", "2026-06-18 02:00"],
  ["2026-01-28", "14:00", "2026-01-29 03:00"],
  ["2026-11-05", "10:00", "2026-11-05 23:00"],
];
for (const [date, time, expected] of tzCases) {
  const got = etToBeijing(date, time);
  const pass = got === expected;
  ok &&= pass;
  console.log(`${pass ? "✅" : "❌"} ${date} ${time} ET → ${got} (期望 ${expected})`);
}

process.exit(ok ? 0 : 1);
