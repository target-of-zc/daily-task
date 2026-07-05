use std::fs;
use std::path::PathBuf;

use serde::{Deserialize, Serialize};

use crate::store::TaskStore;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EmailConfig {
    #[serde(default = "default_true")]
    pub enabled: bool,
    #[serde(default = "default_smtp")]
    pub smtp_host: String,
    #[serde(default = "default_port")]
    pub smtp_port: u16,
    pub from: String,
    pub to: String,
    pub auth_code: String,
}

fn default_true() -> bool {
    true
}
fn default_smtp() -> String {
    "smtp.qq.com".into()
}
fn default_port() -> u16 {
    465
}

impl Default for EmailConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            smtp_host: default_smtp(),
            smtp_port: default_port(),
            from: String::new(),
            to: String::new(),
            auth_code: String::new(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EmailSettingsView {
    pub enabled: bool,
    pub from: String,
    pub to: String,
    pub configured: bool,
}

pub fn config_path() -> PathBuf {
    TaskStore::data_dir().join("email.json")
}

pub fn load() -> EmailConfig {
    let path = config_path();
    if !path.exists() {
        return EmailConfig::default();
    }
    fs::read_to_string(&path)
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}

pub fn save(config: &EmailConfig) -> Result<(), String> {
    let path = config_path();
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("创建配置目录失败: {e}"))?;
    }
    let json = serde_json::to_string_pretty(config).map_err(|e| format!("序列化失败: {e}"))?;
    fs::write(&path, json).map_err(|e| format!("保存邮件配置失败: {e}"))?;
    Ok(())
}

pub fn to_view(config: &EmailConfig) -> EmailSettingsView {
    EmailSettingsView {
        enabled: config.enabled,
        from: config.from.clone(),
        to: config.to.clone(),
        configured: !config.auth_code.is_empty() && !config.from.is_empty(),
    }
}

pub fn is_ready(config: &EmailConfig) -> bool {
    config.enabled
        && !config.from.is_empty()
        && !config.to.is_empty()
        && !config.auth_code.is_empty()
}
