use futures::future::join_all;
use regex::Regex;
use std::sync::OnceLock;

use crate::types::LoadChannel;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/// Parse and execute shell commands embedded in skill content.
///
/// Block pattern:  ```!\n<commands>\n```
/// Inline pattern: !`<command>` (preceded by start-of-line or whitespace)
///
/// All matched commands are executed in parallel.
/// MCP skills are silently skipped (content returned unchanged).
/// Command output replaces the original pattern in content.
pub async fn execute_shell_commands(
    content: &str,
    loaded_from: LoadChannel,
    cwd: &str,
) -> Result<String, ShellExecutionError> {
    if loaded_from == LoadChannel::Mcp {
        return Ok(content.to_owned());
    }

    let matches = extract_shell_matches(content);
    if matches.is_empty() {
        return Ok(content.to_owned());
    }

    // Execute all commands in parallel
    let futures: Vec<_> = matches
        .iter()
        .map(|m| execute_command(&m.command, cwd))
        .collect();
    let outputs: Vec<Result<String, ShellExecutionError>> = join_all(futures).await;

    // Pair matches with outputs; fail-fast on first error
    let mut pairs: Vec<(usize, usize, String)> = Vec::with_capacity(matches.len());
    for (m, result) in matches.iter().zip(outputs) {
        let output = result.map_err(|e| ShellExecutionError::CommandFailed {
            pattern: m.full_match.clone(),
            output: e.to_string(),
        })?;
        pairs.push((m.start, m.end, output));
    }

    // Replace from back to front to preserve byte offsets
    pairs.sort_by_key(|p| std::cmp::Reverse(p.0));

    let mut result = content.to_owned();
    for (start, end, output) in pairs {
        result.replace_range(start..end, &output);
    }

    Ok(result)
}

// ---------------------------------------------------------------------------
// Error type
// ---------------------------------------------------------------------------

/// Errors that can occur during shell command execution.
#[derive(Debug, thiserror::Error)]
pub enum ShellExecutionError {
    #[error("Shell command failed for pattern \"{pattern}\": {output}")]
    CommandFailed { pattern: String, output: String },

    #[error("Shell execution blocked for MCP skill")]
    McpBlocked,
}

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

/// A matched shell command with its byte range in the original content.
struct ShellMatch {
    /// Complete text to be replaced (full_match bytes in content[start..end])
    full_match: String,
    /// The command to execute
    command: String,
    /// Byte offset of `full_match` start in content
    start: usize,
    /// Byte offset one past the end of `full_match` in content
    end: usize,
}

// ---------------------------------------------------------------------------
// Regex helpers
// ---------------------------------------------------------------------------

/// Block regex: ```!\n<body>\n```
fn block_regex() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| Regex::new(r"(?s)```!\s*\n([\s\S]*?)\n?```").expect("invalid block regex"))
}

/// Inline regex — two patterns needed because `regex` crate has no lookbehind:
///   1. Line-start: ^!`...`   (multiline mode)
///   2. Preceded by whitespace: ([ \t])!`...`
fn inline_line_start_regex() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| Regex::new(r"(?m)^(!`([^`]+)`)").expect("invalid inline line-start regex"))
}

fn inline_whitespace_regex() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| Regex::new(r"([ \t])(!`([^`]+)`)").expect("invalid inline whitespace regex"))
}

// ---------------------------------------------------------------------------
// extract_shell_matches
// ---------------------------------------------------------------------------

