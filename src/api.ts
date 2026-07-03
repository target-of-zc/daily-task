import { invoke } from "@tauri-apps/api/core";
import type { Task } from "./types";

export async function listTasks(): Promise<Task[]> {
  return invoke<Task[]>("list_tasks");
}

export async function addTask(
  text: string,
  recurring: boolean,
  tag: string,
  priority: string,
  remindAt: string
): Promise<Task> {
  return invoke<Task>("add_task", {
    text,
    recurring,
    tag,
    priority,
    remindAt,
  });
}

export async function toggleTask(id: string): Promise<Task> {
  return invoke<Task>("toggle_task", { id });
}

export async function deleteTask(id: string): Promise<void> {
  return invoke("delete_task", { id });
}

export async function clearCompleted(): Promise<void> {
  return invoke("clear_completed");
}

export async function saveBallPos(y: number, side: string): Promise<void> {
  return invoke("save_ball_pos", { y, side });
}

export async function getBallPos(): Promise<[number | null, string]> {
  return invoke<[number | null, string]>("get_ball_pos");
}

export async function openPanel(): Promise<void> {
  return invoke("open_panel_cmd");
}
