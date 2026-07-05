import { invoke } from "@tauri-apps/api/core";
import type { Task, WeeklyStats, ScheduledDay, EmailSettings, BackupEntry } from "./types";

const errMsg = (e: unknown) => {
  if (e instanceof Error) return e.message;
  if (typeof e === "string") return e;
  return JSON.stringify(e);
};

async function call<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  try {
    return await invoke<T>(cmd, args);
  } catch (e) {
    throw new Error(errMsg(e));
  }
}

export const listTasks = () => call<Task[]>("list_tasks");
export const listScheduledDays = () => call<ScheduledDay[]>("list_scheduled_days");
export const addTask = (
  text: string,
  recurring: boolean,
  remindAt: string,
  targetDate = ""
) => call<Task>("add_task", { text, recurring, remindAt, targetDate });
export const toggleTask = (id: string) => call<Task>("toggle_task", { id });
export const deleteTask = (id: string) => call("delete_task", { id });
export const stopRecurring = (id: string) => call("stop_recurring", { id });
export const updateTask = (
  id: string,
  text: string,
  targetDate: string,
  remindAt: string
) => call<Task>("update_task", { id, text, targetDate, remindAt });
export const getTaskCountsByDate = () =>
  call<Record<string, number>>("get_task_counts_by_date");
export const getDarkTheme = () => call<boolean>("get_dark_theme");
export const setDarkTheme = (enable: boolean) => call("set_dark_theme", { enable });
export const exportWeekCsv = () => call<string>("export_week_csv");
export const listBackups = () => call<BackupEntry[]>("list_backups");
export const restoreBackup = (filename: string) => call("restore_backup", { filename });
export const clearCompleted = () => call("clear_completed");
export const getWeeklyStats = () => call<WeeklyStats>("get_weekly_stats");
export const manualBackup = () => call<string | null>("manual_backup");
export const getAutostart = () => call<boolean>("get_autostart");
export const setAutostart = (enable: boolean) => call("set_autostart", { enable });
export const getAlwaysOnTop = () => call<boolean>("get_always_on_top");
export const setAlwaysOnTop = (enable: boolean) =>
  call("set_always_on_top", { enable });
export const hideMainWindow = () => call("hide_main_window");
export const expandMainWindow = () => call("show_main_window");
export const minimizeMainWindow = () => call("minimize_main_window");
export const setBallPeek = (peek: boolean) => call("set_ball_peek", { peek });
export const moveBallByDelta = (deltaY: number) => call("move_ball_by_delta", { deltaY });
export const quitApp = () => call("quit_app");
export const getEmailSettings = () => call<EmailSettings>("get_email_settings");
export const setEmailSettings = (
  enabled: boolean,
  from: string,
  to: string,
  authCode: string
) => call("set_email_settings", { enabled, from, to, authCode });
export const testEmailSettings = () => call("test_email_settings");
export const reorderTasks = (orderedIds: string[]) =>
  call("reorder_tasks", { orderedIds });
export const snoozeTask = (id: string, minutes = 10) =>
  call<Task>("snooze_task", { id, minutes });
export const syncMacroReminders = (
  date: string,
  slots: { id: string; name: string; alertAt: string; eventAt: string; fired?: boolean }[]
) => call("sync_macro_reminders", { date, slots });
export const getMacroAlarmEnabled = () => call<boolean>("get_macro_alarm_enabled");
export const setMacroAlarmEnabled = (enable: boolean) =>
  call("set_macro_alarm_enabled", { enable });
