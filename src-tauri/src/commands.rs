use std::time::Duration;

use tauri::{AppHandle, Emitter, Manager, State};

use crate::{
    autostart,
    backup::{self, BackupEntry},
    email,
    email_config::{self, EmailSettingsView},
    store::{normalize_remind_time, MacroReminderSlot, ScheduledDay, Task, WeeklyStats},
    window_layout,
    AppState,
};

fn send_task_emails(tasks: &[Task], is_reminder: bool) {
    let config = email_config::load();
    if !email_config::is_ready(&config) {
        return;
    }
    for task in tasks {
        let config = config.clone();
        let task = task.clone();
        std::thread::spawn(move || {
            let _ = if is_reminder {
                email::send_reminder_email(&config, &task)
            } else {
                email::send_due_plan_email(&config, &task)
            };
        });
    }
}

pub fn show_main(app: &AppHandle) {
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.show();
        let _ = w.unminimize();
        let _ = window_layout::dock_main_window(&w);
        let _ = w.set_focus();
        let _ = app.emit("window-mode-changed", "expanded");
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
pub fn hide_main_window(app: AppHandle) {
    hide_main(&app);
}

#[tauri::command(rename_all = "camelCase")]
pub fn minimize_main_window(app: AppHandle, state: State<'_, AppState>) -> Result<(), String> {
    let w = app
        .get_webview_window("main")
        .ok_or_else(|| "主窗口不存在".to_string())?;
    let (ball_y, side) = {
        let store = state.store.lock().map_err(|e| e.to_string())?;
        store.ball_pos()
    };
    let y = window_layout::dock_ball_window(&w, ball_y, &side, false)
        .map_err(|e| format!("收起悬浮条失败: {e}"))?;
    {
        let mut store = state.store.lock().map_err(|e| e.to_string())?;
        store.save_ball_pos(y, &side);
    }
    let _ = app.emit("window-mode-changed", "ball");
    Ok(())
}

#[tauri::command(rename_all = "camelCase")]
pub fn set_ball_peek(app: AppHandle, state: State<'_, AppState>, peek: bool) -> Result<(), String> {
    let w = app
        .get_webview_window("main")
        .ok_or_else(|| "主窗口不存在".to_string())?;
    let (ball_y, side) = {
        let store = state.store.lock().map_err(|e| e.to_string())?;
        store.ball_pos()
    };
    window_layout::dock_ball_window(&w, ball_y, &side, peek)
        .map_err(|e| format!("调整悬浮条失败: {e}"))?;
    Ok(())
}

#[tauri::command(rename_all = "camelCase")]
pub fn move_ball_by_delta(
    app: AppHandle,
    state: State<'_, AppState>,
    delta_y: i32,
) -> Result<(), String> {
    let w = app
        .get_webview_window("main")
        .ok_or_else(|| "主窗口不存在".to_string())?;
    let side = {
        let store = state.store.lock().map_err(|e| e.to_string())?;
        store.ball_pos().1
    };
    let current = window_layout::current_ball_y(&w).unwrap_or(0);
    let y = window_layout::dock_ball_window(&w, Some(current + delta_y), &side, true)
        .map_err(|e| format!("移动悬浮条失败: {e}"))?;
    {
        let mut store = state.store.lock().map_err(|e| e.to_string())?;
        store.save_ball_pos(y, &side);
    }
    Ok(())
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
    remind_at: String,
    target_date: String,
) -> Result<Task, String> {
    let remind = normalize_remind_time(&remind_at).ok_or_else(|| "提醒时间格式无效".to_string())?;
    let task = state
        .store
        .lock()
        .map_err(|e| e.to_string())?
        .add_task(text, recurring, remind, target_date)?;
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
pub fn stop_recurring(app: AppHandle, state: State<'_, AppState>, id: String) -> Result<(), String> {
    state
        .store
        .lock()
        .map_err(|e| e.to_string())?
        .stop_recurring(&id)?;
    let _ = app.emit("tasks-updated", ());
    Ok(())
}

#[tauri::command(rename_all = "camelCase")]
pub fn update_task(
    app: AppHandle,
    state: State<'_, AppState>,
    id: String,
    text: String,
    target_date: String,
    remind_at: String,
) -> Result<Task, String> {
    let task = state
        .store
        .lock()
        .map_err(|e| e.to_string())?
        .update_task(&id, text, target_date, remind_at)?;
    let _ = app.emit("tasks-updated", ());
    Ok(task)
}

#[tauri::command(rename_all = "camelCase")]
pub fn get_task_counts_by_date(
    state: State<'_, AppState>,
) -> Result<std::collections::HashMap<String, u32>, String> {
    Ok(state
        .store
        .lock()
        .map_err(|e| e.to_string())?
        .task_counts_by_date())
}

#[tauri::command(rename_all = "camelCase")]
pub fn get_dark_theme(state: State<'_, AppState>) -> Result<bool, String> {
    Ok(state
        .store
        .lock()
        .map_err(|e| e.to_string())?
        .dark_theme())
}

#[tauri::command(rename_all = "camelCase")]
pub fn set_dark_theme(state: State<'_, AppState>, enable: bool) -> Result<(), String> {
    state
        .store
        .lock()
        .map_err(|e| e.to_string())?
        .set_dark_theme(enable)
}

#[tauri::command(rename_all = "camelCase")]
pub fn export_week_csv(state: State<'_, AppState>) -> Result<String, String> {
    Ok(state
        .store
        .lock()
        .map_err(|e| e.to_string())?
        .export_week_csv()?
        .to_string_lossy()
        .into_owned())
}

#[tauri::command(rename_all = "camelCase")]
pub fn list_backups() -> Result<Vec<BackupEntry>, String> {
    Ok(backup::list_backups())
}

#[tauri::command(rename_all = "camelCase")]
pub fn restore_backup(
    app: AppHandle,
    state: State<'_, AppState>,
    filename: String,
) -> Result<(), String> {
    state
        .store
        .lock()
        .map_err(|e| e.to_string())?
        .restore_from_backup(&filename)?;
    let _ = app.emit("tasks-updated", ());
    Ok(())
}

#[tauri::command(rename_all = "camelCase")]
pub fn reorder_tasks(
    app: AppHandle,
    state: State<'_, AppState>,
    ordered_ids: Vec<String>,
) -> Result<(), String> {
    state
        .store
        .lock()
        .map_err(|e| e.to_string())?
        .reorder_tasks(ordered_ids)?;
    let _ = app.emit("tasks-updated", ());
    Ok(())
}

#[tauri::command(rename_all = "camelCase")]
pub fn snooze_task(
    app: AppHandle,
    state: State<'_, AppState>,
    id: String,
    minutes: u32,
) -> Result<Task, String> {
    let task = state
        .store
        .lock()
        .map_err(|e| e.to_string())?
        .snooze_task(&id, minutes)?;
    let _ = app.emit("tasks-updated", ());
    Ok(task)
}

#[tauri::command(rename_all = "camelCase")]
pub fn sync_macro_reminders(
    state: State<'_, AppState>,
    date: String,
    slots: Vec<MacroReminderSlot>,
) -> Result<(), String> {
    state
        .store
        .lock()
        .map_err(|e| e.to_string())?
        .sync_macro_reminders(date, slots)
}

#[tauri::command(rename_all = "camelCase")]
pub fn get_macro_alarm_enabled(state: State<'_, AppState>) -> Result<bool, String> {
    Ok(state
        .store
        .lock()
        .map_err(|e| e.to_string())?
        .macro_alarm_enabled())
}

#[tauri::command(rename_all = "camelCase")]
pub fn set_macro_alarm_enabled(
    state: State<'_, AppState>,
    enable: bool,
) -> Result<(), String> {
    state
        .store
        .lock()
        .map_err(|e| e.to_string())?
        .set_macro_alarm_enabled(enable)
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

#[tauri::command(rename_all = "camelCase")]
pub fn get_email_settings() -> Result<EmailSettingsView, String> {
    Ok(email_config::to_view(&email_config::load()))
}

#[tauri::command(rename_all = "camelCase")]
pub fn set_email_settings(
    enabled: bool,
    from: String,
    to: String,
    auth_code: String,
) -> Result<(), String> {
    let mut config = email_config::load();
    config.enabled = enabled;
    config.from = from.trim().to_string();
    config.to = to.trim().to_string();
    if !auth_code.trim().is_empty() {
        config.auth_code = auth_code.trim().to_string();
    }
    if config.from.is_empty() {
        return Err("请填写 QQ 邮箱".to_string());
    }
    if config.to.is_empty() {
        config.to = config.from.clone();
    }
    if config.auth_code.is_empty() {
        return Err("请填写 QQ 邮箱授权码".to_string());
    }
    email_config::save(&config)
}

#[tauri::command(rename_all = "camelCase")]
pub fn test_email_settings() -> Result<(), String> {
    let config = email_config::load();
    if !email_config::is_ready(&config) {
        return Err("请先保存邮件配置".to_string());
    }
    email::send_test_email(&config)
}

pub fn spawn_reminder_loop(app: AppHandle) {
    tauri::async_runtime::spawn(async move {
        loop {
            tokio::time::sleep(Duration::from_secs(15)).await;
            let (day_changed, reminders, due_plans, evening, macro_alerts): (
                bool,
                Vec<Task>,
                Vec<Task>,
                Option<Vec<Task>>,
                Vec<MacroReminderSlot>,
            ) = {
                let state = app.state::<AppState>();
                let Ok(mut s) = state.store.lock() else {
                    continue;
                };
                let day_changed = s.prepare_today();
                let due_plans = s.check_due_planned_emails();
                let reminders = s.check_reminders();
                let evening = s.check_evening_summary();
                let macro_alerts = s.check_macro_reminders();
                (day_changed, reminders, due_plans, evening, macro_alerts)
            };
            send_task_emails(&reminders, true);
            send_task_emails(&due_plans, false);
            if let Some(ref tasks) = evening {
                let config = email_config::load();
                if email_config::is_ready(&config) {
                    let tasks = tasks.clone();
                    std::thread::spawn(move || {
                        let _ = email::send_evening_summary_email(&config, &tasks);
                    });
                }
                use tauri_plugin_notification::NotificationExt;
                let body = if tasks.len() <= 3 {
                    tasks.iter().map(|t| t.text.as_str()).collect::<Vec<_>>().join("、")
                } else {
                    format!(
                        "{} 等 {} 项未完成",
                        tasks.first().map(|t| t.text.as_str()).unwrap_or(""),
                        tasks.len()
                    )
                };
                let _ = app
                    .notification()
                    .builder()
                    .title("今日任务未完成汇总")
                    .body(&body)
                    .show();
            }
            for t in &reminders {
                use tauri_plugin_notification::NotificationExt;
                let _ = app
                    .notification()
                    .builder()
                    .title("任务提醒")
                    .body(&t.text)
                    .show();
                let _ = app.emit("task-reminder", t.clone());
            }
            for slot in &macro_alerts {
                use tauri_plugin_notification::NotificationExt;
                let body = format!("{} · 5 分钟后发布（{} 东八区）", slot.name, slot.event_at);
                let _ = app
                    .notification()
                    .builder()
                    .title("宏观数据提醒")
                    .body(&body)
                    .show();
                let _ = app.emit("macro-alarm", slot.clone());
            }
            if day_changed
                || !reminders.is_empty()
                || !due_plans.is_empty()
                || evening.is_some()
                || !macro_alerts.is_empty()
            {
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
