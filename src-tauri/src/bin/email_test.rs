use daily_task_lib::{email, email_config};

fn main() {
    let mut config = email_config::load();
    if let Ok(from) = std::env::var("QQ_EMAIL") {
        config.from = from.clone();
        config.to = std::env::var("QQ_TO").unwrap_or(from);
    }
    if let Ok(auth) = std::env::var("QQ_AUTH") {
        config.auth_code = auth;
    }
    config.enabled = true;
    if config.smtp_host.is_empty() {
        config.smtp_host = "smtp.qq.com".into();
    }
    if config.smtp_port == 0 {
        config.smtp_port = 465;
    }

    if !email_config::is_ready(&config) {
        eprintln!("缺少配置：请设置 QQ_EMAIL 和 QQ_AUTH 环境变量，或在应用中保存邮件设置");
        std::process::exit(1);
    }

    match email::send_test_email(&config) {
        Ok(()) => {
            let _ = email_config::save(&config);
            println!("测试邮件已发送，请查收邮箱（含垃圾箱）");
        }
        Err(e) => {
            eprintln!("发送失败: {e}");
            std::process::exit(1);
        }
    }
}
