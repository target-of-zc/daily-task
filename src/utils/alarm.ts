/** 宏观提醒警报：双音交替，持续约 10 秒 */

let alarmTimer: ReturnType<typeof setInterval> | null = null;
let alarmStopTimer: ReturnType<typeof setTimeout> | null = null;

function beep(ctx: AudioContext, freq: number, start: number, dur: number) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "square";
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(0.35, start + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(start);
  osc.stop(start + dur);
}

export function playMacroAlarm(durationMs = 10_000) {
  stopMacroAlarm();
  const ctx = new AudioContext();
  let t = ctx.currentTime;
  const interval = 0.45;
  const end = t + durationMs / 1000;
  while (t < end) {
    beep(ctx, 880, t, 0.18);
    beep(ctx, 660, t + 0.22, 0.18);
    t += interval;
  }
  alarmStopTimer = setTimeout(() => {
    void ctx.close();
    alarmStopTimer = null;
  }, durationMs + 200);
}

export function stopMacroAlarm() {
  if (alarmTimer) {
    clearInterval(alarmTimer);
    alarmTimer = null;
  }
  if (alarmStopTimer) {
    clearTimeout(alarmStopTimer);
    alarmStopTimer = null;
  }
}
