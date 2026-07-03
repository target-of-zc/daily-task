use std::time::Duration;

use tauri::{AppHandle, Emitter, Manager, State};

use crate::{
    autostart,
    store::{normalize_remind_time, Task, WeeklyStats},
    AppState,
};

pub fn show_main(app: &AppHandle) {
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.show();
        let _ = w.unminimize();
        let _ = w.set_focus();
    }
}

#[tauri::command(rename_all = "camelCase")]
pub fn show_main_window(app: AppHandle) {
    show_main(&app);
}

#[tauri::command(rename_all = "camelCase")]
pub fn list_tasks(state: State<'_, AppState>) -> Result<Vec<Task>, String> {
    Ok(state.store.lock().map_err(|e| e.to_string())?.list_tasks())
}

#[tauri::command(rename_all = "camelCase")]
pub fn add_task(
    app: AppHandle,
    state: State<'_, AppState>,
    text: String,
    recurring: bool,
    tag: String,
    priority: String,
    remind_at: String,
) -> Result<Task, String> {
    let remind = normalize_remind_time(&remind_at).ok_or_else(|| "提醒时间格式无效".to_string())?;
    let task = state
        .store
        .lock()
        .map_err(|e| e.to_string())?
        .add_task(text, recurring, tag, priority, remind)?;
    let _ = app.emit("tasks-updated", ());
    Ok(task)
}

#[tauri::command(rename_all = "camelCase")]
pub fn toggle_task(app: AppHandle, state: State<'_, AppState>, id: String) -> Result<Task, String> {
    let task = state
        .store
        .lock()
        .map_err(|e| e.to_string())?
        .toggle_task(&id)?;
    let _ = app.emit("tasks-updated", ());
    Ok(task)
}

#[tauri::command(rename_all = "camelCase")]
pub fn delete_task(app: AppHandle, state: State<'_, AppState>, id: String) -> Result<(), String> {
    state
        .store
        .lock()
        .map_err(|e| e.to_string())?
        .delete_task(&id)?;
    let _ = app.emit("tasks-updated", ());
    Ok(())
}

#[tauri::command(rename_all = "camelCase")]
pub fn clear_completed(app: AppHandle, state: State<'_, AppState>) -> Result<(), String> {
    state
        .store
        .lock()
        .map_err(|e| e.to_string())?
        .clear_completed();
    let _ = app.emit("tasks-updated", ());
    Ok(())
}

#[tauri::command(rename_all = "camelCase")]
pub fn get_weekly_stats(state: State<'_, AppState>) -> Result<WeeklyStats, String> {
    Ok(state.store.lock().map_err(|e| e.to_string())?.weekly_stats())
}

#[tauri::command(rename_all = "camelCase")]
pub fn manual_backup(state: State<'_, AppState>) -> Result<Option<String>, String> {
    Ok(state
        .store
        .lock()
        .map_err(|e| e.to_string())?
        .manual_backup()
        .map(|p| p.to_string_lossy().into_owned()))
}

#[tauri::command(rename_all = "camelCase")]
pub fn get_autostart() -> Result<bool, String> {
    Ok(autostart::is_autostart_enabled())
}

#[tauri::command(rename_all = "camelCase")]
pub fn set_autostart(enable: bool) -> Result<(), String> {
    autostart::set_autostart(enable)
}

pub fn spawn_reminder_loop(app: AppHandle) {
    tauri::async_runtime::spawn(async move {
        loop {
            tokio::time::sleep(Duration::from_secs(15)).await;
            let pending: Vec<Task> = {
                let state = app.state::<AppState>();
                let Ok(mut s) = state.store.lock() else {
                    continue;
                };
                s.check_reminders()
            };
            for t in &pending {
                use tauri_plugin_notification::NotificationExt;
                let _ = app
                    .notification()
                    .builder()
                    .title("任务提醒")
                    .body(&t.text)
                    .show();
            }
            if !pending.is_empty() {
                let _ = app.emit("tasks-updated", ());
            }
        }
    });
}
