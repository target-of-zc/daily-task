const RUN_KEY: &str = r"Software\Microsoft\Windows\CurrentVersion\Run";

/// 当前应用使用的注册表名
const AUTOSTART_NAME: &str = "DailyTask";
/// Python 旧版使用的注册表名，需一并清理
const LEGACY_AUTOSTART_NAME: &str = "DailyTaskList";

const ALL_AUTOSTART_NAMES: &[&str] = &[AUTOSTART_NAME, LEGACY_AUTOSTART_NAME];

#[cfg(windows)]
fn open_run_key_for_write() -> Result<winreg::RegKey, String> {
    use winreg::enums::{HKEY_CURRENT_USER, KEY_SET_VALUE};
    use winreg::RegKey;
    RegKey::predef(HKEY_CURRENT_USER)
        .open_subkey_with_flags(RUN_KEY, KEY_SET_VALUE)
        .map_err(|e| format!("无法打开自启注册表: {e}"))
}

#[cfg(windows)]
fn open_run_key_for_read() -> Result<winreg::RegKey, String> {
    use winreg::enums::HKEY_CURRENT_USER;
    use winreg::RegKey;
    RegKey::predef(HKEY_CURRENT_USER)
        .open_subkey(RUN_KEY)
        .map_err(|e| format!("无法读取自启注册表: {e}"))
}

#[cfg(windows)]
fn entry_enabled(key: &winreg::RegKey, name: &str) -> bool {
    key.get_value::<String, _>(name)
        .map(|v| !v.trim().is_empty())
        .unwrap_or(false)
}

#[cfg(windows)]
fn remove_entry(key: &winreg::RegKey, name: &str) -> Result<(), String> {
    match key.delete_value(name) {
        Ok(()) => Ok(()),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(e) => Err(format!("删除自启项 {name} 失败: {e}")),
    }
}

#[cfg(windows)]
pub fn is_autostart_enabled() -> bool {
    let Ok(key) = open_run_key_for_read() else {
        return false;
    };
    ALL_AUTOSTART_NAMES
        .iter()
        .any(|name| entry_enabled(&key, name))
}

#[cfg(not(windows))]
pub fn is_autostart_enabled() -> bool {
    false
}

#[cfg(windows)]
pub fn set_autostart(enable: bool) -> Result<(), String> {
    let key = open_run_key_for_write()?;

    if enable {
        for name in ALL_AUTOSTART_NAMES {
            remove_entry(&key, name)?;
        }
        let exe = std::env::current_exe().map_err(|e| e.to_string())?;
        let value = format!("\"{}\"", exe.display());
        key.set_value(AUTOSTART_NAME, &value)
            .map_err(|e| format!("写入自启失败: {e}"))?;
    } else {
        for name in ALL_AUTOSTART_NAMES {
            remove_entry(&key, name)?;
        }
    }
    Ok(())
}

#[cfg(not(windows))]
pub fn set_autostart(_enable: bool) -> Result<(), String> {
    Err("仅支持 Windows 开机自启".into())
}
