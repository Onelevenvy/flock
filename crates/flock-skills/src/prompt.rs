use unicode_width::UnicodeWidthStr;

use crate::types::{SkillMetadata, SkillSource};

// Skill listing gets 1% of the context window (in characters)
pub const SKILL_BUDGET_CONTEXT_PERCENT: f64 = 0.01;
pub const CHARS_PER_TOKEN: usize = 4;
pub const DEFAULT_CHAR_BUDGET: usize = 8_000; // Fallback: 1% of 200k × 4
pub const MAX_LISTING_DESC_CHARS: usize = 250;

const MIN_DESC_LENGTH: usize = 20;

/// Calculate character budget from context window size.
pub fn get_char_budget(context_window_tokens: Option<usize>) -> usize {
    match context_window_tokens {
        Some(tokens) => {
            ((tokens as f64) * (CHARS_PER_TOKEN as f64) * SKILL_BUDGET_CONTEXT_PERCENT) as usize
        }
        None => DEFAULT_CHAR_BUDGET,
    }
}

/// Format a skill's combined description string (description + when_to_use),
/// truncated to MAX_LISTING_DESC_CHARS.
pub fn format_skill_description(skill: &SkillMetadata) -> String {
    let desc = match &skill.when_to_use {
        Some(wtu) if !wtu.is_empty() => format!("{} - {}", skill.description, wtu),
        _ => skill.description.clone(),
    };

    if UnicodeWidthStr::width(desc.as_str()) > MAX_LISTING_DESC_CHARS {
        let mut truncated = String::new();
        let mut width = 0usize;
        for ch in desc.chars() {
            let cw = unicode_width::UnicodeWidthChar::width(ch).unwrap_or(0);
            if width + cw >= MAX_LISTING_DESC_CHARS {
                break;
            }
            truncated.push(ch);
            width += cw;
        }
        truncated.push('\u{2026}');
        truncated
    } else {
        desc
    }
}

/// Format a single skill entry for the listing: `- name: description`.
pub fn format_skill_entry(skill: &SkillMetadata) -> String {
    format!("- {}: {}", skill.name, format_skill_description(skill))
}

