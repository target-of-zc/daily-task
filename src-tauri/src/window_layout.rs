use tauri::{PhysicalPosition, PhysicalSize, WebviewWindow};

/// 主窗口宽度（逻辑像素，与 tauri.conf.json 一致）
pub const MAIN_WINDOW_WIDTH: f64 = 400.0;

fn resolve_monitor(win: &WebviewWindow) -> tauri::Result<Option<tauri::Monitor>> {
    if let Ok(Some(m)) = win.current_monitor() {
        return Ok(Some(m));
    }
    win.primary_monitor()
}

/// 贴屏幕右侧，高度占满工作区（任务栏上方）
pub fn dock_main_window(win: &WebviewWindow) -> tauri::Result<()> {
    let Some(monitor) = resolve_monitor(win)? else {
        return Ok(());
    };

    let scale = monitor.scale_factor();
    let work = monitor.work_area();
    let width_phys = (MAIN_WINDOW_WIDTH * scale).round() as u32;
    let height_phys = work.size.height;
    let x = work.position.x + work.size.width as i32 - width_phys as i32;
    let y = work.position.y;

    win.set_size(PhysicalSize::new(width_phys, height_phys))?;
    win.set_position(PhysicalPosition::new(x, y))?;
    Ok(())
}