/// Extract all shell command matches from content, ordered by start position.
fn extract_shell_matches(content: &str) -> Vec<ShellMatch> {
    let mut matches: Vec<ShellMatch> = Vec::new();

    // Block matches: entire ```!...``` block is replaced
    for cap in block_regex().captures_iter(content) {
        let full = cap.get(0).unwrap();
        let command = cap.get(1).map_or("", |m| m.as_str()).trim().to_owned();
        matches.push(ShellMatch {
            full_match: full.as_str().to_owned(),
            command,
            start: full.start(),
            end: full.end(),
        });
    }

    // Track byte ranges already covered by block matches to avoid overlap
    let block_ranges: Vec<(usize, usize)> = matches.iter().map(|m| (m.start, m.end)).collect();

    let overlaps_block =
        |s: usize, e: usize| -> bool { block_ranges.iter().any(|(bs, be)| s < *be && e > *bs) };

    // Inline line-start: group(1) = full !`cmd`, group(2) = cmd
    for cap in inline_line_start_regex().captures_iter(content) {
        let full = cap.get(1).unwrap();
        let command = cap.get(2).unwrap().as_str().to_owned();
        if !overlaps_block(full.start(), full.end()) {
            matches.push(ShellMatch {
                full_match: full.as_str().to_owned(),
                command,
                start: full.start(),
                end: full.end(),
            });
        }
    }

    // Inline whitespace-preceded: group(1) = leading whitespace char,
    // group(2) = full !`cmd`, group(3) = cmd
    // We replace only the !`cmd` part (group 2), keeping the leading space intact.
    for cap in inline_whitespace_regex().captures_iter(content) {
        let full_match_group = cap.get(2).unwrap();
        let command = cap.get(3).unwrap().as_str().to_owned();
        if !overlaps_block(full_match_group.start(), full_match_group.end()) {
            matches.push(ShellMatch {
                full_match: full_match_group.as_str().to_owned(),
                command,
                start: full_match_group.start(),
                end: full_match_group.end(),
            });
        }
    }

    // Sort by start ascending (will be reversed before replacement)
    matches.sort_by_key(|m| m.start);

    // Deduplicate overlapping matches (keep first by start)
    let mut deduped: Vec<ShellMatch> = Vec::new();
    let mut last_end: usize = 0;
    for m in matches {
        if m.start >= last_end {
            last_end = m.end;
            deduped.push(m);
        }
    }

    deduped
}

// ---------------------------------------------------------------------------
// execute_command
// ---------------------------------------------------------------------------

/// Execute a single shell command and return its combined stdout/stderr output.
async fn execute_command(command: &str, cwd: &str) -> Result<String, ShellExecutionError> {
    let output = flock_core::config::shell::shell_command_builder(command)
        .current_dir(cwd)
        .output()
        .await
        .map_err(|e| ShellExecutionError::CommandFailed {
            pattern: command.to_owned(),
            output: e.to_string(),
        })?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);

    if !output.status.success() && stdout.is_empty() && stderr.is_empty() {
        return Err(ShellExecutionError::CommandFailed {
            pattern: command.to_owned(),
            output: format!("exit code {}", output.status.code().unwrap_or(-1)),
        });
    }

    Ok(format_output(stdout.trim_end(), stderr.trim_end()))
}

