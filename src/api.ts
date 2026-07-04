import { invoke } from "@tauri-apps/api/core";
import type { Task, WeeklyStats, ScheduledDay } from "./types";

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
  tag: string,
  priority: string,
  remindAt: string,
  targetDate = ""
) => call<Task>("add_task", { text, recurring, tag, priority, remindAt, targetDate });
export const toggleTask = (id: string) => call<Task>("toggle_task", { id });
export const deleteTask = (id: string) => call("delete_task", { id });
export const clearCompleted = () => call("clear_completed");
export const getWeeklyStats = () => call<WeeklyStats>("get_weekly_stats");
export const manualBackup = () => call<string | null>("manual_backup");
export const getAutostart = () => call<boolean>("get_autostart");
export const setAutostart = (enable: boolean) => call("set_autostart", { enable });
export const getAlwaysOnTop = () => call<boolean>("get_always_on_top");
export const setAlwaysOnTop = (enable: boolean) =>
  call("set_always_on_top", { enable });
export const quitApp = () => call("quit_app");