/// Format all skills within budget, applying three-level degradation.
///
/// Levels:
/// 1. Full mode: all skills with full descriptions
/// 2. Truncated mode: bundled skills full, non-bundled descriptions trimmed
/// 3. Minimal mode: bundled skills full, non-bundled names only
pub fn format_skills_within_budget(
    skills: &[SkillMetadata],
    context_window_tokens: Option<usize>,
) -> String {
    if skills.is_empty() {
        return String::new();
    }

    let budget = get_char_budget(context_window_tokens);

    // Build full entries for all skills
    let full_entries: Vec<String> = skills.iter().map(format_skill_entry).collect();

    // join('\n') produces N-1 newlines for N entries
    let full_total: usize = full_entries
        .iter()
        .map(|e| UnicodeWidthStr::width(e.as_str()))
        .sum::<usize>()
        + full_entries.len().saturating_sub(1);

    // Level 1: full mode
    if full_total <= budget {
        return full_entries.join("\n");
    }

    // Partition into bundled and non-bundled
    let mut bundled_indices: Vec<usize> = Vec::new();
    let mut rest_indices: Vec<usize> = Vec::new();
    for (i, skill) in skills.iter().enumerate() {
        if skill.source == SkillSource::Bundled {
            bundled_indices.push(i);
        } else {
            rest_indices.push(i);
        }
    }

    // C-5: if no non-bundled skills, return all bundled full entries
    if rest_indices.is_empty() {
        return full_entries.join("\n");
    }

    // Compute space used by bundled skills (full descriptions, always preserved)
    // +1 per bundled entry accounts for the trailing newline separator
    let bundled_chars: usize = bundled_indices
        .iter()
        .map(|&i| UnicodeWidthStr::width(full_entries[i].as_str()) + 1)
        .sum();

    let remaining_budget = budget.saturating_sub(bundled_chars);

    // name_overhead = Σ (name.len() + 4) for each non-bundled skill
    // where 4 = "- " (2) + ": " (2) prefix/suffix
    // plus (rest_count - 1) newline separators between non-bundled entries
    let rest_name_overhead: usize = rest_indices
        .iter()
        .map(|&i| UnicodeWidthStr::width(skills[i].name.as_str()) + 4)
        .sum::<usize>()
        + rest_indices.len().saturating_sub(1);

    let available_for_descs = remaining_budget.saturating_sub(rest_name_overhead);
    let per_desc_budget = available_for_descs / rest_indices.len();

    // Level 3: minimal mode — non-bundled show names only
    if per_desc_budget < MIN_DESC_LENGTH {
        return skills
            .iter()
            .enumerate()
            .map(|(i, skill)| {
                if skill.source == SkillSource::Bundled {
                    full_entries[i].clone()
                } else {
                    format!("- {}", skill.name)
                }
            })
            .collect::<Vec<_>>()
            .join("\n");
    }

    // Level 2: truncated mode — non-bundled descriptions trimmed to per_desc_budget
    skills
        .iter()
        .enumerate()
        .map(|(i, skill)| {
            if skill.source == SkillSource::Bundled {
                return full_entries[i].clone();
            }
            let desc = format_skill_description(skill);
            let trimmed = if UnicodeWidthStr::width(desc.as_str()) > per_desc_budget {
                let mut s = String::new();
                let mut width = 0usize;
                let limit = per_desc_budget.saturating_sub(1);
                for ch in desc.chars() {
                    let cw = unicode_width::UnicodeWidthChar::width(ch).unwrap_or(0);
                    if width + cw >= limit {
                        break;
                    }
                    s.push(ch);
                    width += cw;
                }
                s.push('\u{2026}');
                s
            } else {
                desc
            };
            format!("- {}: {}", skill.name, trimmed)
        })
        .collect::<Vec<_>>()
        .join("\n")
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::{ExecutionContext, LoadChannel, SkillMetadata, SkillSource};

    fn make_skill(
        name: &str,
        description: &str,
        when_to_use: Option<&str>,
        bundled: bool,
        hidden: bool,
    ) -> SkillMetadata {
        SkillMetadata {
            name: name.to_string(),
            display_name: None,
            description: description.to_string(),
            has_user_specified_description: false,
            allowed_tools: vec![],
            argument_hint: None,
            argument_names: vec![],
            when_to_use: when_to_use.map(|s| s.to_string()),
            version: None,
            model: None,
            disable_model_invocation: hidden,
            user_invocable: true,
            execution_context: ExecutionContext::Inline,
            agent: None,
            effort: None,
            shell: None,
            paths: vec![],
            hooks_raw: None,
            source: if bundled {
                SkillSource::Bundled
            } else {
                SkillSource::User
            },
            loaded_from: if bundled {
                LoadChannel::Bundled
            } else {
                LoadChannel::Skills
            },
            content: String::new(),
            content_length: 0,
            skill_root: None,
        }
    }

    // --- get_char_budget ---

    #[test]
    fn test_get_char_budget_none_returns_default() {
        assert_eq!(get_char_budget(None), DEFAULT_CHAR_BUDGET);
    }

    #[test]
    fn test_get_char_budget_200k_tokens() {
        // 200_000 * 4 * 0.01 = 8_000
        assert_eq!(get_char_budget(Some(200_000)), 8_000);
    }

    #[test]
    fn test_get_char_budget_small_window() {
        // 100 * 4 * 0.01 = 4
        assert_eq!(get_char_budget(Some(100)), 4);
    }

    #[test]
    fn test_get_char_budget_zero_tokens() {
        assert_eq!(get_char_budget(Some(0)), 0);
    }

    #[test]
    fn test_get_char_budget_large_window() {
        // 1_000_000 * 4 * 0.01 = 40_000
        assert_eq!(get_char_budget(Some(1_000_000)), 40_000);
    }

    // --- format_skill_description ---

    #[test]
    fn test_format_skill_description_no_when_to_use() {
        let skill = make_skill("s", "A simple skill", None, false, false);
        assert_eq!(format_skill_description(&skill), "A simple skill");
    }

    #[test]
    fn test_format_skill_description_with_when_to_use() {
        let skill = make_skill("s", "Does X", Some("Use when Y"), false, false);
        assert_eq!(format_skill_description(&skill), "Does X - Use when Y");
    }

    #[test]
    fn test_format_skill_description_truncates_long_description() {
        // description is 300 ASCII chars, no when_to_use
        let desc = "a".repeat(300);
        let skill = make_skill("s", &desc, None, false, false);
        let result = format_skill_description(&skill);
        // implementation truncates by char count: result chars <= MAX_LISTING_DESC_CHARS
        assert!(
            result.chars().count() <= MAX_LISTING_DESC_CHARS,
            "result should be truncated to MAX_LISTING_DESC_CHARS chars"
        );
        assert!(
            result.ends_with('\u{2026}'),
            "truncated result should end with ellipsis"
        );
    }

    #[test]
    fn test_format_skill_description_truncates_combined_over_limit() {
        // description 200 chars + " - " + when_to_use 100 chars = 303 > 250
        let desc = "a".repeat(200);
        let wtu = "b".repeat(100);
        let skill = make_skill("s", &desc, Some(&wtu), false, false);
        let result = format_skill_description(&skill);
        assert!(
            result.ends_with('\u{2026}'),
            "should be truncated with ellipsis"
        );
    }

    #[test]
    fn test_format_skill_description_empty_description() {
        let skill = make_skill("s", "", None, false, false);
        assert_eq!(format_skill_description(&skill), "");
    }

    #[test]
    fn test_format_skill_description_empty_when_to_use_ignored() {
        // empty when_to_use string should not add " - "
        let skill = make_skill("s", "desc", Some(""), false, false);
        assert_eq!(format_skill_description(&skill), "desc");
    }

    #[test]
    fn test_format_skill_description_exactly_at_limit() {
        // description exactly 250 chars — should NOT be truncated
        let desc = "x".repeat(MAX_LISTING_DESC_CHARS);
        let skill = make_skill("s", &desc, None, false, false);
        let result = format_skill_description(&skill);
        assert_eq!(result, desc);
        assert!(!result.ends_with('\u{2026}'));
    }

    // --- format_skill_entry ---

    #[test]
    fn test_format_skill_entry_basic() {
        let skill = make_skill("my-skill", "Does things", None, false, false);
        assert_eq!(format_skill_entry(&skill), "- my-skill: Does things");
    }

    #[test]
    fn test_format_skill_entry_with_when_to_use() {
        let skill = make_skill("my-skill", "Does things", Some("When needed"), false, false);
        assert_eq!(
            format_skill_entry(&skill),
            "- my-skill: Does things - When needed"
        );
    }

    #[test]
    fn test_format_skill_entry_truncates_long_description() {
        let desc = "a".repeat(300);
        let skill = make_skill("x", &desc, None, false, false);
        let result = format_skill_entry(&skill);
        assert!(
            result.starts_with("- x: "),
            "entry should start with '- x: '"
        );
        assert!(
            result.contains('\u{2026}'),
            "long description should be truncated"
        );
    }

    #[test]
    fn test_format_skill_entry_empty_name() {
        let skill = make_skill("", "desc", None, false, false);
        assert_eq!(format_skill_entry(&skill), "- : desc");
    }

    // --- format_skills_within_budget ---

    #[test]
    fn test_format_skills_within_budget_empty_returns_empty() {
        assert_eq!(format_skills_within_budget(&[], None), "");
        assert_eq!(format_skills_within_budget(&[], Some(0)), "");
    }

    #[test]
    fn test_format_skills_within_budget_full_mode() {
        // 3 short skills well within 8_000 char default budget
        let skills = vec![
            make_skill("skill-a", "Desc A", None, false, false),
            make_skill("skill-b", "Desc B", None, false, false),
            make_skill("skill-c", "Desc C", None, false, false),
        ];
        let result = format_skills_within_budget(&skills, None);
        assert!(result.contains("- skill-a: Desc A"));
        assert!(result.contains("- skill-b: Desc B"));
        assert!(result.contains("- skill-c: Desc C"));
        assert!(
            !result.contains('\u{2026}'),
            "full mode should not truncate"
        );
    }

    #[test]
    fn test_format_skills_within_budget_full_mode_line_count() {
        let skills = vec![
            make_skill("a", "Desc A", None, false, false),
            make_skill("b", "Desc B", None, false, false),
            make_skill("c", "Desc C", None, false, false),
        ];
        let result = format_skills_within_budget(&skills, None);
        let lines: Vec<&str> = result.lines().collect();
        assert_eq!(lines.len(), 3, "each skill should be on its own line");
    }

    #[test]
    fn test_format_skills_within_budget_truncated_mode() {
        // budget = 10_000 * 4 * 0.01 = 400 chars
        // 1 bundled skill (short), 5 non-bundled each with 200-char description
        // bundled ~60 chars, remaining ~340 / 5 = 68 chars per non-bundled (>= MIN_DESC_LENGTH=20)
        let bundled = make_skill("bundled", "Bundled description here", None, true, false);
        let non_bundled: Vec<SkillMetadata> = (0..5)
            .map(|i| make_skill(&format!("nb-{i}"), &"z".repeat(200), None, false, false))
            .collect();

        let mut skills = vec![bundled];
        skills.extend(non_bundled);

        let result = format_skills_within_budget(&skills, Some(10_000));

        // bundled skill should be complete (no ellipsis in its description)
        assert!(
            result.contains("Bundled description here"),
            "bundled skill description should be intact"
        );
        // at least some non-bundled should be truncated
        assert!(
            result.contains('\u{2026}'),
            "non-bundled descriptions should be truncated in truncated mode"
        );
    }

    #[test]
    fn test_format_skills_within_budget_minimal_mode() {
        // budget = 50 * 4 * 0.01 = 2 chars — far below MIN_DESC_LENGTH=20
        // non-bundled should show names only
        let bundled = make_skill("bundled", "Bundled full desc", None, true, false);
        let nb_skills: Vec<SkillMetadata> = vec![
            make_skill("nb-alpha", &"x".repeat(100), None, false, false),
            make_skill("nb-beta", &"y".repeat(100), None, false, false),
        ];

        let mut skills = vec![bundled];
        skills.extend(nb_skills);

        let result = format_skills_within_budget(&skills, Some(50));

        // bundled still full
        assert!(
            result.contains("Bundled full desc"),
            "bundled skill should remain full in minimal mode"
        );
        // non-bundled: names only, no ': '
        assert!(
            result.contains("- nb-alpha\n") || result.ends_with("- nb-alpha"),
            "nb-alpha should appear as name only"
        );
        assert!(
            result.contains("- nb-beta\n") || result.ends_with("- nb-beta"),
            "nb-beta should appear as name only"
        );
        assert!(
            !result.contains("- nb-alpha: "),
            "non-bundled should not have description in minimal mode"
        );
    }

    #[test]
    fn test_format_skills_within_budget_single_skill_full() {
        let skill = make_skill("solo", "Solo description", None, false, false);
        let result = format_skills_within_budget(&[skill], None);
        assert!(result.contains("- solo: Solo description"));
    }

    #[test]
    fn test_format_skills_within_budget_max_desc_limit_respected() {
        // Single skill with 300-char description; default budget is large enough for full mode,
        // but format_skill_description always caps at MAX_LISTING_DESC_CHARS.
        let long_desc = "d".repeat(300);
        let skill = make_skill("big", &long_desc, None, false, false);
        let result = format_skills_within_budget(&[skill], None);
        let prefix = "- big: ";
        let desc_part = result.strip_prefix(prefix).unwrap_or(&result);
        // implementation truncates at char boundary: MAX_LISTING_DESC_CHARS - 1 chars + ellipsis = 250 chars
        assert!(
            desc_part.chars().count() <= MAX_LISTING_DESC_CHARS,
            "entry description must not exceed MAX_LISTING_DESC_CHARS chars"
        );
        assert!(desc_part.ends_with('\u{2026}'));
    }

    #[test]
    fn test_format_skills_within_budget_only_bundled_skills() {
        // All bundled: even if over budget, all are shown full (no non-bundled to degrade)
        let skills: Vec<SkillMetadata> = (0..3)
            .map(|i| {
                make_skill(
                    &format!("bundled-{i}"),
                    &format!("Desc {i}"),
                    None,
                    true,
                    false,
                )
            })
            .collect();
        let result = format_skills_within_budget(&skills, Some(1)); // tiny budget
        for i in 0..3 {
            assert!(
                result.contains(&format!("- bundled-{i}: Desc {i}")),
                "bundled skill {i} should be intact"
            );
        }
    }

    // --- CJK / multi-byte UTF-8 boundary tests ---

    #[test]
    fn test_format_skill_description_cjk_short_preserved() {
        // TC-31: short CJK description should be returned as-is
        let skill = make_skill("s", "这是一个技能描述", None, false, false);
        let result = format_skill_description(&skill);
        assert_eq!(result, "这是一个技能描述");
    }

    #[test]
    fn test_format_skill_description_cjk_long_truncated_no_panic() {
        // TC-32: 300 CJK chars must be truncated to <= 250 chars without panicking
        let desc = "技".repeat(300);
        let skill = make_skill("s", &desc, None, false, false);
        let result = format_skill_description(&skill);
        assert!(
            result.chars().count() <= MAX_LISTING_DESC_CHARS,
            "CJK description should be truncated to <= {} chars",
            MAX_LISTING_DESC_CHARS
        );
        assert!(
            result.ends_with('…'),
            "truncated CJK result should end with ellipsis"
        );
    }

    #[test]
    fn test_format_skill_description_mixed_cjk_ascii_truncated_no_panic() {
        // TC-33: mixed ASCII + CJK over 250 chars must be truncated without panicking
        let desc = format!("Skill: {}", "描述".repeat(150));
        let skill = make_skill("s", &desc, None, false, false);
        let result = format_skill_description(&skill);
        assert!(
            result.chars().count() <= MAX_LISTING_DESC_CHARS,
            "mixed CJK/ASCII description should be truncated to <= {} chars",
            MAX_LISTING_DESC_CHARS
        );
        assert!(
            result.ends_with('…'),
            "truncated mixed result should end with ellipsis"
        );
    }

    #[test]
    fn test_format_skills_within_budget_truncated_mode_cjk_no_panic() {
        // TC-34: truncated mode with CJK descriptions must not panic
        // budget = 10_000 * 4 * 0.01 = 400 chars; each CJK desc is 200 chars → triggers truncation
        let bundled = make_skill("bundled", "Bundled desc", None, true, false);
        let non_bundled: Vec<SkillMetadata> = (0..3)
            .map(|i| {
                make_skill(
                    &format!("nb-{i}"),
                    &"中文描述".repeat(50),
                    None,
                    false,
                    false,
                )
            })
            .collect();

        let mut skills = vec![bundled];
        skills.extend(non_bundled);

        // should not panic
        let result = format_skills_within_budget(&skills, Some(10_000));
        assert!(
            result.contains('…') || !result.is_empty(),
            "result should be non-empty and handle CJK without panic"
        );
        assert!(
            result.contains("bundled"),
            "bundled skill must appear in result"
        );
    }
}