/// Format stdout and stderr into a single string.
/// stderr is prefixed with `[stderr]\n` when non-empty.
fn format_output(stdout: &str, stderr: &str) -> String {
    match (stdout.is_empty(), stderr.is_empty()) {
        (false, false) => format!("{stdout}\n[stderr]\n{stderr}"),
        (false, true) => stdout.to_owned(),
        (true, false) => format!("[stderr]\n{stderr}"),
        (true, true) => String::new(),
    }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    // Note: these are the implementer's tests; supplemental tests below.
    use super::*;

    // Helper: run execute_shell_commands with LoadedFrom::Skills
    async fn run(content: &str) -> Result<String, ShellExecutionError> {
        let tmp = std::env::temp_dir();
        execute_shell_commands(content, LoadChannel::Skills, tmp.to_str().unwrap()).await
    }

    // -----------------------------------------------------------------------
    // format_output
    // -----------------------------------------------------------------------

    #[test]
    fn test_format_output_both() {
        let s = format_output("out", "err");
        assert_eq!(s, "out\n[stderr]\nerr");
    }

    #[test]
    fn test_format_output_stdout_only() {
        assert_eq!(format_output("out", ""), "out");
    }

    #[test]
    fn test_format_output_stderr_only() {
        assert_eq!(format_output("", "err"), "[stderr]\nerr");
    }

    #[test]
    fn test_format_output_empty() {
        assert_eq!(format_output("", ""), "");
    }

    // -----------------------------------------------------------------------
    // extract_shell_matches
    // -----------------------------------------------------------------------

    #[test]
    fn test_extract_block_match() {
        let content = "Before\n```!\necho hello\n```\nAfter";
        let matches = extract_shell_matches(content);
        assert_eq!(matches.len(), 1);
        assert_eq!(matches[0].command, "echo hello");
        assert!(matches[0].full_match.starts_with("```!"));
    }

    #[test]
    fn test_extract_inline_line_start() {
        let content = "!`pwd`";
        let matches = extract_shell_matches(content);
        assert_eq!(matches.len(), 1);
        assert_eq!(matches[0].command, "pwd");
    }

    #[test]
    fn test_extract_inline_whitespace_preceded() {
        let content = "The dir is !`pwd` and user is !`whoami`";
        let matches = extract_shell_matches(content);
        assert_eq!(matches.len(), 2);
        let cmds: Vec<&str> = matches.iter().map(|m| m.command.as_str()).collect();
        assert!(cmds.contains(&"pwd"));
        assert!(cmds.contains(&"whoami"));
    }

    #[test]
    fn test_extract_no_matches() {
        let content = "No shell commands here.";
        assert!(extract_shell_matches(content).is_empty());
    }

    #[test]
    fn test_extract_block_and_inline() {
        let content = "!`echo inline`\n```!\necho block\n```";
        let matches = extract_shell_matches(content);
        assert_eq!(matches.len(), 2);
    }

    // -----------------------------------------------------------------------
    // MCP skill blocked
    // -----------------------------------------------------------------------

    #[tokio::test]
    async fn test_mcp_skill_returns_unchanged() {
        let content = "!`pwd`";
        let tmp = std::env::temp_dir();
        let result = execute_shell_commands(content, LoadChannel::Mcp, tmp.to_str().unwrap()).await;
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), content);
    }

    // -----------------------------------------------------------------------
    // Block execution
    // -----------------------------------------------------------------------

    #[tokio::test]
    async fn test_block_execution() {
        let content = "Output:\n```!\necho hello\n```\nDone.";
        let result = run(content).await.unwrap();
        assert!(result.contains("hello"));
        assert!(!result.contains("```!"));
    }

    #[tokio::test]
    async fn test_inline_execution_line_start() {
        let content = "!`echo world`";
        let result = run(content).await.unwrap();
        assert!(result.contains("world"));
    }

    #[tokio::test]
    async fn test_inline_execution_whitespace_preceded() {
        let content = "Dir: !`echo /tmp`";
        let result = run(content).await.unwrap();
        assert!(result.contains("/tmp"));
        // Leading space preserved
        assert!(result.contains("Dir: "));
    }

    #[tokio::test]
    async fn test_no_shell_commands_unchanged() {
        let content = "No commands here.";
        let result = run(content).await.unwrap();
        assert_eq!(result, content);
    }

    #[tokio::test]
    async fn test_empty_output_replaced_with_empty_string() {
        // `cd .` exits 0 with no output on all platforms
        let content = "before !`cd .` after";
        let result = run(content).await.unwrap();
        assert_eq!(result, "before  after");
    }

    #[tokio::test]
    async fn test_multiple_inline_parallel() {
        let content = "A: !`echo aaa` B: !`echo bbb`";
        let result = run(content).await.unwrap();
        assert!(result.contains("aaa"));
        assert!(result.contains("bbb"));
    }

    #[tokio::test]
    async fn test_stderr_formatted() {
        // Write to stderr only — cross-platform redirection
        let content = if cfg!(windows) {
            "!`echo err 1>&2`"
        } else {
            "!`echo err >&2`"
        };
        let result = run(content).await.unwrap();
        assert!(result.contains("[stderr]"));
        assert!(result.contains("err"));
    }
}

// ---------------------------------------------------------------------------
// Supplemental tests (tester role — split to keep file under 800 lines)
// ---------------------------------------------------------------------------


