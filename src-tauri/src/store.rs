use chrono::{Local, NaiveDate, NaiveTime};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use uuid::Uuid;

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
    pub data: StoreData,
    pub tasks: Vec<Task>,
}

fn today_str() -> String {
    Local::now().format("%Y-%m-%d").to_string()
}

fn now_str() -> String {
    Local::now().format("%Y-%m-%d %H:%M:%S").to_string()
}

fn new_id() -> String {
    Uuid::new_v4().simple().to_string()[..8].to_string()
}

impl TaskStore {
    pub fn new(path: PathBuf) -> Self {
        let mut store = Self {
            path,
            data: StoreData {
                version: 3,
                recurring: vec![],
                daily: HashMap::new(),
                meta: Meta::default(),
            },
            tasks: vec![],
        };
        store.load();
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

    fn load(&mut self) {
        if !self.path.exists() {
            // migrate legacy path next to exe / project
            let legacy = PathBuf::from("tasks_data.json");
            if legacy.exists() {
                let _ = fs::create_dir_all(self.path.parent().unwrap());
                let _ = fs::copy(&legacy, &self.path);
            }
        }
        if self.path.exists() {
            if let Ok(content) = fs::read_to_string(&self.path) {
                if let Ok(mut data) = serde_json::from_str::<StoreData>(&content) {
                    if data.version < 3 {
                        data.version = 3;
                    }
                    self.data = data;
                }
            }
        }
    }

    fn save(&mut self) {
        let today = today_str();
        self.data.daily.insert(today.clone(), self.tasks.clone());
        self.data.meta.last_opened = Some(today);
        if let Some(parent) = self.path.parent() {
            let _ = fs::create_dir_all(parent);
        }
        if let Ok(json) = serde_json::to_string_pretty(&self.data) {
            let _ = fs::write(&self.path, json);
        }
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
                            new_tasks.push(Task {
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
                            });
                            seen.insert(t.text.clone());
                        }
                    }
                }
            }
        }
        new_tasks
    }

    pub fn prepare_today(&mut self) {
        let today = today_str();
        let last = self.data.meta.last_opened.clone();

        if last.as_deref() == Some(today.as_str()) {
            self.tasks = self.data.daily.get(&today).cloned().unwrap_or_default();
            return;
        }

        if last.is_none() {
            if let Some(existing) = self.data.daily.get(&today).cloned() {
                self.tasks = existing;
            } else {
                self.tasks = self.build_new_day_tasks("");
                self.data.daily.insert(today.clone(), self.tasks.clone());
            }
        } else {
            let last_s = last.unwrap();
            self.tasks = self.build_new_day_tasks(&last_s);
            self.data.daily.insert(today.clone(), self.tasks.clone());
        }
        self.data.meta.last_opened = Some(today);
        self.save();
    }

    pub fn list_tasks(&self) -> Vec<Task> {
        self.tasks.clone()
    }

    pub fn add_task(
        &mut self,
        text: String,
        recurring: bool,
        tag: String,
        priority: String,
        remind_at: String,
    ) -> Result<Task, String> {
        let today = today_str();
        let now = now_str();
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
            created_date: today,
            created_at: now,
            completed_at: None,
            carried_from: None,
            tag,
            priority,
            remind_at,
            reminded: false,
        };
        self.tasks.push(task.clone());
        self.save();
        Ok(task)
    }

    pub fn toggle_task(&mut self, id: &str) -> Result<Task, String> {
        let task = self
            .tasks
            .iter_mut()
            .find(|t| t.id == id)
            .ok_or_else(|| "任务不存在".to_string())?;
        if task.done {
            task.done = false;
            task.completed_at = None;
            task.reminded = false;
        } else {
            task.done = true;
            task.completed_at = Some(now_str());
        }
        let cloned = task.clone();
        self.save();
        Ok(cloned)
    }

    pub fn delete_task(&mut self, id: &str) -> Result<(), String> {
        let len_before = self.tasks.len();
        self.tasks.retain(|t| t.id != id);
        if self.tasks.len() == len_before {
            return Err("任务不存在".into());
        }
        self.save();
        Ok(())
    }

    pub fn clear_completed(&mut self) {
        self.tasks.retain(|t| !t.done);
        self.save();
    }

    pub fn check_reminders(&mut self) -> Vec<Task> {
        let hm = Local::now().format("%H:%M").to_string();
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
            self.save();
        }
        triggered
    }

    pub fn save_ball_pos(&mut self, y: i32, side: &str) {
        self.data.meta.ball_y = Some(y);
        self.data.meta.dock_side = side.to_string();
        self.save();
    }

    pub fn ball_pos(&self) -> (Option<i32>, String) {
        (self.data.meta.ball_y, self.data.meta.dock_side.clone())
    }
}

pub fn normalize_remind_time(input: &str) -> Option<String> {
    let input = input.trim();
    if input.is_empty() {
        return Some(String::new());
    }
    let parts: Vec<&str> = input.split(':').collect();
    if parts.len() != 2 {
        return None;
    }
    let h: u32 = parts[0].parse().ok()?;
    let m: u32 = parts[1].parse().ok()?;
    if h > 23 || m > 59 {
        return None;
    }
    Some(format!("{:02}:{:02}", h, m))
}
