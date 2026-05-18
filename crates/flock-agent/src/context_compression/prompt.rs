//! Compact prompt templates for LLM-based conversation summarization.
//!
//! Provides the 9-section summary prompt, response parsing, and
//! post-context_compression message construction.

/// System prompt used for the context_compression LLM call.
pub const COMPACT_SYSTEM_PROMPT: &str =
    "You are a helpful AI assistant tasked with summarizing conversations.";

/// Maximum output tokens for the context_compression LLM call.
pub const COMPACT_MAX_OUTPUT_TOKENS: u32 = 20_000;

// ── Prompt construction ─────────────────────────────────────────────────────

/// Build the 9-section context_compression prompt that asks the LLM to summarize.
pub fn build_compact_prompt() -> String {
    format!("{PREAMBLE}\n\n{BODY}\n\n{FORMAT_INSTRUCTIONS}\n\n{REMINDER}")
}

const PREAMBLE: &str = "\
CRITICAL: Respond with TEXT ONLY. Do NOT call any tools.
- Do NOT use Read, Bash, Grep, Glob, Edit, Write, or ANY other tool.
- You already have all the context you need in the conversation above.
- Tool calls will be REJECTED and will waste your only turn — you will fail the task.
- Your entire response must be plain text: an <analysis> block followed by a <summary> block.";

const BODY: &str = "\
Your task is to create a detailed summary of the conversation so far, paying close attention \
to the user's explicit requests and your previous actions. This summary should be thorough in \
capturing technical details, code patterns, and architectural decisions that would be essential \
for continuing development work.

Before providing your final summary, wrap your analysis in <analysis> tags to organize your \
thoughts and ensure completeness.

Your summary should include the following sections:

1. **Primary Request and Intent**: What has the user asked for? Include ALL explicit requests \
made during the conversation.
2. **Key Technical Concepts**: Important technical details, patterns, or architectural decisions discussed.
3. **Files and Code Sections**: All files that have been viewed or modified, with brief descriptions of changes.
4. **Errors and Fixes**: Any errors encountered and how they were resolved.
5. **Problem Solving Progress**: Current state of each problem — what's solved and what remains.
6. **All User Messages**: A summary of every non-tool user message, preserving intent and context.
7. **Pending Tasks**: Any tasks that are not yet complete.
8. **Current Work**: What was being worked on immediately before this summary.
9. **Suggested Next Step**: The single most logical next action, which MUST be directly in line \
with the most recent explicit user request. Quote the user's request verbatim to prevent drift.";

const FORMAT_INSTRUCTIONS: &str = "\
Format your response exactly as follows:

<analysis>
Your reasoning about what information is most important to preserve
</analysis>

<summary>
Your detailed, structured summary following the 9 sections above
</summary>";

const REMINDER: &str = "\
REMINDER: Do NOT call any tools. Respond with plain text only — an <analysis> block followed \
by a <summary> block. Tool calls will be rejected and you will fail the task.";

// ── Response parsing ────────────────────────────────────────────────────────

/// Parse the raw LLM response: strip `<analysis>`, extract `<summary>` content.
///
/// If no `<summary>` tags are found, returns the raw text as-is (graceful degradation).
pub fn format_compact_summary(raw: &str) -> String {
    // Step 1: remove <analysis>...</analysis>
    let without_analysis = strip_tag(raw, "analysis");

    // Step 2: extract <summary>...</summary> content
    if let Some(summary_content) = extract_tag_content(&without_analysis, "summary") {
        let trimmed = summary_content.trim();
        if trimmed.is_empty() {
            return collapse_blank_lines(&without_analysis).trim().to_string();
        }
        format!("Summary:\n{trimmed}")
    } else {
        // Graceful degradation: use the text with analysis stripped
        collapse_blank_lines(&without_analysis).trim().to_string()
    }
}

// ── Post-context_compression message content ────────────────────────────────────────────

/// Build the user message content for the post-context_compression summary.
///
/// For autocompact (`is_auto = true`), appends an instruction telling the
/// model to continue seamlessly without acknowledging the compaction.
pub fn build_summary_content(formatted_summary: &str, is_auto: bool) -> String {
    let mut content = String::from(
        "This session is being continued from a previous conversation that ran out of context. \
         The summary below covers the earlier portion of the conversation.\n\n",
    );
    content.push_str(formatted_summary);

    if is_auto {
        content.push_str(
            "\n\nContinue the conversation from where it left off without asking the user \
             any further questions. Resume directly — do not acknowledge the summary, \
             do not recap what was happening, do not preface with \"I'll continue\" or similar. \
             Pick up the last task as if the break never happened.",
        );
    }

    content
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/// Remove `<tag>...</tag>` (first occurrence) from text.
///
/// If the closing tag appears before the opening tag (reversed order),
/// the text is returned unchanged to avoid producing duplicate content.
fn strip_tag(text: &str, tag: &str) -> String {
    let open = format!("<{tag}>");
    let close = format!("</{tag}>");

    let Some(start) = text.find(&open) else {
        return text.to_string();
    };
    let Some(end) = text.find(&close) else {
        return text.to_string();
    };

    // Guard: closing tag before opening tag → no-op
    if end < start {
        return text.to_string();
    }

    let mut result = String::with_capacity(text.len());
    result.push_str(&text[..start]);
    result.push_str(&text[end + close.len()..]);
    collapse_blank_lines(&result)
}

/// Extract the content between `<tag>` and `</tag>` (first occurrence).
fn extract_tag_content<'a>(text: &'a str, tag: &str) -> Option<&'a str> {
    let open = format!("<{tag}>");
    let close = format!("</{tag}>");

    let start = text.find(&open)? + open.len();
    let end = text.find(&close)?;

    if start <= end {
        Some(&text[start..end])
    } else {
        None
    }
}

