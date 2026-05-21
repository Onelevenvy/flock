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
