use chrono::{DateTime, FixedOffset, NaiveDate, Utc};
use chrono::TimeZone;

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
