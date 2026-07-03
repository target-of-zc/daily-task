mod store;

use std::sync::Mutex;
use std::time::Duration;

use store::{normalize_remind_time, Task, TaskStore};
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, LogicalPosition, Manager, State, WebviewUrl, WebviewWindowBuilder,
};

struct AppState {
    store: Mutex<TaskStore>,
}

#[tauri::command]
fn list_tasks(state: State<'_, AppState>) -> Result<Vec<Task>, String> {
    Ok(state.store.lock().map_err(|e| e.to_string())?.list_tasks())
}

#[tauri::command]
fn add_task(
    state: State<'_, AppState>,
    text: String,
    recurring: bool,
    tag: String,
    priority: String,
    remind_at: String,
) -> Result<Task, String> {
    let remind = normalize_remind_time(&remind_at).ok_or_else(|| "提醒时间格式无效".to_string())?;
    state
        .store
        .lock()
        .map_err(|e| e.to_string())?
        .add_task(text, recurring, tag, priority, remind.unwrap_or_default())
}

#[tauri::command]
fn toggle_task(state: State<'_, AppState>, id: String) -> Result<Task, String> {
    state
        .store
        .lock()
        .map_err(|e| e.to_string())?
        .toggle_task(&id)
}

#[tauri::command]
fn delete_task(state: State<'_, AppState>, id: String) -> Result<(), String> {
    state
        .store
        .lock()
        .map_err(|e| e.to_string())?
        .delete_task(&id)
}

#[tauri::command]
fn clear_completed(state: State<'_, AppState>) -> Result<(), String> {
    state
        .store
        .lock()
        .map_err(|e| e.to_string())?
        .clear_completed();
    Ok(())
}

#[tauri::command]
fn save_ball_pos(state: State<'_, AppState>, y: i32, side: String) -> Result<(), String> {
    state
        .store
        .lock()
        .map_err(|e| e.to_string())?
        .save_ball_pos(y, &side);
    Ok(())
}

#[tauri::command]
fn open_panel_cmd(app: AppHandle) -> Result<(), String> {
    open_panel(&app);
    Ok(())
}

#[tauri::command]
fn get_ball_pos(state: State<'_, AppState>) -> Result<(Option<i32>, String), String> {
    Ok(state.store.lock().map_err(|e| e.to_string())?.ball_pos())
}

pub fn open_panel(app: &AppHandle) {
    if let Some(w) = app.get_webview_window("panel") {
        let _ = w.show();
        let _ = w.set_focus();
        return;
    }
    let _ = WebviewWindowBuilder::new(app, "panel", WebviewUrl::App("index.html".into()))
        .title("每日任务")
        .inner_size(420.0, 560.0)
        .resizable(true)
        .decorations(true)
        .build();
}

fn position_ball_window(app: &AppHandle) {
    let Some(ball) = app.get_webview_window("ball") else {
        return;
    };
    let Ok(monitor) = ball.current_monitor() else {
        return;
    };
    let Some(monitor) = monitor else {
        return;
    };
    let size = monitor.size();
    let scale = monitor.scale_factor();
    let sw = size.width as f64 / scale;
    let sh = size.height as f64 / scale;
    const BALL_SIZE: f64 = 64.0;

    let state = app.state::<AppState>();
    let (saved_y, side) = state
        .store
        .lock()
        .map(|s| s.ball_pos())
        .unwrap_or((None, "right".into()));

    let y = saved_y
        .map(|y| y as f64)
        .unwrap_or((sh - BALL_SIZE) / 2.0)
        .clamp(0.0, (sh - BALL_SIZE).max(0.0));

    let x = if side == "left" {
        0.0
    } else {
        sw - BALL_SIZE
    };

    let _ = ball.set_position(LogicalPosition::new(x, y));
}

fn setup_tray(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let show = MenuItem::with_id(app, "show", "打开任务面板", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "退出", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&show, &quit])?;

    let _tray = TrayIconBuilder::new()
        .menu(&menu)
        .tooltip("每日任务")
        .on_menu_event(|app, event| match event.id.as_ref() {
            "show" => open_panel(app),
            "quit" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                open_panel(tray.app_handle());
            }
        })
        .build(app)?;

    Ok(())
}

fn spawn_reminder_loop(app: AppHandle) {
    tauri::async_runtime::spawn(async move {
        loop {
            tokio::time::sleep(Duration::from_secs(15)).await;
            let tasks: Vec<Task> = {
                let state = app.state::<AppState>();
                let Ok(mut store) = state.store.lock() else {
                    continue;
                };
                store.check_reminders()
            };
            for task in tasks {
                use tauri_plugin_notification::NotificationExt;
                let _ = app
                    .notification()
                    .builder()
                    .title("任务提醒")
                    .body(&task.text)
                    .show();
            }
            if !tasks.is_empty() {
                let _ = app.emit("tasks-updated", ());
            }
        }
    });
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let path = TaskStore::default_path();
    let store = TaskStore::new(path);

    tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            position_ball_window(app);
            if let Some(ball) = app.get_webview_window("ball") {
                let _ = ball.show();
                let _ = ball.set_focus();
            }
        }))
        .manage(AppState {
            store: Mutex::new(store),
        })
        .invoke_handler(tauri::generate_handler![
            list_tasks,
            add_task,
            toggle_task,
            delete_task,
            clear_completed,
            save_ball_pos,
            get_ball_pos,
            open_panel_cmd,
        ])
        .setup(|app| {
            setup_tray(app.handle())?;
            position_ball_window(app.handle());
            spawn_reminder_loop(app.handle().clone());
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
