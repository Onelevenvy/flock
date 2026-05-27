use base64::{Engine as _, engine::general_purpose};

/// Fold base64 screenshot data markers in sandbox output to avoid flooding the context.
pub fn clean_b64_from_output(s: &str) -> String {
    let mut temp = String::new();
    let raw_start = "RAW_SCREENSHOT_B64_START";
    let raw_end = "RAW_SCREENSHOT_B64_END";
    let mut current_pos = 0;

    while let Some(start_idx) = s[current_pos..].find(raw_start) {
        let absolute_start = current_pos + start_idx;
        temp.push_str(&s[current_pos..absolute_start]);
        temp.push_str(raw_start);
        temp.push_str("\n[干净截图二进制Base64数据已自动折叠]\n");

        let rest = &s[absolute_start + raw_start.len()..];
        if let Some(end_idx) = rest.find(raw_end) {
            temp.push_str(raw_end);
            current_pos = absolute_start + raw_start.len() + end_idx + raw_end.len();
        } else {
            current_pos = s.len();
            break;
        }
    }
    if current_pos < s.len() {
        temp.push_str(&s[current_pos..]);
    }

    let start_marker = "SCREENSHOT_B64_START";
    let end_marker = "SCREENSHOT_B64_END";

    let mut result = String::new();
    let mut current_pos = 0;

    while let Some(start_idx) = temp[current_pos..].find(start_marker) {
        let absolute_start = current_pos + start_idx;
        result.push_str(&temp[current_pos..absolute_start]);
        result.push_str(start_marker);
        result.push_str("\n[截图二进制Base64数据已自动折叠]\n");

        let rest = &temp[absolute_start + start_marker.len()..];
        if let Some(end_idx) = rest.find(end_marker) {
            result.push_str(end_marker);
            current_pos = absolute_start + start_marker.len() + end_idx + end_marker.len();
        } else {
            current_pos = temp.len();
            break;
        }
    }

    if current_pos < temp.len() {
        result.push_str(&temp[current_pos..]);
    }
    result
}

/// Extract and save a screenshot from sandbox output, returning (saved_path, image_md).
pub fn extract_and_save_screenshot(
    stdout_stderr: &str,
    session_id: &str,
    name_id: &str,
    suffix: &str,
) -> (Option<std::path::PathBuf>, bool) {
    let start_marker = "SCREENSHOT_B64_START";
    let end_marker = "SCREENSHOT_B64_END";

    if let Some(start_idx) = stdout_stderr.find(start_marker) {
        if let Some(end_idx) = stdout_stderr.find(end_marker) {
            let b64_data = &stdout_stderr[start_idx + start_marker.len()..end_idx].trim();
            if let Ok(img_bytes) = general_purpose::STANDARD.decode(b64_data) {
                let base_dir = crate::get_workspace_dir()
                    .unwrap_or_else(|| std::env::current_dir().unwrap_or_default());
                let ss_dir = base_dir.join(".flock/sandbox/screenshots").join(session_id);
                let _ = std::fs::create_dir_all(&ss_dir);
                let ss_path = ss_dir.join(format!("{}{}.png", name_id, suffix));
                let _ = std::fs::write(&ss_path, &img_bytes);
                let _ = std::fs::write(
                    base_dir.join(format!(".flock/sandbox/screenshot_{}.png", session_id)),
                    &img_bytes,
                );
                return (Some(ss_path), true);
            }
        }
    }
    (None, false)
}

/// Extract page title from sandbox output lines.
pub fn extract_page_title(stdout_stderr: &str) -> String {
    for line in stdout_stderr.lines() {
        if let Some(stripped) = line.strip_prefix("TITLE: ") {
            return stripped.to_string();
        }
    }
    "未知网页".to_string()
}

/// Extract DOM tree from sandbox output and format as markdown.
pub fn extract_dom_tree(stdout_stderr: &str) -> String {
    let dom_start_marker = "DOM_TREE_START";
    let dom_end_marker = "DOM_TREE_END";
    if let Some(start_idx) = stdout_stderr.find(dom_start_marker) {
        if let Some(end_idx) = stdout_stderr.find(dom_end_marker) {
            let tree_data = &stdout_stderr[start_idx + dom_start_marker.len()..end_idx].trim();
            if !tree_data.is_empty() {
                return format!(
                    "\n\n### Interactive Elements (DOM Tree)\n```text\n{}\n```\n\
                     *Note: Use `click_id` / `fill_id` / `click_coord` with the extracted IDs or coordinates for precision.*",
                    tree_data
                );
            }
        }
    }
    String::new()
}

/// Generate markdown image reference for a screenshot.
pub fn screenshot_image_md(screenshot_path: &Option<std::path::PathBuf>) -> String {
    match screenshot_path {
        Some(path) => {
            let abs_path_str = path.to_string_lossy().to_string();
            format!("\n\n![网页截图](file:///{})", abs_path_str)
        }
        None => String::new(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_clean_b64_from_output() {
        let input = "Some warning SCREENSHOT_B64_START abcde SCREENSHOT_B64_END some trailing stuff";
        let output = clean_b64_from_output(input);
        assert!(output.contains("SCREENSHOT_B64_START"));
        assert!(output.contains("SCREENSHOT_B64_END"));
        assert!(output.contains("[截图二进制Base64数据已自动折叠]"));
        assert!(!output.contains("abcde"));
        assert!(output.contains("some trailing stuff"));
        assert!(output.contains("Some warning"));

        let input_no_end = "Some warning SCREENSHOT_B64_START abcde";
        let output_no_end = clean_b64_from_output(input_no_end);
        assert!(output_no_end.contains("SCREENSHOT_B64_START"));
        assert!(output_no_end.contains("[截图二进制Base64数据已自动折叠]"));
        assert!(!output_no_end.contains("abcde"));
    }
}
