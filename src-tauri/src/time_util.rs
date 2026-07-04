use chrono::{DateTime, FixedOffset, NaiveDate, TimeZone, Utc};

pub fn cst() -> FixedOffset {
    FixedOffset::east_opt(8 * 3600).expect("UTC+8")
}

pub fn now_cst() -> DateTime<FixedOffset> {
    Utc::now().with_timezone(&cst())
}

pub fn today_str() -> String {
    now_cst().format("%Y-%m-%d").to_string()
}

pub fn now_str() -> String {
    now_cst().format("%Y-%m-%d %H:%M:%S").to_string()
}

pub fn today_naive() -> NaiveDate {
    now_cst().date_naive()
}

pub fn hm_str() -> String {
    now_cst().format("%H:%M").to_string()
}

/// 距离下一个东八区 00:00 的秒数（至少 1 秒）
pub fn secs_until_next_cst_midnight() -> u64 {
    let now = now_cst();
    let next_day = now.date_naive().succ_opt().expect("date overflow");
    let next_midnight = cst()
        .from_local_datetime(&next_day.and_hms_opt(0, 0, 0).expect("midnight"))
        .single()
        .expect("CST midnight");
    (next_midnight - now).num_seconds().max(1) as u64
}
