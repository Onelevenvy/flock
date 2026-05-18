use super::{OutputFormatter, OutputSink};

/// Terminal output sink - wraps the existing OutputFormatter for human-readable output
pub struct TerminalSink {
    formatter: OutputFormatter,
}

impl TerminalSink {
    pub fn new(no_color: bool) -> Self {
        Self {
            formatter: OutputFormatter::new(no_color),
        }
    }

    /// Access the underlying formatter for terminal-specific operations (repl_prompt, session_info)
    pub fn formatter(&self) -> &OutputFormatter {
        &self.formatter
    }
}

impl OutputSink for TerminalSink {
    fn emit_text_delta(&self, text: &str, _msg_id: &str) {
        self.formatter.text_delta(text);
    }

    fn emit_thinking(&self, text: &str, _msg_id: &str) {
        self.formatter.thinking(text);
    }

    fn emit_tool_call(&self, name: &str, input: &str) {
        self.formatter.tool_call(name, input);
    }

    fn emit_tool_result(&self, name: &str, is_error: bool, content: &str) {
        self.formatter.tool_result(name, is_error, content);
    }

    fn emit_stream_start(&self, _msg_id: &str) {
        // Terminal mode: no explicit stream start marker
    }

    fn emit_stream_end(
        &self,
        _msg_id: &str,
        turns: usize,
        input_tokens: u64,
        output_tokens: u64,
        cache_creation_tokens: u64,
        cache_read_tokens: u64,
    ) {
        self.formatter.turn_stats(
            turns,
            input_tokens,
            output_tokens,
            cache_creation_tokens,
            cache_read_tokens,
        );
    }

    fn emit_error(&self, msg: &str) {
        self.formatter.error(msg);
    }

    fn emit_info(&self, msg: &str) {
        self.formatter.session_info(msg);
    }
}
