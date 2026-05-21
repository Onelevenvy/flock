const INLINE_THRESHOLD: usize = 80;

fn compact_value(value: &serde_json::Value) -> String {
    format_value(value, 0)
}

fn format_value(value: &serde_json::Value, depth: usize) -> String {
    match value {
        serde_json::Value::Object(map) => {
            let oneliner = serde_json::to_string(value).unwrap_or_default();
            if oneliner.len() <= INLINE_THRESHOLD && !oneliner.contains('\n') {
                return oneliner;
            }
            let indent = "  ".repeat(depth + 1);
            let close_indent = "  ".repeat(depth);
            let entries: Vec<String> = map
                .iter()
                .map(|(k, v)| format!("{indent}\"{k}\": {}", format_value(v, depth + 1)))
                .collect();
            format!("{{\n{}\n{close_indent}}}", entries.join(",\n"))
        }
        serde_json::Value::Array(arr) => {
            let oneliner = serde_json::to_string(value).unwrap_or_default();
            if oneliner.len() <= INLINE_THRESHOLD {
                return oneliner;
            }
            let indent = "  ".repeat(depth + 1);
            let close_indent = "  ".repeat(depth);
            let items: Vec<String> = arr
                .iter()
                .map(|v| format!("{indent}{}", format_value(v, depth + 1)))
                .collect();
            format!("[\n{}\n{close_indent}]", items.join(",\n"))
        }
        other => serde_json::to_string(other).unwrap_or_default(),
    }
}

pub fn compact_json(text: &str) -> String {
    if text.is_empty() {
        return String::new();
    }

    let trimmed = text.trim();

    if (trimmed.starts_with('{') || trimmed.starts_with('['))
        && let Ok(value) = serde_json::from_str::<serde_json::Value>(trimmed)
    {
        let compacted = compact_value(&value);
        if compacted.len() < trimmed.len() {
            return compacted;
        }
        return text.to_string();
    }

    if let Some(start) = trimmed.find(['{', '[']) {
        let candidate = &trimmed[start..];
        if let Ok(value) = serde_json::from_str::<serde_json::Value>(candidate) {
            let compacted = compact_value(&value);
            if compacted.len() < candidate.len() {
                return format!("{}{}", &trimmed[..start], compacted);
            }
        }
    }

    text.to_string()
}
