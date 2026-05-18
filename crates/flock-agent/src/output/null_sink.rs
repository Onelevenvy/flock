use super::OutputSink;

/// Silent output sink that discards all output.
///
/// Used for sub-agents whose results are collected via `engine.run()` return
/// value and emitted by the parent as a single `tool_result` event.  This
/// prevents raw text from leaking into the parent's ipc_interface stream (JSON
/// Lines) — aligning with the Claude Code pattern where sub-agents never
/// write directly to stdout.
pub struct NullSink;

impl OutputSink for NullSink {
    fn emit_text_delta(&self, _text: &str, _msg_id: &str) {}
    fn emit_thinking(&self, _text: &str, _msg_id: &str) {}
    fn emit_tool_call(&self, _name: &str, _input: &str) {}
    fn emit_tool_result(&self, _name: &str, _is_error: bool, _content: &str) {}
    fn emit_stream_start(&self, _msg_id: &str) {}
    fn emit_stream_end(
        &self,
        _msg_id: &str,
        _turns: usize,
        _input_tokens: u64,
        _output_tokens: u64,
        _cache_creation_tokens: u64,
        _cache_read_tokens: u64,
    ) {
    }
    fn emit_error(&self, _msg: &str) {}
    fn emit_info(&self, _msg: &str) {}
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn null_sink_does_not_panic() {
        let sink = NullSink;
        sink.emit_text_delta("hello", "msg1");
        sink.emit_thinking("thought", "msg1");
        sink.emit_tool_call("Read", "{}");
        sink.emit_tool_result("Read", false, "ok");
        sink.emit_stream_start("msg1");
        sink.emit_stream_end("msg1", 1, 100, 50, 0, 0);
        sink.emit_error("err");
        sink.emit_info("info");
    }
}
