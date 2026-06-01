use chrono::{DateTime, Datelike, Local, TimeZone, Timelike};

// ==========================================
// 1. Cron 表达式解析器
// ==========================================

#[derive(Debug, Clone)]
pub struct CronParser {
    minutes: Vec<u32>,
    hours: Vec<u32>,
    days: Vec<u32>,
    months: Vec<u32>,
    days_of_week: Vec<u32>,
}

impl CronParser {
    pub fn parse(expr: &str) -> Option<Self> {
        let parts: Vec<&str> = expr.split_whitespace().collect();
        if parts.len() != 5 {
            return None;
        }

        let minutes = parse_field(parts[0], 0, 59)?;
        let hours = parse_field(parts[1], 0, 23)?;
        let days = parse_field(parts[2], 1, 31)?;
        let months = parse_field(parts[3], 1, 12)?;
        let days_of_week = parse_field(parts[4], 0, 6)?; // 0 = Sun, 6 = Sat

        Some(Self {
            minutes,
            hours,
            days,
            months,
            days_of_week,
        })
    }

    pub fn next_run_from(&self, current: DateTime<Local>) -> Option<DateTime<Local>> {
        let mut check = current + chrono::Duration::minutes(1);
        // 向后扫描最多 60 天
        for _ in 0..86400 {
            let min = check.minute();
            let hr = check.hour();
            let day = check.day();
            let mon = check.month();
            let wday = match check.weekday() {
                chrono::Weekday::Sun => 0,
                chrono::Weekday::Mon => 1,
                chrono::Weekday::Tue => 2,
                chrono::Weekday::Wed => 3,
                chrono::Weekday::Thu => 4,
                chrono::Weekday::Fri => 5,
                chrono::Weekday::Sat => 6,
            };

            if self.minutes.contains(&min)
                && self.hours.contains(&hr)
                && self.days.contains(&day)
                && self.months.contains(&mon)
                && self.days_of_week.contains(&wday)
            {
                if let Some(aligned) = Local.with_ymd_and_hms(check.year(), check.month(), check.day(), check.hour(), check.minute(), 0).single() {
                    return Some(aligned);
                }
            }
            check = check + chrono::Duration::minutes(1);
        }
        None
    }
}

fn parse_field(field: &str, min_val: u32, max_val: u32) -> Option<Vec<u32>> {
    let mut values = Vec::new();
    if field == "*" {
        return Some((min_val..=max_val).collect());
    }

    for part in field.split(',') {
        if part.contains('/') {
            let subparts: Vec<&str> = part.split('/').collect();
            if subparts.len() != 2 {
                return None;
            }
            let step: u32 = subparts[1].parse().ok()?;
            let range_str = subparts[0];
            let (start, end) = if range_str == "*" {
                (min_val, max_val)
            } else if range_str.contains('-') {
                let range_parts: Vec<&str> = range_str.split('-').collect();
                if range_parts.len() != 2 {
                    return None;
                }
                (range_parts[0].parse().ok()?, range_parts[1].parse().ok()?)
            } else {
                (range_str.parse().ok()?, max_val)
            };
            let mut i = start;
            while i <= end {
                values.push(i);
                i += step;
            }
        } else if part.contains('-') {
            let range_parts: Vec<&str> = part.split('-').collect();
            if range_parts.len() != 2 {
                return None;
            }
            let start: u32 = range_parts[0].parse().ok()?;
            let end: u32 = range_parts[1].parse().ok()?;
            for i in start..=end {
                values.push(i);
            }
        } else {
            let val: u32 = part.parse().ok()?;
            values.push(val);
        }
    }
    values.sort();
    values.dedup();
    Some(values)
}

/// 计算下一次执行时间
pub fn calculate_next_run(kind: &str, value: &str) -> Option<i64> {
    let now = Local::now();
    match kind {
        "at" => {
            // 一次性时间戳
            let ms: i64 = value.parse().ok()?;
            if ms > now.timestamp_millis() {
                Some(ms)
            } else {
                None
            }
        }
        "every" => {
            // 间隔运行，单位分钟
            let mins: i64 = value.parse().ok()?;
            if mins <= 0 {
                return None;
            }
            Some((now + chrono::Duration::minutes(mins)).timestamp_millis())
        }
        "cron" => {
            // Cron 表达式
            let parser = CronParser::parse(value)?;
            let next_dt = parser.next_run_from(now)?;
            Some(next_dt.timestamp_millis())
        }
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::TimeZone;

    #[test]
    fn test_cron_parser_parse() {
        // 测试每 15 分钟的表达式
        let p = CronParser::parse("*/15 * * * *").unwrap();
        assert_eq!(p.minutes, vec![0, 15, 30, 45]);
        assert_eq!(p.hours.len(), 24);

        // 测试范围周
        let p2 = CronParser::parse("0 9 * * 1-5").unwrap();
        assert_eq!(p2.minutes, vec![0]);
        assert_eq!(p2.hours, vec![9]);
        assert_eq!(p2.days_of_week, vec![1, 2, 3, 4, 5]);
    }

    #[test]
    fn test_cron_parser_next_run() {
        let p = CronParser::parse("0 9 * * 1-5").unwrap();
        // 模拟一个星期天的中午：2026年6月7日 12:00:00 (Sunday)
        let base_dt = Local.with_ymd_and_hms(2026, 6, 7, 12, 0, 0).single().unwrap();
        let next_run = p.next_run_from(base_dt).unwrap();
        
        // 预期下一次运行是周一早上 9:00: 2026年6月8日 9:00:00 (Monday)
        assert_eq!(next_run.year(), 2026);
        assert_eq!(next_run.month(), 6);
        assert_eq!(next_run.day(), 8);
        assert_eq!(next_run.hour(), 9);
        assert_eq!(next_run.minute(), 0);
    }

    #[test]
    fn test_calculate_next_run() {
        // 测试 every 模式 (5分钟)
        let next_ms = calculate_next_run("every", "5").unwrap();
        let now_ms = Local::now().timestamp_millis();
        // 预期大约在 5 分钟之后 (误差10秒内)
        assert!((next_ms - now_ms - 300_000).abs() < 10_000);

        // 测试 at 模式
        let future_time = Local::now().timestamp_millis() + 100_000;
        let next_ms_at = calculate_next_run("at", &future_time.to_string()).unwrap();
        assert_eq!(next_ms_at, future_time);
    }
}

