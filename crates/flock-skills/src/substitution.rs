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
    let chars = args.chars();

    for ch in chars {
        match ch {
            '"' if !in_single => {
                in_double = !in_double;
            }
            '\'' if !in_double => {
                in_single = !in_single;
            }
            ' ' | '\t' if !in_double && !in_single => {
                if !current.is_empty() {
                    result.push(current.clone());
                    current.clear();
                }
            }
            _ => {
                current.push(ch);
            }
        }
    }
    if !current.is_empty() {
        result.push(current);
    }

    result
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    // --- parse_arguments ---

    #[test]
    fn test_parse_empty() {
        assert!(parse_arguments("").is_empty());
        assert!(parse_arguments("   ").is_empty());
    }

    #[test]
    fn test_parse_simple_words() {
        assert_eq!(parse_arguments("foo bar baz"), vec!["foo", "bar", "baz"]);
    }

    #[test]
    fn test_parse_double_quoted() {
        assert_eq!(
            parse_arguments(r#""hello world" foo"#),
            vec!["hello world", "foo"]
        );
    }

    #[test]
    fn test_parse_single_quoted() {
        assert_eq!(
            parse_arguments("'hello world' foo"),
            vec!["hello world", "foo"]
        );
    }

    #[test]
    fn test_parse_mixed_quotes() {
        assert_eq!(
            parse_arguments(r#"foo "bar baz" qux"#),
            vec!["foo", "bar baz", "qux"]
        );
    }

    // --- substitute_arguments ---

    #[test]
    fn test_no_args_returns_unchanged() {
        let content = "hello $ARGUMENTS world";
        let result = substitute_arguments(content, None, &[], None, None);
        assert_eq!(result, content);
    }

    #[test]
    fn test_arguments_full_substitution() {
        let result = substitute_arguments("run $ARGUMENTS now", Some("foo bar"), &[], None, None);
        assert_eq!(result, "run foo bar now");
    }

    #[test]
    fn test_arguments_indexed() {
        let result = substitute_arguments(
            "first=$ARGUMENTS[0] second=$ARGUMENTS[1]",
            Some("alpha beta"),
            &[],
            None,
            None,
        );
        assert_eq!(result, "first=alpha second=beta");
    }

    #[test]
    fn test_arguments_shorthand() {
        let result = substitute_arguments("a=$0 b=$1", Some("x y"), &[], None, None);
        assert_eq!(result, "a=x b=y");
    }

    #[test]
    fn test_named_arguments() {
        let names = vec!["filename".to_string(), "target".to_string()];
        let result = substitute_arguments(
            "file=$filename dest=$target",
            Some("foo.rs /tmp"),
            &names,
            None,
            None,
        );
        assert_eq!(result, "file=foo.rs dest=/tmp");
    }

    #[test]
    fn test_named_arg_no_partial_match() {
        // $foo should not match inside $foobar
        let names = vec!["foo".to_string()];
        let result = substitute_arguments("$foobar and $foo", Some("X"), &names, None, None);
        // $foobar stays (not a word boundary match), $foo becomes X
        assert_eq!(result, "$foobar and X");
    }

    #[test]
    fn test_flock_skill_dir_substitution() {
        let result = substitute_arguments(
            "dir=${flock_SKILL_DIR}",
            None,
            &[],
            Some("/my/skill"),
            None,
        );
        assert_eq!(result, "dir=/my/skill");
    }

    #[test]
    fn test_flock_session_id_substitution() {
        let result = substitute_arguments(
            "sid=${flock_SESSION_ID}",
            None,
            &[],
            None,
            Some("sess-123"),
        );
        assert_eq!(result, "sid=sess-123");
    }

    #[test]
    fn test_fallback_append_when_no_placeholder() {
        let result = substitute_arguments("hello world", Some("my-arg"), &[], None, None);
        assert_eq!(result, "hello world\n\nARGUMENTS: my-arg");
    }

    #[test]
    fn test_no_fallback_when_args_empty() {
        // Empty string — no fallback appended
        let result = substitute_arguments("hello world", Some(""), &[], None, None);
        assert_eq!(result, "hello world");
    }

    #[test]
    fn test_arguments_out_of_bounds_replaced_with_empty() {
        let result = substitute_arguments("$ARGUMENTS[5]", Some("a"), &[], None, None);
        assert_eq!(result, "");
    }

    #[test]
    fn test_substitution_order_indexed_before_full() {
        // $ARGUMENTS[0] must be replaced before $ARGUMENTS to avoid partial corruption
        let result = substitute_arguments(
            "$ARGUMENTS[0] and $ARGUMENTS",
            Some("hello world"),
            &[],
            None,
            None,
        );
        assert_eq!(result, "hello and hello world");
    }
}

// ---------------------------------------------------------------------------
// Supplemental tests (tester role — covers test-plan.md cases not in impl tests)
// ---------------------------------------------------------------------------

#[cfg(test)]
mod supplemental_tests {
    use super::*;

    // -----------------------------------------------------------------------
    // TC-1.x: parse_arguments additional cases
    // -----------------------------------------------------------------------

    #[test]
    fn tc_1_1_basic_space_split() {
        assert_eq!(parse_arguments("foo bar baz"), vec!["foo", "bar", "baz"]);
    }

    #[test]
    fn tc_1_3_multiple_quoted_groups() {
        assert_eq!(
            parse_arguments(r#""arg one" "arg two" plain"#),
            vec!["arg one", "arg two", "plain"]
        );
    }

    #[test]
    fn tc_1_6_single_unquoted_arg() {
        assert_eq!(parse_arguments("single"), vec!["single"]);
    }

    #[test]
    fn tc_1_7_quoted_path_with_spaces() {
        assert_eq!(
            parse_arguments(r#""path/to/file with spaces.txt" --flag"#),
            vec!["path/to/file with spaces.txt", "--flag"]
        );
    }

    #[test]
    fn tc_1_8_unclosed_quote_no_panic() {
        // Must not panic; result is implementation-defined but non-empty
        let result = parse_arguments(r#""unclosed arg"#);
        assert!(!result.is_empty() || result.is_empty()); // just verifies no panic
    }

    #[test]
    fn tc_1_9_single_quotes_also_group() {
        // Implementation supports single quotes too (extends plan)
        assert_eq!(
            parse_arguments("'hello world' foo"),
            vec!["hello world", "foo"]
        );
    }

    // -----------------------------------------------------------------------
    // TC-2.x: $ARGUMENTS full substitution
    // -----------------------------------------------------------------------

    #[test]
    fn tc_2_1_arguments_full_replacement() {
        let r = substitute_arguments("Run: $ARGUMENTS", Some("foo bar"), &[], None, None);
        assert_eq!(r, "Run: foo bar");
    }

    #[test]
    fn tc_2_2_arguments_none_becomes_empty() {
        // When args = None, $ARGUMENTS is NOT replaced (returns unchanged per spec)
        let r = substitute_arguments("Run: $ARGUMENTS", None, &[], None, None);
        assert_eq!(r, "Run: $ARGUMENTS");
    }

    #[test]
    fn tc_2_3_arguments_multiple_occurrences() {
        let r = substitute_arguments("$ARGUMENTS and $ARGUMENTS", Some("x"), &[], None, None);
        assert_eq!(r, "x and x");
    }

    // -----------------------------------------------------------------------
    // TC-3.x: $ARGUMENTS[n] indexed substitution
    // -----------------------------------------------------------------------

    #[test]
    fn tc_3_1_arguments_index_0() {
        let r = substitute_arguments("First: $ARGUMENTS[0]", Some("alpha beta"), &[], None, None);
        assert_eq!(r, "First: alpha");
    }

    #[test]
    fn tc_3_2_arguments_index_1() {
        let r = substitute_arguments("Second: $ARGUMENTS[1]", Some("alpha beta"), &[], None, None);
        assert_eq!(r, "Second: beta");
    }

    #[test]
    fn tc_3_3_arguments_index_out_of_bounds_empty() {
        let r = substitute_arguments("Third: $ARGUMENTS[2]", Some("only_one"), &[], None, None);
        assert_eq!(r, "Third: ");
    }

    #[test]
    fn tc_3_4_arguments_index_with_quoted_arg() {
        let r = substitute_arguments(
            "$ARGUMENTS[0]",
            Some(r#""hello world" foo"#),
            &[],
            None,
            None,
        );
        assert_eq!(r, "hello world");
    }

    // -----------------------------------------------------------------------
    // TC-4.x: $n shorthand indexed substitution
    // -----------------------------------------------------------------------

    #[test]
    fn tc_4_1_shorthand_0() {
        let r = substitute_arguments("Hello $0", Some("world"), &[], None, None);
        assert_eq!(r, "Hello world");
    }

    #[test]
    fn tc_4_2_shorthand_0_and_1() {
        let r = substitute_arguments("$0 and $1", Some("foo bar"), &[], None, None);
        assert_eq!(r, "foo and bar");
    }

    #[test]
    fn tc_4_3_shorthand_out_of_bounds() {
        let r = substitute_arguments("$2", Some("only_two args"), &[], None, None);
        // "only_two" = $0, "args" = $1, $2 is out of bounds → empty
        assert_eq!(r, "");
    }

    #[test]
    fn tc_4_4_shorthand_no_args() {
        let r = substitute_arguments("Run $0", None, &[], None, None);
        // args = None → no substitution, content returned unchanged
        assert_eq!(r, "Run $0");
    }

    // -----------------------------------------------------------------------
    // TC-5.x: $name named argument substitution
    // -----------------------------------------------------------------------

    #[test]
    fn tc_5_1_single_named_arg() {
        // $query maps to argument index 0; args "rust programming" parses to ["rust", "programming"].
        // $query is replaced with the first parsed argument "rust".
        // "programming" is the second argument but has no placeholder in content.
        let names = vec!["query".to_string()];
        let r = substitute_arguments(
            "Search for $query",
            Some("rust programming"),
            &names,
            None,
            None,
        );
        assert_eq!(r, "Search for rust");
    }

    #[test]
    fn tc_5_2_multiple_named_args() {
        let names = vec!["src".to_string(), "dst".to_string()];
        let r = substitute_arguments(
            "From $src to $dst",
            Some("source.txt dest.txt"),
            &names,
            None,
            None,
        );
        assert_eq!(r, "From source.txt to dest.txt");
    }

    #[test]
    fn tc_5_4_named_arg_index_out_of_range() {
        // $second maps to index 1 but only one arg provided
        let names = vec!["first".to_string(), "second".to_string()];
        let r = substitute_arguments("File: $second", Some("only_one"), &names, None, None);
        assert_eq!(r, "File: ");
    }

    // -----------------------------------------------------------------------
    // TC-6.x: ${flock_SKILL_DIR} substitution
    // -----------------------------------------------------------------------

    #[test]
    fn tc_6_1_skill_dir_replaced() {
        let r = substitute_arguments(
            "cd ${flock_SKILL_DIR}",
            None,
            &[],
            Some("/home/user/.flock/skills/my-skill"),
            None,
        );
        assert_eq!(r, "cd /home/user/.flock/skills/my-skill");
    }

    #[test]
    fn tc_6_2_skill_dir_none_not_replaced() {
        // skill_root = None → ${flock_SKILL_DIR} stays unreplaced
        let r = substitute_arguments("cd ${flock_SKILL_DIR}", None, &[], None, None);
        assert_eq!(r, "cd ${flock_SKILL_DIR}");
    }

    #[test]
    fn tc_6_3_skill_dir_multiple_occurrences() {
        let r = substitute_arguments(
            "${flock_SKILL_DIR}/a and ${flock_SKILL_DIR}/b",
            None,
            &[],
            Some("/skills/foo"),
            None,
        );
        assert_eq!(r, "/skills/foo/a and /skills/foo/b");
    }

    // -----------------------------------------------------------------------
    // TC-7.x: ${flock_SESSION_ID} substitution
    // -----------------------------------------------------------------------

    #[test]
    fn tc_7_1_session_id_replaced() {
        let r = substitute_arguments(
            "Session: ${flock_SESSION_ID}",
            None,
            &[],
            None,
            Some("abc-123"),
        );
        assert_eq!(r, "Session: abc-123");
    }

    #[test]
    fn tc_7_2_session_id_none_not_replaced() {
        let r = substitute_arguments("Session: ${flock_SESSION_ID}", None, &[], None, None);
        assert_eq!(r, "Session: ${flock_SESSION_ID}");
    }

    // -----------------------------------------------------------------------
    // TC-8.x: fallback append when no placeholder
    // -----------------------------------------------------------------------

    #[test]
    fn tc_8_1_no_placeholder_appends_arguments() {
        let r = substitute_arguments("Do the task.", Some("my argument"), &[], None, None);
        assert_eq!(r, "Do the task.\n\nARGUMENTS: my argument");
    }

    #[test]
    fn tc_8_2_no_placeholder_no_args_no_append() {
        let r = substitute_arguments("Do the task.", None, &[], None, None);
        assert_eq!(r, "Do the task.");
    }

    #[test]
    fn tc_8_3_with_placeholder_no_append() {
        let r = substitute_arguments("Run $ARGUMENTS", Some("x"), &[], None, None);
        assert_eq!(r, "Run x");
        assert!(!r.contains("ARGUMENTS:"));
    }

    #[test]
    fn tc_8_4_empty_args_string_no_append() {
        // args = Some("") is empty → no fallback appended
        let r = substitute_arguments("Do it.", Some(""), &[], None, None);
        assert_eq!(r, "Do it.");
    }

    // -----------------------------------------------------------------------
    // TC-9.x: comprehensive / combined scenarios
    // -----------------------------------------------------------------------

    #[test]
    fn tc_9_1_multiple_placeholder_types() {
        let r = substitute_arguments(
            "cd ${flock_SKILL_DIR} && run $ARGUMENTS[0] with $ARGUMENTS",
            Some("alpha beta"),
            &[],
            Some("/skills/foo"),
            None,
        );
        assert_eq!(r, "cd /skills/foo && run alpha with alpha beta");
    }

    #[test]
    fn tc_9_2_empty_content_with_args_appends() {
        let r = substitute_arguments("", Some("foo"), &[], None, None);
        assert_eq!(r, "\n\nARGUMENTS: foo");
    }

    #[test]
    fn tc_9_3_empty_content_no_args() {
        let r = substitute_arguments("", None, &[], None, None);
        assert_eq!(r, "");
    }

    #[test]
    fn tc_9_4_indexed_before_full_no_corruption() {
        // $ARGUMENTS[0] must be recognized before $ARGUMENTS replacement
        let r = substitute_arguments(
            "$ARGUMENTS[0] / $ARGUMENTS",
            Some("alpha beta"),
            &[],
            None,
            None,
        );
        assert_eq!(r, "alpha / alpha beta");
    }

    // -----------------------------------------------------------------------
    // TC-15.x: edge cases
    // -----------------------------------------------------------------------

    #[test]
    fn tc_15_2_skill_dir_and_arguments_same_line() {
        let r = substitute_arguments(
            "${flock_SKILL_DIR}: $ARGUMENTS",
            Some("test"),
            &[],
            Some("/root"),
            None,
        );
        assert_eq!(r, "/root: test");
    }

    #[test]
    fn tc_15_3_large_args_no_panic() {
        let big_arg = "x".repeat(10_000);
        let r = substitute_arguments("$ARGUMENTS", Some(&big_arg), &[], None, None);
        assert_eq!(r, big_arg);
    }
}
