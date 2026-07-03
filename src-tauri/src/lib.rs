mod autostart;
mod backup;
mod commands;
mod logger;
mod store;
mod time_util;

use std::sync::Mutex;

use store::TaskStore;
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager, RunEvent, WindowEvent,
};

pub struct AppState {
    pub store: Mutex<TaskStore>,
}

fn setup_tray(app: &tauri::AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let open_i = MenuItem::with_id(app, "open", "打开", true, None::<&str>)?;
    let quit_i = MenuItem::with_id(app, "quit", "退出", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&open_i, &quit_i])?;

    TrayIconBuilder::new()
        .menu(&menu)
        .tooltip("每日任务")
        .on_menu_event(|app, e| match e.id.as_ref() {
            "open" => commands::show_main(app),
            "quit" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, e| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = e
            {
                commands::show_main(tray.app_handle());
            }
        })
        .build(app)?;

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let store = TaskStore::new(TaskStore::default_path());

    tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_single_instance::init(|app, _, _| {
            commands::show_main(app);
        }))
        .manage(AppState {
            store: Mutex::new(store),
        })
        .invoke_handler(tauri::generate_handler![
            commands::list_tasks,
            commands::add_task,
            commands::toggle_task,
            commands::delete_task,
            commands::clear_completed,
            commands::get_weekly_stats,
            commands::manual_backup,
            commands::get_autostart,
            commands::set_autostart,
            commands::show_main_window,
        ])
        .setup(|app| {
            setup_tray(app.handle())?;
            commands::spawn_reminder_loop(app.handle().clone());
            if let Some(win) = app.get_webview_window("main") {
                let _ = win.show();
            }
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("启动失败")
        .run(|app, event| {
            if let RunEvent::WindowEvent {
                label,
                event: WindowEvent::CloseRequested { api, .. },
                ..
            } = event
            {
                if label == "main" {
                    api.prevent_close();
                    if let Some(w) = app.get_webview_window("main") {
                        let _ = w.hide();
                    }
                }
            }
        });
}
