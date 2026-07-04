use chrono::NaiveDate;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use uuid::Uuid;

use crate::time_util::{hm_str, now_str, today_naive, today_str};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Task {
    pub id: String,
    pub text: String,
    pub done: bool,
    #[serde(default)]
    pub recurring_id: Option<String>,
    pub created_date: String,
    pub created_at: String,
    #[serde(default)]
    pub completed_at: Option<String>,
    #[serde(default)]
    pub carried_from: Option<String>,
    #[serde(default = "default_tag")]
    pub tag: String,
    #[serde(default = "default_priority")]
    pub priority: String,
    #[serde(default)]
    pub remind_at: String,
    #[serde(default)]
    pub reminded: bool,
}

fn default_tag() -> String {
    "其他".into()
}
fn default_priority() -> String {
    "中".into()
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecurringTemplate {
    pub id: String,
    pub text: String,
    pub created: String,
    #[serde(default = "default_tag")]
    pub tag: String,
    #[serde(default = "default_priority")]
    pub priority: String,
    #[serde(default)]
    pub remind_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct Meta {
    #[serde(default)]
    pub last_opened: Option<String>,
    #[serde(default)]
    pub ball_y: Option<i32>,
    #[serde(default = "default_side")]
    pub dock_side: String,
    #[serde(default)]
    pub always_on_top: bool,
}

fn default_side() -> String {
    "right".into()
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StoreData {
    pub version: u32,
    #[serde(default)]
    pub recurring: Vec<RecurringTemplate>,
    #[serde(default)]
    pub daily: HashMap<String, Vec<Task>>,
    #[serde(default)]
    pub meta: Meta,
}

pub struct TaskStore {
    path: PathBuf,
    log_path: PathBuf,
    pub data: StoreData,
    pub tasks: Vec<Task>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScheduledDay {
    pub date: String,
    pub tasks: Vec<Task>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WeeklyStats {
    pub total: u32,
    pub done: u32,
    pub rate: String,
    pub by_tag: HashMap<String, u32>,
    pub delayed: Vec<String>,
    pub week_start: String,
    pub week_end: String,
}


fn new_id() -> String {
    Uuid::new_v4().simple().to_string()[..8].to_string()
}

impl TaskStore {
    pub fn new(path: PathBuf) -> Self {
        crate::logger::migrate_legacy_log();
        let log_path = crate::logger::log_path();
        let mut store = Self {
            path,
            log_path,
            data: StoreData {
                version: 3,
                recurring: vec![],
                daily: HashMap::new(),
                meta: Meta::default(),
            },
            tasks: vec![],
        };
        store.load(true);
        store.prepare_today();
        store
    }

    #[cfg(test)]
    pub fn new_isolated(path: PathBuf) -> Self {
        crate::logger::migrate_legacy_log();
        let log_path = crate::logger::log_path();
        let mut store = Self {
            path,
            log_path,
            data: StoreData {
                version: 3,
                recurring: vec![],
                daily: HashMap::new(),
                meta: Meta::default(),
            },
            tasks: vec![],
        };
        store.load(false);
        store.prepare_today();
        store
    }

    pub fn data_dir() -> PathBuf {
        let base = dirs::data_local_dir().unwrap_or_else(|| PathBuf::from("."));
        base.join("DailyTask")
    }

    pub fn default_path() -> PathBuf {
        Self::data_dir().join("tasks_data.json")
    }

    fn legacy_data_paths() -> Vec<PathBuf> {
        let mut paths = vec![PathBuf::from("tasks_data.json")];
        if let Ok(cwd) = std::env::current_dir() {
            let mut dir = Some(cwd);
            for _ in 0..6 {
                let Some(d) = dir else { break };
                paths.push(d.join("tasks_data.json"));
                paths.push(d.join("backups"));
                dir = d.parent().map(|p| p.to_path_buf());
            }
        }
        if let Ok(exe) = std::env::current_exe() {
            let mut dir = exe.parent().map(|p| p.to_path_buf());
            for _ in 0..6 {
                let Some(d) = dir else { break };
                paths.push(d.join("tasks_data.json"));
                paths.push(d.join("backups"));
                dir = d.parent().map(|p| p.to_path_buf());
            }
        }
        paths
    }

    fn collect_json_candidates(seed: &PathBuf) -> Vec<PathBuf> {
        let mut out = vec![];
        if seed.is_file() {
            out.push(seed.clone());
            return out;
        }
        if !seed.is_dir() {
            return out;
        }
        let Ok(entries) = fs::read_dir(seed) else {
            return out;
        };
        for entry in entries.flatten() {
            let path = entry.path();
            let Some(name) = path.file_name().and_then(|n| n.to_str()) else {
                continue;
            };
            if name == "tasks_data.json"
                || (name.starts_with("tasks_") && name.ends_with(".json"))
            {
                out.push(path);
            }
        }
        out
    }

    fn try_load_file(path: &std::path::Path) -> Option<StoreData> {
        let content = fs::read_to_string(path).ok()?;
        let mut data: StoreData = serde_json::from_str(&content).ok()?;
        if data.version < 3 {
            data.version = 3;
        }
        Some(data)
    }

    fn data_richness(data: &StoreData) -> usize {
        let daily_count: usize = data.daily.values().map(|v| v.len()).sum();
        data.recurring.len() + daily_count
    }

    fn load(&mut self, migrate: bool) {
        if let Some(parent) = self.path.parent() {
            let _ = fs::create_dir_all(parent);
        }

        let mut best: Option<(StoreData, PathBuf)> = None;

        if self.path.exists() {
            if let Some(data) = Self::try_load_file(&self.path) {
                best = Some((data, self.path.clone()));
            }
        }

        if migrate {
            for legacy in Self::legacy_data_paths() {
                for candidate in Self::collect_json_candidates(&legacy) {
                    if candidate == self.path {
                        continue;
                    }
                    if let Some(data) = Self::try_load_file(&candidate) {
                        let score = Self::data_richness(&data);
                        let current =
                            best.as_ref().map(|(d, _)| Self::data_richness(d)).unwrap_or(0);
                        if score > current {
                            best = Some((data, candidate));
                        }
                    }
                }
            }
        }

        if let Some((data, source)) = best {
            self.data = data;
            if source != self.path {
                let _ = fs::copy(&source, &self.path);
            }
        }
    }

    fn save(&mut self) -> Result<(), String> {
        let today = today_str();
        self.data.daily.insert(today.clone(), self.tasks.clone());
        self.data.meta.last_opened = Some(today);
        if let Some(parent) = self.path.parent() {
            fs::create_dir_all(parent).map_err(|e| format!("创建数据目录失败: {e}"))?;
        }
        let json =
            serde_json::to_string_pretty(&self.data).map_err(|e| format!("序列化失败: {e}"))?;
        fs::write(&self.path, json).map_err(|e| format!("保存失败: {e}"))?;
        crate::backup::backup_data(&self.path);
        Ok(())
    }

    fn log(&self, event: &str, task: &Task) {
        crate::logger::log_event(&self.log_path, event, task);
    }

    fn build_new_day_tasks(&self, last_date: &str) -> Vec<Task> {
        let today = today_str();
        let now = now_str();
        let mut new_tasks = Vec::new();
        let mut seen = std::collections::HashSet::new();

        for item in &self.data.recurring {
            let task = Task {
                id: new_id(),
                text: item.text.clone(),
                done: false,
                recurring_id: Some(item.id.clone()),
                created_date: today.clone(),
                created_at: now.clone(),
                completed_at: None,
                carried_from: None,
                tag: item.tag.clone(),
                priority: item.priority.clone(),
                remind_at: item.remind_at.clone(),
                reminded: false,
            };
            seen.insert(task.text.clone());
            self.log("recurring_spawn", &task);
            new_tasks.push(task);
        }

        if let Ok(last) = NaiveDate::parse_from_str(last_date, "%Y-%m-%d") {
            if let Ok(today_d) = NaiveDate::parse_from_str(&today, "%Y-%m-%d") {
                if last < today_d {
                    if let Some(prev) = self.data.daily.get(last_date) {
                        for t in prev {
                            if t.done || t.recurring_id.is_some() || seen.contains(&t.text) {
                                continue;
                            }
                            let carried = Task {
                                id: new_id(),
                                text: t.text.clone(),
                                done: false,
                                recurring_id: None,
                                created_date: t.created_date.clone(),
                                created_at: t.created_at.clone(),
                                completed_at: None,
                                carried_from: Some(last_date.to_string()),
                                tag: t.tag.clone(),
                                priority: t.priority.clone(),
                                remind_at: t.remind_at.clone(),
                                reminded: false,
                            };
                            self.log("carryover", &carried);
                            seen.insert(t.text.clone());
                            new_tasks.push(carried);
                        }
                    }
                }
            }
        }
        new_tasks
    }

    pub fn prepare_today(&mut self) -> bool {
        let today = today_str();
        let last = self.data.meta.last_opened.clone();

        if last.as_deref() == Some(today.as_str()) {
            self.tasks = self.data.daily.get(&today).cloned().unwrap_or_default();
            return false;
        }

        if last.is_none() {
            if let Some(existing) = self.data.daily.get(&today).cloned() {
                self.tasks = existing;
                self.merge_missing_recurring();
            } else {
                self.tasks = self.build_new_day_tasks("");
                self.data.daily.insert(today.clone(), self.tasks.clone());
            }
        } else {
            let last_s = last.unwrap();
            let preplanned = Self::collect_preplanned(&today, &self.data.daily);
            let mut new_tasks = self.build_new_day_tasks(&last_s);
            for t in preplanned {
                if !new_tasks.iter().any(|x| x.id == t.id) {
                    new_tasks.push(t);
                }
            }
            self.tasks = new_tasks;
            self.data.daily.insert(today.clone(), self.tasks.clone());
        }
        self.data.meta.last_opened = Some(today);
        let _ = self.save();
        true
    }

    /// 补全当天缺失的常驻任务（不覆盖已有项）
    fn merge_missing_recurring(&mut self) {
        for t in self.build_new_day_tasks("") {
            if t.recurring_id.is_some()
                && !self
                    .tasks
                    .iter()
                    .any(|x| x.recurring_id == t.recurring_id)
            {
                self.tasks.push(t);
            }
        }
    }

    fn collect_preplanned(today: &str, daily: &HashMap<String, Vec<Task>>) -> Vec<Task> {
        daily
            .get(today)
            .map(|tasks| {
                tasks
                    .iter()
                    .filter(|t| Self::is_preplanned(t, today))
                    .cloned()
                    .collect()
            })
            .unwrap_or_default()
    }

    fn is_preplanned(task: &Task, scheduled: &str) -> bool {
        if task.created_date != scheduled {
            return false;
        }
        let added = task.created_at.split(' ').next().unwrap_or("");
        added < scheduled
    }

    fn parse_target_date(input: &str) -> Result<String, String> {
        let input = input.trim();
        let date = if input.is_empty() {
            today_str()
        } else {
            NaiveDate::parse_from_str(input, "%Y-%m-%d")
                .map_err(|_| "日期格式无效，请使用 YYYY-MM-DD".to_string())?
                .format("%Y-%m-%d")
                .to_string()
        };
        let today = today_str();
        if date < today {
            return Err("不能添加到过去的日期".to_string());
        }
        Ok(date)
    }

    fn locate_task(&self, id: &str) -> Result<(String, usize), String> {
        let today = today_str();
        if let Some(idx) = self.tasks.iter().position(|t| t.id == id) {
            return Ok((today, idx));
        }
        let mut dates: Vec<_> = self.data.daily.keys().cloned().collect();
        dates.sort();
        for date in dates {
            if date == today {
                continue;
            }
            if let Some(tasks) = self.data.daily.get(&date) {
                if let Some(idx) = tasks.iter().position(|t| t.id == id) {
                    return Ok((date, idx));
                }
            }
        }
        Err("任务不存在".to_string())
    }

    pub fn list_tasks(&self) -> Vec<Task> {
        self.tasks.clone()
    }

    pub fn list_scheduled_days(&self) -> Vec<ScheduledDay> {
        let today = today_str();
        let mut dates: Vec<_> = self
            .data
            .daily
            .keys()
            .filter(|d| d.as_str() > today.as_str())
            .cloned()
            .collect();
        dates.sort();
        dates
            .into_iter()
            .filter_map(|date| {
                let tasks = self.data.daily.get(&date)?.clone();
                if tasks.is_empty() {
                    None
                } else {
                    Some(ScheduledDay { date, tasks })
                }
            })
            .collect()
    }

    pub fn add_task(
        &mut self,
        text: String,
        recurring: bool,
        tag: String,
        priority: String,
        remind_at: String,
        target_date: String,
    ) -> Result<Task, String> {
        let today = today_str();
        let target = Self::parse_target_date(&target_date)?;
        let now = now_str();
        if recurring && target != today {
            return Err("常驻任务只能添加到今天".to_string());
        }
        let mut recurring_id = None;
        if recurring {
            let rid = new_id();
            self.data.recurring.push(RecurringTemplate {
                id: rid.clone(),
                text: text.clone(),
                created: today.clone(),
                tag: tag.clone(),
                priority: priority.clone(),
                remind_at: remind_at.clone(),
            });
            recurring_id = Some(rid);
        }
        let task = Task {
            id: new_id(),
            text,
            done: false,
            recurring_id,
            created_date: target.clone(),
            created_at: now,
            completed_at: None,
            carried_from: None,
            tag,
            priority,
            remind_at,
            reminded: false,
        };
        if target == today {
            self.tasks.push(task.clone());
        } else {
            self.data
                .daily
                .entry(target)
                .or_default()
                .push(task.clone());
        }
        self.log("add", &task);
        self.save()?;
        Ok(task)
    }

    pub fn toggle_task(&mut self, id: &str) -> Result<Task, String> {
        let today = today_str();
        let (date, idx) = self.locate_task(id)?;
        let task = if date == today {
            let task = &mut self.tasks[idx];
            if task.done {
                task.done = false;
                task.completed_at = None;
                task.reminded = false;
            } else {
                task.done = true;
                task.completed_at = Some(now_str());
            }
            self.tasks[idx].clone()
        } else {
            let tasks = self.data.daily.get_mut(&date).ok_or("任务不存在")?;
            let task = &mut tasks[idx];
            if task.done {
                task.done = false;
                task.completed_at = None;
                task.reminded = false;
            } else {
                task.done = true;
                task.completed_at = Some(now_str());
            }
            tasks[idx].clone()
        };
        let event = if task.done { "complete" } else { "uncomplete" };
        self.log(event, &task);
        self.save()?;
        Ok(task)
    }

    pub fn delete_task(&mut self, id: &str) -> Result<(), String> {
        let today = today_str();
        let (date, idx) = self.locate_task(id)?;
        let task = if date == today {
            let task = self.tasks[idx].clone();
            self.tasks.retain(|t| t.id != id);
            task
        } else {
            let tasks = self.data.daily.get_mut(&date).ok_or("任务不存在")?;
            let task = tasks[idx].clone();
            tasks.remove(idx);
            task
        };
        self.log("delete", &task);
        self.save()?;
        Ok(())
    }

    pub fn clear_completed(&mut self) {
        let removed: Vec<Task> = self.tasks.iter().filter(|t| t.done).cloned().collect();
        self.tasks.retain(|t| !t.done);
        for task in removed {
            self.log("clear_completed", &task);
        }
        let _ = self.save();
    }

    pub fn check_reminders(&mut self) -> Vec<Task> {
        let hm = hm_str();
        let mut triggered = Vec::new();
        for task in &mut self.tasks {
            if task.done || task.remind_at.is_empty() || task.reminded {
                continue;
            }
            if task.remind_at == hm {
                task.reminded = true;
                triggered.push(task.clone());
            }
        }
        if !triggered.is_empty() {
            let _ = self.save();
        }
        triggered
    }

    pub fn save_ball_pos(&mut self, y: i32, side: &str) {
        self.data.meta.ball_y = Some(y);
        self.data.meta.dock_side = side.to_string();
        let _ = self.save();
    }

    pub fn ball_pos(&self) -> (Option<i32>, String) {
        (self.data.meta.ball_y, self.data.meta.dock_side.clone())
    }

    pub fn weekly_stats(&self) -> WeeklyStats {
        let today = today_naive();
        let week_start = today - chrono::Duration::days(6);
        let mut total = 0u32;
        let mut done = 0u32;
        let mut by_tag: HashMap<String, u32> = HashMap::new();
        let mut delayed = Vec::new();

        for i in 0..7 {
            let d = week_start + chrono::Duration::days(i);
            let key = d.format("%Y-%m-%d").to_string();
            if let Some(tasks) = self.data.daily.get(&key) {
                for task in tasks {
                    total += 1;
                    *by_tag.entry(task.tag.clone()).or_insert(0) += 1;
                    if task.done {
                        done += 1;
                    } else if d < today {
                        delayed.push(task.text.clone());
                    }
                }
            }
        }

        let mut seen = std::collections::HashSet::new();
        delayed.retain(|t| seen.insert(t.clone()));
        delayed.truncate(8);

        let rate = if total > 0 {
            format!("{}%", done * 100 / total)
        } else {
            "—".into()
        };

        WeeklyStats {
            total,
            done,
            rate,
            by_tag,
            delayed,
            week_start: week_start.format("%m月%d日").to_string(),
            week_end: today.format("%m月%d日").to_string(),
        }
    }

    pub fn always_on_top(&self) -> bool {
        self.data.meta.always_on_top
    }

    pub fn set_always_on_top(&mut self, enabled: bool) -> Result<(), String> {
        self.data.meta.always_on_top = enabled;
        self.save()
    }

    pub fn manual_backup(&self) -> Option<PathBuf> {
        crate::backup::backup_data(&self.path)
    }
}

pub fn normalize_remind_time(input: &str) -> Option<String> {
    let input = input.trim();
    if input.is_empty() {
        return Some(String::new());
    }
    let parts: Vec<&str> = input.split(':').collect();
    let (h_str, m_str) = match parts.len() {
        2 | 3 => (parts[0], parts[1]),
        _ => return None,
    };
    let h: u32 = h_str.parse().ok()?;
    let m: u32 = m_str.parse().ok()?;
    if h > 23 || m > 59 {
        return None;
    }
    Some(format!("{:02}:{:02}", h, m))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn temp_store() -> (TaskStore, PathBuf) {
        let stamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let path = std::env::temp_dir().join(format!("daily-task-test-{stamp}.json"));
        let _ = fs::remove_file(&path);
        (TaskStore::new_isolated(path.clone()), path)
    }

    #[test]
    fn add_task_persists() {
        let (mut store, path) = temp_store();
        let task = store
            .add_task(
                "测试任务".into(),
                false,
                "工作".into(),
                "高".into(),
                "".into(),
                "".into(),
            )
            .expect("add should succeed");
        assert_eq!(task.text, "测试任务");
        assert_eq!(store.list_tasks().len(), 1);

        let reloaded = TaskStore::new_isolated(path.clone());
        assert_eq!(reloaded.list_tasks().len(), 1);
        assert_eq!(reloaded.list_tasks()[0].text, "测试任务");
        let _ = fs::remove_file(path);
    }

    #[test]
    fn normalize_remind_time_accepts_seconds() {
        assert_eq!(normalize_remind_time("09:30:00"), Some("09:30".into()));
        assert_eq!(normalize_remind_time(""), Some("".into()));
        assert_eq!(normalize_remind_time("25:00"), None);
    }
}
