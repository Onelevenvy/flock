use crate::types::{
    BoolOrString, EffortLevel, ExecutionContext, FrontmatterData, LoadChannel,
    SkillMetadata, SkillSource, StringOrNumber, StringOrVec,
};

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

fn yaml_value_to_json(v: &serde_yaml::Value) -> Option<serde_json::Value> {
    // Round-trip through JSON string to convert between the two Value types
    let json_str = serde_json::to_string(v).ok()?;
    serde_json::from_str(&json_str).ok()
}

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
