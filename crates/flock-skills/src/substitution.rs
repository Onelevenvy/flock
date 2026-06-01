use regex::Regex;

/// Substitute all argument and environment variables in skill content.
///
/// Substitution order (matches TS `substituteArguments`):
/// 1. Named arguments: `$foo`, `$bar` (mapped from `argument_names[i]` → `parsed_args[i]`)
/// 2. Indexed arguments: `$ARGUMENTS[0]`, `$ARGUMENTS[1]`
/// 3. Shorthand indexed: `$0`, `$1`, `$2`
/// 4. Full arguments: `$ARGUMENTS` → entire args string
/// 5. Skill directory: `${flock_SKILL_DIR}` → `skill_root`
/// 6. Session ID: `${flock_SESSION_ID}` → `session_id`
/// 7. Fallback: if content is unchanged and args is non-empty, append `\n\nARGUMENTS: {args}`
///
/// When `args` is `None`, the content is returned unchanged (no placeholders replaced).
pub fn substitute_arguments(
    content: &str,
    args: Option<&str>,
    argument_names: &[String],
    skill_root: Option<&str>,
    session_id: Option<&str>,
) -> String {
    // Always apply env-var substitutions regardless of args.
    let mut result = content.to_owned();

    // 5. ${flock_SKILL_DIR}
    if let Some(root) = skill_root {
        result = result.replace("${flock_SKILL_DIR}", root);
    }

    // 6. ${flock_SESSION_ID}
    if let Some(sid) = session_id {
        result = result.replace("${flock_SESSION_ID}", sid);
    }

    // If no args provided, return after env substitutions only.
    let args = match args {
        Some(a) => a,
        None => return result,
    };

    let parsed = parse_arguments(args);
    let original = result.clone();

    // 1. Named argument substitution: $name (but not $name[ or $nameWord).
    // The `regex` crate does not support lookaheads, so we use a consuming
    // pattern `\$name([^\[\w]|$)` and put the trailing non-word char back.
    for (i, name) in argument_names.iter().enumerate() {
        if name.is_empty() || name.chars().all(|c| c.is_ascii_digit()) {
            // Skip empty or purely numeric names (conflict with $0/$1 shorthand)
            continue;
        }
        let replacement = parsed.get(i).map(|s| s.as_str()).unwrap_or("").to_owned();
        // Capture trailing non-word/non-bracket char (group 1) or end-of-string.
        let pattern = format!(r"\${}([^\[\w]|$)", regex::escape(name));
        if let Ok(re) = Regex::new(&pattern) {
            result = re
                .replace_all(&result, |caps: &regex::Captures<'_>| {
                    // Restore the trailing char that was consumed by the pattern.
                    let trailing = caps.get(1).map(|m| m.as_str()).unwrap_or("");
                    format!("{replacement}{trailing}")
                })
                .into_owned();
        }
    }

    // 2. Indexed arguments: $ARGUMENTS[n]
    let indexed_re = Regex::new(r"\$ARGUMENTS\[(\d+)\]").expect("static regex");
    result = indexed_re
        .replace_all(&result, |caps: &regex::Captures<'_>| {
            let idx: usize = caps[1].parse().unwrap_or(usize::MAX);
            parsed.get(idx).map(|s| s.as_str()).unwrap_or("").to_owned()
        })
        .into_owned();

    // 3. Shorthand indexed: $n not followed by a word character.
    // Pattern: \$(\d+)([^\w]|$) — capture trailing non-word char to restore it.
    let shorthand_re = Regex::new(r"\$(\d+)([^\w]|$)").expect("static regex");
    result = shorthand_re
        .replace_all(&result, |caps: &regex::Captures<'_>| {
            let idx: usize = caps[1].parse().unwrap_or(usize::MAX);
            let trailing = caps.get(2).map(|m| m.as_str()).unwrap_or("");
            let value = parsed.get(idx).map(|s| s.as_str()).unwrap_or("");
            format!("{value}{trailing}")
        })
        .into_owned();

    // 4. Full argument string: $ARGUMENTS
    result = result.replace("$ARGUMENTS", args);

    // 7. Fallback: if nothing changed and args is non-empty, append arguments
    if result == original && !args.is_empty() {
        result.push_str(&format!("\n\nARGUMENTS: {args}"));
    }

    result
}

/// Parse an argument string into individual arguments.
///
/// Handles double-quoted and single-quoted strings so that
/// `"hello world" foo` parses as `["hello world", "foo"]`.
/// Falls back to whitespace splitting if no quoted strings are present.
pub fn parse_arguments(args: &str) -> Vec<String> {
    if args.trim().is_empty() {
        return Vec::new();
    }

    let mut result = Vec::new();
    let mut current = String::new();
    let mut in_double = false;
    let mut in_single = false;
    let mut quote_detected = false;
    let chars = args.chars();

    for ch in chars {
        match ch {
            '"' if !in_single => {
                in_double = !in_double;
                quote_detected = true;
            }
            '\'' if !in_double => {
                in_single = !in_single;
                quote_detected = true;
            }
            ' ' | '\t' if !in_double && !in_single => {
                if !current.is_empty() || quote_detected {
                    result.push(current.clone());
                    current.clear();
                    quote_detected = false;
                }
            }
            _ => {
                current.push(ch);
            }
        }
    }
    if !current.is_empty() || quote_detected {
        result.push(current);
    }

    result
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_arguments_normal() {
        let parsed = parse_arguments("hello world \"foo bar\" 'baz qux'");
        assert_eq!(parsed, vec!["hello", "world", "foo bar", "baz qux"]);
    }

    #[test]
    fn test_substitute_arguments_basic() {
        let content = "Hello $foo and $0, index is $ARGUMENTS[1]";
        let result = substitute_arguments(
            content,
            Some("arg1 arg2"),
            &["foo".to_string(), "bar".to_string()],
            None,
            None,
        );
        // $foo -> arg1
        // $0 -> arg1
        // $ARGUMENTS[1] -> arg2
        assert_eq!(result, "Hello arg1 and arg1, index is arg2");
    }

    #[test]
    fn test_parse_arguments_empty_quoted_bug() {
        // 在标准的命令行解析中，传入的空双引号 "" 或空单引号 '' 应当作为一个有效的空字符串参数 ["foo", "", "bar"]
        // 但是当前生产代码在遇到闭合双引号后如果 current 为空，则不会将其推入结果，造成参数个数少于预期。
        let parsed = parse_arguments("foo \"\" bar");
        assert_eq!(
            parsed,
            vec!["foo".to_string(), "".to_string(), "bar".to_string()],
            "发现严重漏洞：当前的 parse_arguments 实现中，空双引号 ''\"\"'' 被完全静默丢弃了！"
        );
    }
}


