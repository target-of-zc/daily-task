use crate::time_util::now_cst;
use std::fs;
use std::path::{Path, PathBuf};

pub fn backup_dir() -> PathBuf {
    crate::store::TaskStore::data_dir().join("backups")
}

pub fn backup_data(data_path: &Path) -> Option<PathBuf> {
    if !data_path.exists() {
        return None;
    }
    let dir = backup_dir();
    let _ = fs::create_dir_all(&dir);
    let ts = now_cst().format("%Y%m%d_%H%M%S").to_string();
    let dst = dir.join(format!("tasks_{ts}.json"));
    if fs::copy(data_path, &dst).is_err() {
        return None;
    }
    let log_path = crate::logger::log_path();
    if log_path.exists() {
        let _ = fs::copy(&log_path, dir.join(format!("log_{ts}.csv")));
    }
    prune_old_backups(&dir);
    Some(dst)
}

fn prune_old_backups(dir: &Path) {
    let Ok(entries) = fs::read_dir(dir) else {
        return;
    };
    let mut files: Vec<PathBuf> = entries
        .filter_map(|e| e.ok())
        .map(|e| e.path())
        .filter(|p| {
            p.file_name()
                .and_then(|n| n.to_str())
                .is_some_and(|n| n.starts_with("tasks_") && n.ends_with(".json"))
        })
        .collect();
    files.sort_by(|a, b| b.cmp(a));
    for old in files.into_iter().skip(30) {
        let _ = fs::remove_file(&old);
        if let Some(name) = old.file_name().and_then(|n| n.to_str()) {
            let log_name = name.replace("tasks_", "log_").replace(".json", ".csv");
            let _ = fs::remove_file(dir.join(log_name));
        }
    }
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupEntry {
    pub name: String,
    pub path: String,
    pub modified: String,
}

pub fn list_backups() -> Vec<BackupEntry> {
    let dir = backup_dir();
    let Ok(entries) = fs::read_dir(&dir) else {
        return Vec::new();
    };
    let mut items: Vec<BackupEntry> = entries
        .filter_map(|e| e.ok())
        .map(|e| e.path())
        .filter(|p| {
            p.file_name()
                .and_then(|n| n.to_str())
                .is_some_and(|n| n.starts_with("tasks_") && n.ends_with(".json"))
        })
        .filter_map(|p| {
            let name = p.file_name()?.to_str()?.to_string();
            let modified = p
                .metadata()
                .ok()?
                .modified()
                .ok()
                .map(|t| {
                    chrono::DateTime::<chrono::Local>::from(t)
                        .format("%Y-%m-%d %H:%M")
                        .to_string()
                })
                .unwrap_or_default();
            Some(BackupEntry {
                path: p.to_string_lossy().into_owned(),
                name,
                modified,
            })
        })
        .collect();
    items.sort_by(|a, b| b.name.cmp(&a.name));
    items
}
