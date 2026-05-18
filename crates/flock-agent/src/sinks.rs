pub mod null_sink;
pub mod protocol_sink;
pub mod terminal;

use crossterm::execute;
use crossterm::style::{Attribute, Color, Print, ResetColor, SetAttribute, SetForegroundColor};
use std::io::{self, Write};

/// Abstraction over output channels (terminal vs JSON stream ipc_interface)
pub trait OutputSink: Send + Sync {
    /// Stream text delta from LLM
    fn emit_text_delta(&self, text: &str, msg_id: &str);
    /// Stream thinking content from LLM
    fn emit_thinking(&self, text: &str, msg_id: &str);
    /// Announce a tool call
    fn emit_tool_call(&self, name: &str, input: &str);
    /// Display tool result
    fn emit_tool_result(&self, name: &str, is_error: bool, content: &str);
    /// Signal start of a new message stream
    fn emit_stream_start(&self, msg_id: &str);
    /// Signal end of a message stream with usage stats
    fn emit_stream_end(
        &self,
        msg_id: &str,
        turns: usize,
        input_tokens: u64,
        output_tokens: u64,
        cache_creation_tokens: u64,
        cache_read_tokens: u64,
    );
    /// Display error
    fn emit_error(&self, msg: &str);
    /// Display informational message
    fn emit_info(&self, msg: &str);
}

pub struct OutputFormatter {
    color_enabled: bool,
}

impl OutputFormatter {
    pub fn new(no_color: bool) -> Self {
        // Also check NO_COLOR env var (standard: https://no-color.org/)
        let color_enabled = !no_color
            && std::env::var("NO_COLOR").is_err()
            && is_terminal::is_terminal(io::stderr());
        Self { color_enabled }
    }

    /// Print LLM text delta (streaming, no newline)
    pub fn text_delta(&self, text: &str) {
        print!("{}", text);
        let _ = io::stdout().flush();
    }

    /// Print tool call announcement
    pub fn tool_call(&self, name: &str, input: &str) {
        if self.color_enabled {
            let mut stderr = io::stderr();
            let _ = execute!(
                stderr,
                SetForegroundColor(Color::Cyan),
                SetAttribute(Attribute::Bold),
                Print(format!("\n[tool] {}", name)),
                ResetColor,
                SetForegroundColor(Color::DarkGrey),
                Print(format!("({})\n", truncate_display(input, 200))),
                ResetColor,
            );
        } else {
            eprintln!("\n[tool] {}({})", name, truncate_display(input, 200));
        }
    }

    /// Print tool result
    pub fn tool_result(&self, name: &str, is_error: bool, content: &str) {
        if self.color_enabled {
            let color = if is_error { Color::Red } else { Color::Green };
            let attr = if is_error {
                Attribute::Bold
            } else {
                Attribute::Dim
            };
            let mut stderr = io::stderr();
            let _ = execute!(
                stderr,
                SetForegroundColor(color),
                SetAttribute(attr),
                Print(format!("[{}] {}\n", name, truncate_display(content, 500))),
                ResetColor,
            );
        } else {
            let prefix = if is_error { "ERROR" } else { "OK" };
            eprintln!("[{} {}] {}", name, prefix, truncate_display(content, 500));
        }
    }

    /// Print thinking content
    pub fn thinking(&self, text: &str) {
        if self.color_enabled {
            let mut stderr = io::stderr();
            let _ = execute!(
                stderr,
                SetForegroundColor(Color::DarkGrey),
                SetAttribute(Attribute::Italic),
                Print(text),
                ResetColor,
            );
        }
        // Silent in no-color mode (thinking is optional display)
    }

