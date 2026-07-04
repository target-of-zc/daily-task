use std::time::Duration;

use tauri::{AppHandle, Emitter, Manager, State};

use crate::{
    autostart,
    store::{normalize_remind_time, ScheduledDay, Task, WeeklyStats},
    window_layout,
    AppState,
};

pub fn show_main(app: &AppHandle) {
    if let Some(w) = app.get_webview_window("main") {
        let _ = window_layout::dock_main_window(&w);
        let _ = w.show();
        let _ = w.unminimize();
        let _ = w.set_focus();
    }
}

pub fn hide_main(app: &AppHandle) {
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.hide();
    }
}

pub fn toggle_main(app: &AppHandle) {
    if let Some(w) = app.get_webview_window("main") {
        let visible = w.is_visible().unwrap_or(false);
        if visible {
            hide_main(app);
        } else {
            show_main(app);
        }
    }
}

fn apply_always_on_top(app: &AppHandle, enabled: bool) -> Result<(), String> {
    let w = app
        .get_webview_window("main")
        .ok_or_else(|| "主窗口不存在".to_string())?;
    w.set_always_on_top(enabled)
        .map_err(|e| format!("设置置顶失败: {e}"))
}

#[tauri::command(rename_all = "camelCase")]
pub fn show_main_window(app: AppHandle) {
    show_main(&app);
}

#[tauri::command(rename_all = "camelCase")]
pub fn list_tasks(state: State<'_, AppState>) -> Result<Vec<Task>, String> {
    let mut store = state.store.lock().map_err(|e| e.to_string())?;
    store.prepare_today();
    Ok(store.list_tasks())
}

#[tauri::command(rename_all = "camelCase")]
pub fn list_scheduled_days(state: State<'_, AppState>) -> Result<Vec<ScheduledDay>, String> {
    Ok(state
        .store
        .lock()
        .map_err(|e| e.to_string())?
        .list_scheduled_days())
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
    target_date: String,
) -> Result<Task, String> {
    let remind = normalize_remind_time(&remind_at).ok_or_else(|| "提醒时间格式无效".to_string())?;
    let task = state
        .store
        .lock()
        .map_err(|e| e.to_string())?
        .add_task(text, recurring, tag, priority, remind, target_date)?;
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

#[tauri::command(rename_all = "camelCase")]
pub fn quit_app(app: AppHandle) {
    app.exit(0);
}

#[tauri::command(rename_all = "camelCase")]
pub fn get_always_on_top(state: State<'_, AppState>) -> Result<bool, String> {
    Ok(state
        .store
        .lock()
        .map_err(|e| e.to_string())?
        .always_on_top())
}

#[tauri::command(rename_all = "camelCase")]
pub fn set_always_on_top(
    app: AppHandle,
    state: State<'_, AppState>,
    enable: bool,
) -> Result<(), String> {
    state
        .store
        .lock()
        .map_err(|e| e.to_string())?
        .set_always_on_top(enable)?;
    apply_always_on_top(&app, enable)
}

pub fn spawn_reminder_loop(app: AppHandle) {
    tauri::async_runtime::spawn(async move {
        loop {
            tokio::time::sleep(Duration::from_secs(15)).await;
            let (day_changed, pending): (bool, Vec<Task>) = {
                let state = app.state::<AppState>();
                let Ok(mut s) = state.store.lock() else {
                    continue;
                };
                let day_changed = s.prepare_today();
                (day_changed, s.check_reminders())
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
            if day_changed || !pending.is_empty() {
                let _ = app.emit("tasks-updated", ());
            }
        }
    });
}

pub fn spawn_day_rollover_loop(app: AppHandle) {
    tauri::async_runtime::spawn(async move {
        loop {
            let wait = crate::time_util::secs_until_next_cst_midnight();
            tokio::time::sleep(Duration::from_secs(wait)).await;
            let changed = {
                let state = app.state::<AppState>();
                let Ok(mut s) = state.store.lock() else {
                    continue;
                };
                s.prepare_today()
            };
            if changed {
                let _ = app.emit("tasks-updated", ());
            }
            tokio::time::sleep(Duration::from_secs(30)).await;
            let changed = {
                let state = app.state::<AppState>();
                let Ok(mut s) = state.store.lock() else {
                    continue;
                };
                s.prepare_today()
            };
            if changed {
                let _ = app.emit("tasks-updated", ());
            }
        }
    });
}
