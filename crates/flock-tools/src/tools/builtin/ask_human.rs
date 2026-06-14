use crate::adapter::LangGraphToolAdapter;
use crate::Tool;
use flock_core::ipc_interface::events::ToolCategory;
use langgraph::tool;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AskHumanField {
    pub id: String,
    pub label: String,
    #[serde(rename = "type")]
    pub field_type: String, // 'text' | 'textarea' | 'select' | 'multi-select' | 'boolean'
    pub options: Option<Vec<String>>,
    pub required: Option<bool>,
}

/// Ask the user for clarification, text input, form data, or multiple choice selections.
///
/// Use this tool when you lack critical information, need user preferences/decisions, or require
/// interactive inputs to proceed. You can specify a custom prompt and a list of fields for the user to fill out.
///
/// Supported field types in `fields`:
/// - "text": Single-line text input.
/// - "textarea": Multi-line text input.
/// - "select": Single selection from `options` (rendered as flat clickable buttons).
/// - "multi-select": Multiple selections from `options` (rendered as checkable toggle buttons).
/// - "boolean": Checkbox/Switch.
///
/// Example:
/// prompt="Please provide your contact details and preferences"
/// fields=[
///   {"id": "name", "label": "Full Name", "type": "text", "required": true},
///   {"id": "destination", "label": "Preferred Destination", "type": "select", "options": ["Paris", "Tokyo"], "required": true},
///   {"id": "dietary", "label": "Dietary Restrictions", "type": "multi-select", "options": ["Vegetarian", "Gluten-Free"]},
///   {"id": "subscribe", "label": "Subscribe to newsletter?", "type": "boolean"}
/// ]
///
/// @param prompt A description of what you need from the user (e.g. "Please enter your flight details").
/// @param fields Optional list of structured input fields/choices to present to the user.
#[tool("AskHuman")]
pub async fn ask_human(
    prompt: String,
    fields: Option<Vec<AskHumanField>>,
    call_id: Option<String>,
    msg_id: Option<String>,
) -> Result<String, String> {
    if let (Some(cid), Some(mid), Some(app_mgr)) = (call_id, msg_id, crate::get_global_approval_manager()) {
        if let Some(emitter) = crate::get_global_emitter() {
            let fields_json = fields.as_ref().map(|f| serde_json::to_value(f).unwrap_or(serde_json::Value::Null));
            let _ = emitter.emit(&flock_core::ipc_interface::events::ProtocolEvent::HumanTakeover {
                call_id: cid.clone(),
                msg_id: mid.clone(),
                message: prompt.clone(),
                remote_url: None,
                fields: fields_json,
            });
        }

        let rx = app_mgr.request_approval(&cid, &ToolCategory::Exec);
        match rx.await {
            Ok(flock_core::ipc_interface::approval::ToolApprovalResult::Approved { feedback }) => {
                let fb = feedback.unwrap_or_else(|| "Confirmed".to_string());
                return Ok(fb);
            }
            Ok(flock_core::ipc_interface::approval::ToolApprovalResult::Denied { reason }) => {
                return Err(format!("User denied the request: {}", reason));
            }
            Err(e) => {
                return Err(format!("Interactive input wait interrupted: {}", e));
            }
        }
    }

    Err("No active approval context found. Cannot request human input.".to_string())
}

pub struct AskHumanToolImpl;
impl AskHumanToolImpl {
    pub fn new() -> Box<dyn Tool> {
        Box::new(
            LangGraphToolAdapter::new(AskHuman, ToolCategory::Exec)
                .with_provider_id("builtin")
                .with_provider_name("Built-in Tools"),
        )
    }
}
