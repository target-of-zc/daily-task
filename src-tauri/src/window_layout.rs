use tauri::{window::Color, PhysicalPosition, PhysicalSize, WebviewWindow};

/// 主窗口宽度（逻辑像素，与 tauri.conf.json 一致）
pub const MAIN_WINDOW_WIDTH: f64 = 400.0;

/// 悬浮条尺寸（逻辑像素）
pub const BALL_LOGICAL_SIZE: f64 = 56.0;
/// 贴边时露出宽度（逻辑像素）
pub const BALL_DOCK_VISIBLE: f64 = 18.0;

fn set_window_transparent(win: &WebviewWindow, transparent: bool) {
    let color = if transparent {
        Some(Color(0, 0, 0, 0))
    } else {
        Some(Color(238, 241, 248, 255))
    };
    let _ = win.set_background_color(color);
}
fn resolve_monitor(win: &WebviewWindow) -> tauri::Result<Option<tauri::Monitor>> {
    if let Ok(Some(m)) = win.current_monitor() {
        return Ok(Some(m));
    }
    win.primary_monitor()
}

fn ball_size_phys(scale: f64) -> u32 {
    (BALL_LOGICAL_SIZE * scale).round().max(32.0) as u32
}

fn visible_width_phys(scale: f64, peek: bool) -> u32 {
    if peek {
        ball_size_phys(scale)
    } else {
        (BALL_DOCK_VISIBLE * scale).round().max(10.0) as u32
    }
}

fn default_ball_y(work_y: i32, work_h: u32, ball_h: u32) -> i32 {
    work_y + (work_h.saturating_sub(ball_h) / 2) as i32
}

fn clamp_ball_y(y: i32, work_y: i32, work_h: u32, ball_h: u32) -> i32 {
    let min_y = work_y;
    let max_y = work_y + work_h.saturating_sub(ball_h) as i32;
    y.clamp(min_y, max_y)
}

/// 贴屏幕右侧，高度占满工作区（任务栏上方，预留底边距）
pub fn dock_main_window(win: &WebviewWindow) -> tauri::Result<()> {
    let Some(monitor) = resolve_monitor(win)? else {
        return Ok(());
    };

    let scale = monitor.scale_factor();
    let work = monitor.work_area();
    let width_phys = (MAIN_WINDOW_WIDTH * scale).round() as u32;
    let bottom_gap = (10.0 * scale).round() as u32;
    let max_outer_h = work.size.height.saturating_sub(bottom_gap);
    let x = work.position.x + work.size.width as i32 - width_phys as i32;
    let y = work.position.y;

    win.set_resizable(true)?;
    win.set_size(PhysicalSize::new(width_phys, max_outer_h))?;
    win.set_position(PhysicalPosition::new(x, y))?;

    if win.is_decorated().unwrap_or(true) {
        if let (Ok(outer), Ok(inner)) = (win.outer_size(), win.inner_size()) {
            let frame_h = outer.height.saturating_sub(inner.height);
            if frame_h > 0 && outer.height > max_outer_h {
                let client_h = max_outer_h.saturating_sub(frame_h);
                if client_h > 0 {
                    win.set_size(PhysicalSize::new(width_phys, client_h))?;
                    win.set_position(PhysicalPosition::new(x, y))?;
                }
            }
        }
    }

    set_window_transparent(win, false);
    Ok(())
}

/// 收到屏幕边缘悬浮条（partial=true 时大部分在屏外）
pub fn dock_ball_window(
    win: &WebviewWindow,
    ball_y: Option<i32>,
    side: &str,
    peek: bool,
) -> tauri::Result<i32> {
    let Some(monitor) = resolve_monitor(win)? else {
        return Ok(0);
    };

    let scale = monitor.scale_factor();
    let work = monitor.work_area();
    let ball_w = ball_size_phys(scale);
    let ball_h = ball_w;
    let visible = visible_width_phys(scale, peek);

    let y = clamp_ball_y(
        ball_y.unwrap_or(default_ball_y(work.position.y, work.size.height, ball_h)),
        work.position.y,
        work.size.height,
        ball_h,
    );

    let x = if side == "left" {
        work.position.x - (ball_w as i32 - visible as i32)
    } else {
        work.position.x + work.size.width as i32 - visible as i32
    };

    win.set_resizable(false)?;
    win.set_size(PhysicalSize::new(ball_w, ball_h))?;
    win.set_position(PhysicalPosition::new(x, y))?;
    set_window_transparent(win, true);

    Ok(y)
}

pub fn current_ball_y(win: &WebviewWindow) -> tauri::Result<i32> {
    Ok(win.outer_position()?.y)
}
