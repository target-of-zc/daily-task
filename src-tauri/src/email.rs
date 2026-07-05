use lettre::message::header::ContentType;
use lettre::transport::smtp::authentication::Credentials;
use lettre::transport::smtp::client::{Tls, TlsParameters};
use lettre::{Message, SmtpTransport, Transport};

use crate::email_config::EmailConfig;
use crate::store::Task;

fn build_mailer(config: &EmailConfig) -> Result<SmtpTransport, String> {
    let creds = Credentials::new(config.from.clone(), config.auth_code.clone());
    let tls = TlsParameters::builder(config.smtp_host.clone())
        .build()
        .map_err(|e| format!("TLS 初始化失败: {e}"))?;
    Ok(SmtpTransport::relay(&config.smtp_host)
        .map_err(|e| format!("SMTP 连接失败: {e}"))?
        .port(config.smtp_port)
        .tls(Tls::Wrapper(tls))
        .credentials(creds)
        .build())
}

fn send_mail(config: &EmailConfig, subject: &str, body: &str) -> Result<(), String> {
    let email = Message::builder()
        .from(
            config
                .from
                .parse()
                .map_err(|e| format!("发件地址无效: {e}"))?,
        )
        .to(config
            .to
            .parse()
            .map_err(|e| format!("收件地址无效: {e}"))?)
        .subject(subject)
        .header(ContentType::TEXT_PLAIN)
        .body(body.to_string())
        .map_err(|e| format!("构建邮件失败: {e}"))?;

    let mailer = build_mailer(config)?;
    mailer
        .send(&email)
        .map_err(|e| format!("发送邮件失败: {e}"))?;
    Ok(())
}

pub fn send_reminder_email(config: &EmailConfig, task: &Task) -> Result<(), String> {
    let subject = format!("【每日任务】提醒：{}", task.text);
    let body = format!(
        "您有一条任务到了提醒时间，尚未完成：\n\n\
         任务：{text}\n\
         提醒时间：{remind}\n\
         计划日期：{date}\n\n\
         请打开「每日任务」应用处理。",
        text = task.text,
        remind = task.remind_at,
        date = task.created_date,
    );
    send_mail(config, &subject, &body)
}

pub fn send_due_plan_email(config: &EmailConfig, task: &Task) -> Result<(), String> {
    let subject = format!("【每日任务】计划到期：{}", task.text);
    let body = format!(
        "您有一条预先计划的任务今日到期，尚未完成：\n\n\
         任务：{text}\n\
         计划日期：{date}\n\
         添加时间：{created}\n\n\
         请打开「每日任务」应用处理。",
        text = task.text,
        date = task.created_date,
        created = task.created_at,
    );
    send_mail(config, &subject, &body)
}

pub fn send_test_email(config: &EmailConfig) -> Result<(), String> {
    send_mail(
        config,
        "【每日任务】邮件测试",
        "这是一封测试邮件。若您收到此消息，说明 QQ 邮箱提醒已配置成功。",
    )
}

pub fn send_evening_summary_email(config: &EmailConfig, tasks: &[Task]) -> Result<(), String> {
    let today = crate::time_util::today_str();
    let lines: Vec<String> = tasks
        .iter()
        .enumerate()
        .map(|(i, t)| {
            let remind = if t.remind_at.is_empty() {
                "无".to_string()
            } else {
                t.remind_at.clone()
            };
            format!("{}. {}（提醒 {}）", i + 1, t.text, remind)
        })
        .collect();
    let body = format!(
        "今日（{today}）21:00 仍有 {n} 项任务未完成：\n\n{list}\n\n请打开「每日任务」应用处理。",
        today = today,
        n = tasks.len(),
        list = lines.join("\n"),
    );
    send_mail(
        config,
        &format!("【每日任务】今日未完成汇总（{} 项）", tasks.len()),
        &body,
    )
}
