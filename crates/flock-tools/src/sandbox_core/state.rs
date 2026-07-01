/// 向前端发送"需要人工接管"事件
pub fn emit_human_takeover(call_id: &str, msg_id: &str, message: &str, remote_url: Option<String>) {
    if let Some(emitter) = crate::get_global_emitter() {
        let _ = emitter.emit(&flock_core::ipc_interface::events::ProtocolEvent::HumanTakeover {
            call_id: call_id.to_string(),
            msg_id: msg_id.to_string(),
            message: message.to_string(),
            remote_url,
            fields: None,
        });
    }
}
