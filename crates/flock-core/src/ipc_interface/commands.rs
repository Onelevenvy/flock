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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn set_config_debug_format() {
        let cmd = ProtocolCommand::SetConfig {
            model: Some("test-model".into()),
            thinking: None,
            thinking_budget: None,
            effort: None,
            compaction: None,
        };
        let dbg = format!("{cmd:?}");
        assert!(dbg.contains("SetConfig"));
        assert!(dbg.contains("test-model"));
    }

    #[test]
    fn set_config_equality() {
        let a = ProtocolCommand::SetConfig {
            model: Some("m".into()),
            thinking: None,
            thinking_budget: None,
            effort: None,
            compaction: None,
        };
        let b = ProtocolCommand::SetConfig {
            model: Some("m".into()),
            thinking: None,
            thinking_budget: None,
            effort: None,
            compaction: None,
        };
        assert_eq!(a, b);

        let c = ProtocolCommand::SetConfig {
            model: None,
            thinking: None,
            thinking_budget: None,
            effort: None,
            compaction: None,
        };
        assert_ne!(a, c);
    }

    #[test]
    fn set_config_with_all_fields_equality() {
        let a = ProtocolCommand::SetConfig {
            model: Some("m".into()),
            thinking: Some("enabled".into()),
            thinking_budget: Some(8000),
            effort: Some("high".into()),
            compaction: None,
        };
        let b = ProtocolCommand::SetConfig {
            model: Some("m".into()),
            thinking: Some("enabled".into()),
            thinking_budget: Some(8000),
            effort: Some("high".into()),
            compaction: None,
        };
        assert_eq!(a, b);
    }

    #[test]
    fn set_config_all_none_fields() {
        let cmd = ProtocolCommand::SetConfig {
            model: None,
            thinking: None,
            thinking_budget: None,
            effort: None,
            compaction: None,
        };
        let dbg = format!("{cmd:?}");
        assert!(dbg.contains("SetConfig"));
    }

    #[test]
    fn set_config_with_compaction() {
        let json = r#"{"type":"set_config","compaction":"full"}"#;
        let cmd: ProtocolCommand = serde_json::from_str(json).unwrap();
        match cmd {
            ProtocolCommand::SetConfig { compaction, .. } => {
                assert_eq!(compaction.unwrap(), "full");
            }
            _ => panic!("expected SetConfig"),
        }
    }

    #[test]
    fn set_config_compaction_none_by_default() {
        let json = r#"{"type":"set_config","model":"test"}"#;
        let cmd: ProtocolCommand = serde_json::from_str(json).unwrap();
        match cmd {
            ProtocolCommand::SetConfig { compaction, .. } => {
                assert!(compaction.is_none());
            }
            _ => panic!("expected SetConfig"),
        }
    }

    #[test]
    fn add_mcp_server_stdio_deserialize() {
        let json = r#"{
            "type": "add_mcp_server",
            "name": "team-tools",
            "transport": "stdio",
            "command": "node",
            "args": ["bridge.js", "--port", "9000"],
            "env": {"TOKEN": "abc123"}
        }"#;
        let cmd: ProtocolCommand = serde_json::from_str(json).unwrap();
        match cmd {
            ProtocolCommand::AddMcpServer {
                name,
                transport,
                command,
                args,
                env,
                url,
                headers,
            } => {
                assert_eq!(name, "team-tools");
                assert_eq!(transport, "stdio");
                assert_eq!(command.unwrap(), "node");
                assert_eq!(args.unwrap(), vec!["bridge.js", "--port", "9000"]);
                assert_eq!(env.unwrap().get("TOKEN").unwrap(), "abc123");
                assert!(url.is_none());
                assert!(headers.is_none());
            }
            _ => panic!("expected AddMcpServer"),
        }
    }

    #[test]
    fn ping_deserialize() {
        let json = r#"{"type":"ping"}"#;
        let cmd: ProtocolCommand = serde_json::from_str(json).unwrap();
        assert_eq!(cmd, ProtocolCommand::Ping);
    }

    #[test]
    fn add_mcp_server_sse_deserialize() {
        let json = r#"{
            "type": "add_mcp_server",
            "name": "remote-tools",
            "transport": "sse",
            "url": "http://localhost:8080/sse",
            "headers": {"Authorization": "Bearer tok"}
        }"#;
        let cmd: ProtocolCommand = serde_json::from_str(json).unwrap();
        match cmd {
            ProtocolCommand::AddMcpServer {
                name,
                transport,
                command,
                url,
                headers,
                ..
            } => {
                assert_eq!(name, "remote-tools");
                assert_eq!(transport, "sse");
                assert!(command.is_none());
                assert_eq!(url.unwrap(), "http://localhost:8080/sse");
                assert_eq!(headers.unwrap().get("Authorization").unwrap(), "Bearer tok");
            }
            _ => panic!("expected AddMcpServer"),
        }
    }
}