    /// Print turn summary stats
    pub fn turn_stats(
        &self,
        turns: usize,
        input_tokens: u64,
        output_tokens: u64,
        cache_creation_tokens: u64,
        cache_read_tokens: u64,
    ) {
        let cache_info = if cache_creation_tokens > 0 || cache_read_tokens > 0 {
            format!(
                " | cache: {} created, {} read",
                cache_creation_tokens, cache_read_tokens
            )
        } else {
            String::new()
        };

        let cached_suffix = if cache_read_tokens > 0 {
            format!(" ({} cached)", cache_read_tokens)
        } else {
            String::new()
        };

        if self.color_enabled {
            let mut stderr = io::stderr();
            let _ = execute!(
                stderr,
                SetForegroundColor(Color::Yellow),
                SetAttribute(Attribute::Dim),
                Print(format!(
                    "\n[turns: {} | tokens: {} in{} / {} out{}]\n",
                    turns, input_tokens, cached_suffix, output_tokens, cache_info
                )),
                ResetColor,
            );
        } else {
            eprintln!(
                "\n[turns: {} | tokens: {} in{} / {} out{}]",
                turns, input_tokens, cached_suffix, output_tokens, cache_info
            );
        }
    }

    /// Print REPL prompt
    pub fn repl_prompt(&self) {
        if self.color_enabled {
            let mut stdout = io::stdout();
            let _ = execute!(
                stdout,
                SetForegroundColor(Color::Green),
                SetAttribute(Attribute::Bold),
                Print("\n> "),
                ResetColor,
            );
            let _ = stdout.flush();
        } else {
            print!("\n> ");
            let _ = io::stdout().flush();
        }
    }

    /// Print error
    pub fn error(&self, msg: &str) {
        if self.color_enabled {
            let mut stderr = io::stderr();
            let _ = execute!(
                stderr,
                SetForegroundColor(Color::Red),
                Print(format!("[error] {}\n", msg)),
                ResetColor,
            );
        } else {
            eprintln!("[error] {}", msg);
        }
    }

    /// Print session info
    pub fn session_info(&self, msg: &str) {
        if self.color_enabled {
            let mut stderr = io::stderr();
            let _ = execute!(
                stderr,
                SetForegroundColor(Color::Blue),
                SetAttribute(Attribute::Dim),
                Print(format!("{}\n", msg)),
                ResetColor,
            );
        } else {
            eprintln!("{}", msg);
        }
    }
}

fn truncate_display(s: &str, max: usize) -> String {
    if s.len() <= max {
        s.to_string()
    } else {
        // Find a char boundary to avoid panicking on multi-byte characters
        let end = s.char_indices().nth(max).map(|(i, _)| i).unwrap_or(s.len());
        format!("{}...", &s[..end])
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_formatter_no_color_mode() {
        // Verify construction with no_color=true does not panic
        let _formatter = OutputFormatter::new(true);
    }

    #[test]
    fn test_text_truncation_short_string_unchanged() {
        let result = truncate_display("hello", 10);
        assert_eq!(result, "hello");
    }

    #[test]
    fn test_text_truncation_exact_length_unchanged() {
        let result = truncate_display("helloworld", 10);
        assert_eq!(result, "helloworld");
    }

    #[test]
    fn test_text_truncation_long_string_truncated() {
        let result = truncate_display("hello world this is long", 10);
        assert_eq!(result, "hello worl...");
    }

    #[test]
    fn test_text_truncation_empty_string() {
        let result = truncate_display("", 10);
        assert_eq!(result, "");
    }

    #[test]
    fn test_turn_stats_no_panic() {
        let formatter = OutputFormatter::new(true);
        // Verify turn_stats does not panic with various inputs
        formatter.turn_stats(1, 100, 50, 0, 0);
        formatter.turn_stats(5, 1000, 500, 200, 300);
        formatter.turn_stats(0, 0, 0, 0, 0);
    }

    #[test]
    fn test_text_truncation_cjk_does_not_panic() {
        // Each CJK char is 3 bytes; byte-based slicing at max=200 would land
        // mid-character and panic without the char_indices fix.
        let cjk: String = "你好世界测试".chars().cycle().take(200).collect();
        let result = truncate_display(&cjk, 50);
        assert!(result.ends_with("..."));
    }

    #[test]
    fn test_text_truncation_mixed_cjk_ascii_does_not_panic() {
        let mixed = "abc你好def世界ghi测试".repeat(20);
        let result = truncate_display(&mixed, 30);
        assert!(result.ends_with("..."));
    }
}
