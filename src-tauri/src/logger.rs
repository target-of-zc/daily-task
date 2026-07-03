use crate::store::Task;
use std::fs::{File, OpenOptions};
use std::io::Write;
use std::path::Path;

const HEADERS: &[&str] = &[
    "event_time",
    "event",
    "task_id",
    "text",
    "created_at",
    "completed_at",
    "recurring",
    "carried_from",
    "tag",
    "priority",
];

pub fn log_path() -> std::path::PathBuf {
    crate::store::TaskStore::data_dir().join("task_log.csv")
}

fn ensure_file(path: &Path) -> std::io::Result<()> {
    if path.exists() {
        return Ok(());
    }
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let mut f = File::create(path)?;
    f.write_all("\u{feff}".as_bytes())?;
    writeln!(f, "{}", HEADERS.join(","))?;
    Ok(())
}

pub fn log_event(path: &Path, event: &str, task: &Task) {
    if ensure_file(path).is_err() {
        return;
    }
    let Ok(mut f) = OpenOptions::new().append(true).open(path) else {
        return;
    };
    let recurring = if task.recurring_id.is_some() {
        "yes"
    } else {
        "no"
    };
    let row = [
        crate::time_util::now_str(),
        event.to_string(),
        task.id.clone(),
        task.text.clone(),
        task.created_at.clone(),
        task.completed_at.clone().unwrap_or_default(),
        recurring.to_string(),
        task.carried_from.clone().unwrap_or_default(),
        task.tag.clone(),
        task.priority.clone(),
    ];
    let escaped: Vec<String> = row
        .iter()
        .map(|s| {
            if s.contains(',') || s.contains('"') || s.contains('\n') {
                format!("\"{}\"", s.replace('"', "\"\""))
            } else {
                s.clone()
            }
        })
        .collect();
    let _ = writeln!(f, "{}", escaped.join(","));
}

pub fn migrate_legacy_log() {
    let dest = log_path();
    if dest.exists() {
        return;
    }
    let legacy = std::path::PathBuf::from("task_log.csv");
    if legacy.exists() {
        if let Some(parent) = dest.parent() {
            let _ = std::fs::create_dir_all(parent);
        }
        let _ = std::fs::copy(&legacy, &dest);
    }
}