/// Collapse consecutive blank lines into a single blank line.
fn collapse_blank_lines(text: &str) -> String {
    let mut result = String::with_capacity(text.len());
    let mut prev_was_blank = false;

    for line in text.lines() {
        let is_blank = line.trim().is_empty();
        if is_blank && prev_was_blank {
            continue;
        }
        if !result.is_empty() {
            result.push('\n');
        }
        result.push_str(line);
        prev_was_blank = is_blank;
    }

    result
}

#[cfg(test)]
mod tests {
    use super::*;

    // ── build_compact_prompt ────────────────────────────────────────────

    #[test]
    fn prompt_contains_all_nine_sections() {
        let prompt = build_compact_prompt();
        for i in 1..=9 {
            assert!(prompt.contains(&format!("{i}.")), "Missing section {i}");
        }
    }

    #[test]
    fn prompt_forbids_tool_calls() {
        let prompt = build_compact_prompt();
        assert!(prompt.contains("Do NOT call any tools"));
        assert!(prompt.contains("CRITICAL"));
    }

    #[test]
    fn prompt_requires_analysis_and_summary_tags() {
        let prompt = build_compact_prompt();
        assert!(prompt.contains("<analysis>"));
        assert!(prompt.contains("<summary>"));
    }

    // ── format_compact_summary ──────────────────────────────────────────

    #[test]
    fn strips_analysis_extracts_summary() {
        let raw =
            "<analysis>thinking about things</analysis>\n<summary>the actual result</summary>";
        assert_eq!(format_compact_summary(raw), "Summary:\nthe actual result");
    }

    #[test]
    fn extracts_summary_without_analysis() {
        let raw = "<summary>result only</summary>";
        assert_eq!(format_compact_summary(raw), "Summary:\nresult only");
    }

    #[test]
    fn graceful_degradation_without_tags() {
        let raw = "plain text without any tags";
        assert_eq!(format_compact_summary(raw), "plain text without any tags");
    }

    #[test]
    fn handles_multiline_summary() {
        let raw =
            "<analysis>analysis\nwith lines</analysis>\n<summary>\nLine 1\nLine 2\n</summary>";
        let result = format_compact_summary(raw);
        assert!(result.starts_with("Summary:\n"));
        assert!(result.contains("Line 1"));
        assert!(result.contains("Line 2"));
    }

    #[test]
    fn empty_summary_tags_falls_back() {
        let raw = "<analysis>thinking</analysis>\n<summary></summary>";
        let result = format_compact_summary(raw);
        // Falls back since summary content is empty
        assert!(!result.is_empty());
    }

    // ── build_summary_content ───────────────────────────────────────────

    #[test]
    fn auto_summary_includes_continuation_instruction() {
        let content = build_summary_content("Summary:\ntest", true);
        assert!(content.contains("Continue the conversation"));
        assert!(content.contains("as if the break never happened"));
    }

    #[test]
    fn manual_summary_no_continuation_instruction() {
        let content = build_summary_content("Summary:\ntest", false);
        assert!(!content.contains("Continue the conversation"));
    }

    #[test]
    fn summary_content_includes_session_header() {
        let content = build_summary_content("Summary:\ntest", false);
        assert!(content.contains("This session is being continued"));
    }

    // ── strip_tag ───────────────────────────────────────────────────────

    #[test]
    fn strip_tag_removes_complete_tag() {
        let text = "before<foo>inside</foo>after";
        assert_eq!(strip_tag(text, "foo"), "beforeafter");
    }

    #[test]
    fn strip_tag_noop_when_tag_missing() {
        let text = "no tags here";
        assert_eq!(strip_tag(text, "foo"), "no tags here");
    }

    #[test]
    fn strip_tag_noop_when_reversed_order() {
        // Closing tag before opening tag should be treated as no-op
        let text = "before</foo>middle<foo>inside</foo>after";
        // The first </foo> is at position 6, first <foo> is at position 17
        // Since end < start, the text should be returned unchanged
        assert_eq!(strip_tag(text, "foo"), text);
    }

    // ── extract_tag_content ─────────────────────────────────────────────

    #[test]
    fn extract_existing_tag() {
        let text = "<summary>hello world</summary>";
        assert_eq!(extract_tag_content(text, "summary"), Some("hello world"));
    }

    #[test]
    fn extract_missing_tag() {
        let text = "no summary here";
        assert_eq!(extract_tag_content(text, "summary"), None);
    }

    // ── collapse_blank_lines ────────────────────────────────────────────

    #[test]
    fn collapses_multiple_blank_lines() {
        let text = "a\n\n\n\nb";
        let result = collapse_blank_lines(text);
        assert_eq!(result, "a\n\nb");
    }

    #[test]
    fn preserves_single_blank_line() {
        let text = "a\n\nb";
        assert_eq!(collapse_blank_lines(text), "a\n\nb");
    }
}
