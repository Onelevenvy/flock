use crate::types::{FrontmatterData, ParsedMarkdown};

/// Parse frontmatter and body from a Markdown skill file.
///
/// Uses string search (not regex) to locate the `---` delimiters. Falls back
/// to an empty FrontmatterData when the YAML cannot be parsed after two
/// attempts (log a warning; never panic).
pub fn parse_frontmatter(input: &str) -> ParsedMarkdown {
    match extract_frontmatter_bounds(input) {
        Some((yaml_text, content)) => {
            let frontmatter = parse_yaml_with_fallback(yaml_text);
            ParsedMarkdown {
                frontmatter,
                content: content.to_owned(),
            }
        }
        None => ParsedMarkdown {
            frontmatter: FrontmatterData::default(),
            content: input.to_owned(),
        },
    }
}

/// Extract (yaml_text, body_content) from a Markdown string using string search.
///
/// Expects the file to start with `---\n` (opening fence). Finds the next
/// line that is exactly `---` as the closing fence. Handles empty frontmatter,
/// CRLF line endings, and closing fence at end-of-file.
fn extract_frontmatter_bounds(input: &str) -> Option<(&str, &str)> {
    // Opening fence must be the very first line
    let after_open = input
        .strip_prefix("---\n")
        .or_else(|| input.strip_prefix("---\r\n"))?;

    // Scan line by line for the closing fence
    let mut pos = 0;
    for line in after_open.lines() {
        let line_with_ending_len = {
            // Compute byte length including the line ending
            let raw = &after_open[pos..];
            let trimmed = line.len();
            if raw[trimmed..].starts_with("\r\n") {
                trimmed + 2
            } else if raw[trimmed..].starts_with('\n') {
                trimmed + 1
            } else {
                trimmed // last line with no newline
            }
        };

        if line == "---" {
            let yaml_text = &after_open[..pos];
            // Strip leading newline from yaml_text if present (empty frontmatter)
            let yaml_text = yaml_text.strip_suffix('\n').unwrap_or(yaml_text);
            let body_start = pos + line_with_ending_len;
            let body = if body_start <= after_open.len() {
                &after_open[body_start..]
            } else {
                ""
            };
            return Some((yaml_text, body));
        }

        pos += line_with_ending_len;
    }

    None
}

fn parse_yaml_with_fallback(yaml_text: &str) -> FrontmatterData {
    // First pass: parse as-is
    match serde_yaml::from_str::<FrontmatterData>(yaml_text) {
        Ok(data) => return data,
        Err(e) => {
            eprintln!("skills: frontmatter first-pass parse failed: {e}");
        }
    }

    // Second pass: auto-quote top-level scalar values containing YAML special chars
    let fixed = quote_problematic_values(yaml_text);
    match serde_yaml::from_str::<FrontmatterData>(&fixed) {
        Ok(data) => data,
        Err(e) => {
            eprintln!(
                "skills: frontmatter second-pass parse failed: {e}; returning empty frontmatter"
            );
            FrontmatterData::default()
        }
    }
}

/// Re-quote top-level scalar values that contain YAML special characters.
///
/// Only touches lines of the form `key: value` where:
/// - the line is not already quoted (`"` or `'` as first value char)
/// - the value contains at least one YAML special character
/// - the line has no leading whitespace (top-level only — nested structures
///   like hooks blocks are left untouched to preserve their syntax)
fn quote_problematic_values(yaml_text: &str) -> String {
    const SPECIAL_CHARS: &[char] = &[
        '{', '}', '[', ']', '*', '&', '#', '!', '|', '>', '%', '@', '`',
    ];

    let mut result = String::with_capacity(yaml_text.len() + 64);

    for line in yaml_text.lines() {
        // Only process top-level key: value lines (no leading whitespace)
        if line.starts_with(' ') || line.starts_with('\t') {
            result.push_str(line);
            result.push('\n');
            continue;
        }

        // Find the colon separator for key: value
        if let Some(colon_pos) = line.find(": ") {
            let key = &line[..colon_pos + 1]; // includes ":"
            let value = &line[colon_pos + 2..];

            // Skip if already quoted or value is empty
            if value.is_empty() || value.starts_with('"') || value.starts_with('\'') {
                result.push_str(line);
                result.push('\n');
                continue;
            }

            if value.contains(SPECIAL_CHARS) {
                // Escape any existing double quotes inside the value
                let escaped = value.replace('\\', "\\\\").replace('"', "\\\"");
                result.push_str(key);
                result.push_str(" \"");
                result.push_str(&escaped);
                result.push('"');
                result.push('\n');
                continue;
            }
        }

        result.push_str(line);
        result.push('\n');
    }

    // Remove trailing newline added by the loop to keep output consistent
    if result.ends_with('\n') && !yaml_text.ends_with('\n') {
        result.pop();
    }

    result
}
