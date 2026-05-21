use super::types::{
    BoolOrString, EffortLevel, ExecutionContext, FrontmatterData, LoadChannel, ParsedMarkdown,
    SkillMetadata, SkillSource, StringOrNumber, StringOrVec,
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

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

/// Normalize a FrontmatterData into a SkillMetadata.
pub fn parse_skill_fields(
    frontmatter: &FrontmatterData,
    content: &str,
    resolved_name: &str,
    source: SkillSource,
    loaded_from: LoadChannel,
    skill_root: Option<&str>,
) -> SkillMetadata {
    let description_from_frontmatter = coerce_description(&frontmatter.description);
    let has_user_specified_description = description_from_frontmatter.is_some();

    let description = description_from_frontmatter
        .or_else(|| extract_description_from_content(content))
        .unwrap_or_default();

    let user_invocable = parse_bool(&frontmatter.user_invocable, true);
    let disable_model_invocation = parse_bool(&frontmatter.hide_from_model_invocation, false);

    let execution_context = match frontmatter.context.as_deref() {
        Some("fork") => ExecutionContext::Fork,
        _ => ExecutionContext::Inline,
    };

    // "inherit" means "don't override the caller's model choice"
    let model = frontmatter
        .model
        .as_deref()
        .filter(|m| *m != "inherit")
        .map(str::to_owned);

    let allowed_tools = parse_string_or_vec(&frontmatter.allowed_tools);
    let argument_names = parse_string_or_vec(&frontmatter.arguments);
    let paths = split_paths(&frontmatter.paths);
    let effort = parse_effort(&frontmatter.effort);

    let hooks_raw = frontmatter.hooks.as_ref().and_then(yaml_value_to_json);

    let content_length = content.len();

    SkillMetadata {
        name: resolved_name.to_owned(),
        display_name: frontmatter.name.clone(),
        description,
        has_user_specified_description,
        allowed_tools,
        argument_hint: frontmatter.argument_hint.clone(),
        argument_names,
        when_to_use: frontmatter.when_to_use.clone(),
        version: frontmatter.version.clone(),
        model,
        disable_model_invocation,
        user_invocable,
        execution_context,
        agent: frontmatter.agent.clone(),
        effort,
        shell: frontmatter.shell.clone(),
        paths,
        hooks_raw,
        source,
        loaded_from,
        content: content.to_owned(),
        content_length,
        skill_root: skill_root.map(str::to_owned),
    }
}

// ---------------------------------------------------------------------------
// Frontmatter extraction
// ---------------------------------------------------------------------------

/// Extract (yaml_text, body_content) from a Markdown string using string search.
///
/// Expects the file to start with `---\n` (opening fence). Finds the next
/// line that is exactly `---` as the closing fence. Handles empty frontmatter,
/// CRLF line endings, and closing fence at end-of-file.
fn extract_frontmatter_bounds(input: &str) -> Option<(&str, &str)> {
    // Normalise CRLF → LF for consistent processing
    // We work on the original bytes but accept both endings at fence lines.

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

// ---------------------------------------------------------------------------
// Two-pass YAML parsing
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// quote_problematic_values
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Helper: serde_yaml::Value → serde_json::Value
// ---------------------------------------------------------------------------

fn yaml_value_to_json(v: &serde_yaml::Value) -> Option<serde_json::Value> {
    // Round-trip through JSON string to convert between the two Value types
    let json_str = serde_json::to_string(v).ok()?;
    serde_json::from_str(&json_str).ok()
}

// ---------------------------------------------------------------------------
// Field parsing helpers
// ---------------------------------------------------------------------------

/// Parse StringOrVec to Vec<String>, splitting comma-separated single strings.
fn parse_string_or_vec(value: &Option<StringOrVec>) -> Vec<String> {
    match value {
        None => vec![],
        Some(StringOrVec::Multiple(v)) => v.clone(),
        Some(StringOrVec::Single(s)) => s
            .split(',')
            .map(str::trim)
            .filter(|s| !s.is_empty())
            .map(str::to_owned)
            .collect(),
    }
}

/// Parse the `paths` field: comma-split (respecting braces) then brace-expand each element.
fn split_paths(value: &Option<StringOrVec>) -> Vec<String> {
    match value {
        None => vec![],
        Some(StringOrVec::Multiple(v)) => v.iter().flat_map(|p| expand_braces(p)).collect(),
        Some(StringOrVec::Single(s)) => {
            // Split on commas that are NOT inside {} braces, then brace-expand each part
            split_respecting_braces(s)
                .into_iter()
                .flat_map(|p| expand_braces(&p))
                .collect()
        }
    }
}

/// Split a string on top-level commas (commas not inside `{...}` groups).
fn split_respecting_braces(s: &str) -> Vec<String> {
    let mut parts = Vec::new();
    let mut current = String::new();
    let mut depth: usize = 0;

    for ch in s.chars() {
        match ch {
            '{' => {
                depth += 1;
                current.push(ch);
            }
            '}' => {
                depth = depth.saturating_sub(1);
                current.push(ch);
            }
            ',' if depth == 0 => {
                let trimmed = current.trim().to_owned();
                if !trimmed.is_empty() {
                    parts.push(trimmed);
                }
                current.clear();
            }
            _ => current.push(ch),
        }
    }

    let trimmed = current.trim().to_owned();
    if !trimmed.is_empty() {
        parts.push(trimmed);
    }

    parts
}

/// Expand a single brace pattern into all combinations.
///
/// Examples:
/// - `"*.{ts,tsx}"` → `["*.ts", "*.tsx"]`
/// - `"{a,b}/{c,d}"` → `["a/c", "a/d", "b/c", "b/d"]`
/// - No braces → returns the original pattern unchanged.
fn expand_braces(pattern: &str) -> Vec<String> {
    // Find the first `{` that has a matching `}`
    if let Some(open) = pattern.find('{')
        && let Some(close_rel) = pattern[open..].find('}')
    {
        let close = open + close_rel;
        let prefix = &pattern[..open];
        let suffix = &pattern[close + 1..];
        let alternatives = &pattern[open + 1..close];

        let mut results = Vec::new();
        for alt in alternatives.split(',') {
            let expanded = format!("{}{}{}", prefix, alt, suffix);
            // Recursively expand in case there are more brace groups
            results.extend(expand_braces(&expanded));
        }
        return results;
    }
    vec![pattern.to_owned()]
}

/// Parse BoolOrString to bool.
fn parse_bool(value: &Option<BoolOrString>, default: bool) -> bool {
    match value {
        None => default,
        Some(BoolOrString::Bool(b)) => *b,
        Some(BoolOrString::Str(s)) => s.eq_ignore_ascii_case("true"),
    }
}

/// Parse the effort field to an EffortLevel.
fn parse_effort(value: &Option<StringOrNumber>) -> Option<EffortLevel> {
    match value {
        None => None,
        Some(StringOrNumber::Num(n)) => match n {
            0 => Some(EffortLevel::Low),
            1 => Some(EffortLevel::Medium),
            2 => Some(EffortLevel::High),
            _ => Some(EffortLevel::Max),
        },
        Some(StringOrNumber::Str(s)) => match s.to_lowercase().as_str() {
            "low" => Some(EffortLevel::Low),
            "medium" | "normal" => Some(EffortLevel::Medium),
            "high" => Some(EffortLevel::High),
            "max" | "maximum" => Some(EffortLevel::Max),
            _ => None,
        },
    }
}

/// Extract the first non-empty, non-heading line from body content as a
/// fallback description.
fn extract_description_from_content(content: &str) -> Option<String> {
    content
        .lines()
        .map(str::trim)
        .find(|line| !line.is_empty() && !line.starts_with('#'))
        .map(str::to_owned)
}

/// Normalise description: strip surrounding whitespace, return None if empty.
fn coerce_description(value: &Option<String>) -> Option<String> {
    value
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(str::to_owned)
}

