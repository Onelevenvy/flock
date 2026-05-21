use std::collections::HashMap;

use serde::Deserialize;

/// Commands sent from the client to the agent (Client -> Agent)
#[derive(Debug, Deserialize, PartialEq)]
#[serde(tag = "type")]
#[serde(rename_all = "snake_case")]
pub enum ProtocolCommand {
    Message {
        msg_id: String,
        content: String,
        #[serde(default)]
        files: Vec<String>,
    },
    Stop,
    ToolApprove {
        call_id: String,
        #[serde(default)]
        scope: ApprovalScope,
    },
    ToolDeny {
        call_id: String,
        #[serde(default)]
        reason: String,
    },
    InitHistory {
        text: String,
    },
    SetMode {
        mode: SessionMode,
    },
    SetConfig {
        #[serde(default)]
        model: Option<String>,
        #[serde(default)]
        thinking: Option<String>,
        #[serde(default)]
        thinking_budget: Option<u32>,
        #[serde(default)]
        effort: Option<String>,
        #[serde(default)]
        compaction: Option<String>,
    },
    AddMcpServer {
        name: String,
        transport: String,
        #[serde(default)]
        command: Option<String>,
        #[serde(default)]
        args: Option<Vec<String>>,
        #[serde(default)]
        env: Option<HashMap<String, String>>,
        #[serde(default)]
        url: Option<String>,
        #[serde(default)]
        headers: Option<HashMap<String, String>>,
    },
    Ping,
}

#[derive(Debug, Deserialize, Default, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ApprovalScope {
    #[default]
    Once,
    Always,
}

#[derive(Debug, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum SessionMode {
    Default,
    AutoEdit,
    Yolo,
}
