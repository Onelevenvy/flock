use serde::{Deserialize, Serialize};
use serde_json::Value;

/// JSON-RPC 2.0 request
#[derive(Debug, Serialize)]
pub struct JsonRpcRequest {
    pub jsonrpc: &'static str,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub id: Option<u64>,
    pub method: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub params: Option<Value>,
}

impl JsonRpcRequest {
    pub fn new(id: u64, method: &str, params: Option<Value>) -> Self {
        Self {
            jsonrpc: "2.0",
            id: Some(id),
            method: method.to_string(),
            params,
        }
    }

    pub fn notification(method: &str, params: Option<Value>) -> Self {
        Self {
            jsonrpc: "2.0",
            id: None,
            method: method.to_string(),
            params,
        }
    }
}

/// JSON-RPC 2.0 response
#[derive(Debug, Deserialize)]
pub struct JsonRpcResponse {
    #[allow(dead_code)]
    pub jsonrpc: String,
    pub id: Option<u64>,
    pub result: Option<Value>,
    pub error: Option<JsonRpcError>,
}

#[derive(Debug, Deserialize)]
pub struct JsonRpcError {
    pub code: i64,
    pub message: String,
    #[allow(dead_code)]
    pub data: Option<Value>,
}

/// MCP tool definition returned by tools/list
#[derive(Debug, Clone, Deserialize)]
pub struct McpToolDef {
    pub name: String,
    pub description: Option<String>,
    #[serde(rename = "inputSchema")]
    pub input_schema: Value,
}

/// MCP tool call result
#[derive(Debug, Deserialize)]
pub struct McpToolResult {
    pub content: Vec<McpContent>,
}

/// Content types returned by MCP tool calls
#[derive(Debug, Deserialize)]
#[serde(tag = "type")]
pub enum McpContent {
    #[serde(rename = "text")]
    Text { text: String },
    #[serde(rename = "image")]
    Image {
        data: String,
        #[serde(rename = "mimeType")]
        mime_type: String,
    },
    #[serde(rename = "resource")]
    Resource {
        #[allow(dead_code)]
        resource: Value,
    },
}

/// Initialize request params
#[derive(Debug, Serialize)]
pub struct InitializeParams {
    #[serde(rename = "protocolVersion")]
    pub protocol_version: String,
    pub capabilities: ClientCapabilities,
    #[serde(rename = "clientInfo")]
    pub client_info: ClientInfo,
}

#[derive(Debug, Serialize)]
pub struct ClientCapabilities {
    pub tools: Option<Value>,
}

#[derive(Debug, Serialize)]
pub struct ClientInfo {
    pub name: String,
    pub version: String,
}

/// Initialize response result
#[derive(Debug, Deserialize)]
pub struct InitializeResult {
    #[serde(rename = "protocolVersion")]
    #[allow(dead_code)]
    pub protocol_version: String,
    #[allow(dead_code)]
    pub capabilities: Value,
    #[serde(rename = "serverInfo")]
    #[allow(dead_code)]
    pub server_info: Option<Value>,
}

/// Tools list response
#[derive(Debug, Deserialize)]
pub struct ToolsListResult {
    pub tools: Vec<McpToolDef>,
}

/// MCP resource definition returned by resources/list
#[derive(Debug, Clone, Deserialize)]
pub struct McpResource {
    pub uri: String,
    pub name: Option<String>,
    pub description: Option<String>,
    #[serde(rename = "mimeType", default)]
    pub mime_type: Option<String>,
}

/// resources/list response
#[derive(Debug, Deserialize)]
pub struct ResourcesListResult {
    pub resources: Vec<McpResource>,
}

/// resources/read response
#[derive(Debug, Deserialize)]
pub struct ResourcesReadResult {
    pub contents: Vec<ResourceContent>,
}

/// Content of a single resource from resources/read
#[derive(Debug, Deserialize)]
pub struct ResourceContent {
    #[allow(dead_code)]
    pub uri: String,
    #[serde(rename = "mimeType", default)]
    pub mime_type: Option<String>,
    /// Text content — None for blob resources (binary); skill resources are always text
    #[serde(default)]
    pub text: Option<String>,
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn test_jsonrpc_request_serialization() {
        // Verify that a regular request serializes with jsonrpc, id, method and params
        let req = JsonRpcRequest::new(1, "tools/list", Some(json!({"cursor": null})));
        let value = serde_json::to_value(&req).unwrap();

        assert_eq!(value["jsonrpc"], "2.0");
        assert_eq!(value["id"], 1u64);
        assert_eq!(value["method"], "tools/list");
        assert!(value.get("params").is_some());
    }

    #[test]
    fn test_jsonrpc_request_notification() {
        // Notifications must not include the "id" field when serialized
        let req = JsonRpcRequest::notification("notifications/initialized", None);
        let value = serde_json::to_value(&req).unwrap();

        assert_eq!(value["jsonrpc"], "2.0");
        assert_eq!(value["method"], "notifications/initialized");
        // id should be absent because it is None and marked skip_serializing_if
        assert!(value.get("id").is_none() || value["id"].is_null());
        // When skip_serializing_if fires the key is absent entirely
        assert!(!value.as_object().unwrap().contains_key("id"));
    }

    #[test]
    fn test_jsonrpc_response_deserialization_success() {
        // Deserialize a successful JSON-RPC response and check result field
        let json_str = r#"{"jsonrpc":"2.0","id":1,"result":{"tools":[]}}"#;
        let resp: JsonRpcResponse = serde_json::from_str(json_str).unwrap();

        assert_eq!(resp.id, Some(1));
        assert!(resp.result.is_some());
        assert!(resp.error.is_none());
    }

    #[test]
    fn test_jsonrpc_response_deserialization_error() {
        // Deserialize an error JSON-RPC response and check error fields
        let json_str =
            r#"{"jsonrpc":"2.0","id":2,"error":{"code":-32601,"message":"Method not found"}}"#;
        let resp: JsonRpcResponse = serde_json::from_str(json_str).unwrap();

        assert_eq!(resp.id, Some(2));
        assert!(resp.result.is_none());
        let err = resp.error.expect("error field should be present");
        assert_eq!(err.code, -32601);
        assert_eq!(err.message, "Method not found");
    }

    #[test]
    fn test_mcp_tool_def_deserialization() {
        // Deserialize a McpToolDef including the camelCase inputSchema rename
        let json_str = r#"{
            "name": "read_file",
            "description": "Read a file from disk",
            "inputSchema": {"type": "object", "properties": {}}
        }"#;
        let tool: McpToolDef = serde_json::from_str(json_str).unwrap();

        assert_eq!(tool.name, "read_file");
        assert_eq!(tool.description.as_deref(), Some("Read a file from disk"));
        assert_eq!(tool.input_schema["type"], "object");
    }

    #[test]
    fn test_mcp_content_text() {
        // Deserialize McpContent::Text using the internally-tagged "type" field
        let json_str = r#"{"type":"text","text":"hello world"}"#;
        let content: McpContent = serde_json::from_str(json_str).unwrap();

        match content {
            McpContent::Text { text } => assert_eq!(text, "hello world"),
            other => panic!("expected McpContent::Text, got {:?}", other),
        }
    }

    #[test]
    fn test_mcp_content_image() {
        // Deserialize McpContent::Image including the camelCase mimeType rename
        let json_str = r#"{"type":"image","data":"base64data==","mimeType":"image/png"}"#;
        let content: McpContent = serde_json::from_str(json_str).unwrap();

        match content {
            McpContent::Image { data, mime_type } => {
                assert_eq!(data, "base64data==");
                assert_eq!(mime_type, "image/png");
            }
            other => panic!("expected McpContent::Image, got {:?}", other),
        }
    }

    // -----------------------------------------------------------------------
    // TC-1.x: McpResource deserialization [黑盒]
    // -----------------------------------------------------------------------

    #[test]
    fn tc_1_1_mcp_resource_all_fields() {
        // [黑盒] TC-1.1: McpResource complete deserialization with all optional fields
        let json_str = r#"{
            "uri": "skill://my-skill",
            "name": "My Skill",
            "description": "A test skill",
            "mimeType": "text/plain"
        }"#;
        let resource: McpResource = serde_json::from_str(json_str).unwrap();

        assert_eq!(resource.uri, "skill://my-skill");
        assert_eq!(resource.name.as_deref(), Some("My Skill"));
        assert_eq!(resource.description.as_deref(), Some("A test skill"));
        assert_eq!(resource.mime_type.as_deref(), Some("text/plain"));
    }

    #[test]
    fn tc_1_2_mcp_resource_uri_only() {
        // [黑盒] TC-1.2: McpResource with only the required uri field — all options are None
        let json_str = r#"{"uri": "skill://minimal"}"#;
        let resource: McpResource = serde_json::from_str(json_str).unwrap();

        assert_eq!(resource.uri, "skill://minimal");
        assert!(resource.name.is_none());
        assert!(resource.description.is_none());
        assert!(resource.mime_type.is_none());
    }

    #[test]
    fn tc_1_3_mcp_resource_mime_type_camel_case_mapping() {
        // [白盒] TC-1.3: JSON field "mimeType" (camelCase) maps to Rust field mime_type via serde rename
        let json_str = r#"{"uri": "skill://x", "mimeType": "text/markdown"}"#;
        let resource: McpResource = serde_json::from_str(json_str).unwrap();

        assert_eq!(resource.mime_type.as_deref(), Some("text/markdown"));
    }

    #[test]
    fn tc_1_3b_mcp_resource_mime_type_snake_case_absent() {
        // [白盒] TC-1.3b: snake_case "mime_type" key is not accepted — mime_type stays None
        let json_str = r#"{"uri": "skill://x", "mime_type": "text/markdown"}"#;
        let resource: McpResource = serde_json::from_str(json_str).unwrap();

        // The snake_case key is unknown and ignored; mime_type should be None (default)
        assert!(resource.mime_type.is_none());
    }

    // -----------------------------------------------------------------------
    // TC-1.4: ResourcesListResult deserialization [黑盒]
    // -----------------------------------------------------------------------

    #[test]
    fn tc_1_4_resources_list_result_multiple() {
        // [黑盒] TC-1.4: ResourcesListResult with multiple resources
        let json_str = r#"{
            "resources": [
                {"uri": "skill://skill-a"},
                {"uri": "skill://skill-b", "name": "Skill B"}
            ]
        }"#;
        let result: ResourcesListResult = serde_json::from_str(json_str).unwrap();

        assert_eq!(result.resources.len(), 2);
        assert_eq!(result.resources[0].uri, "skill://skill-a");
        assert_eq!(result.resources[1].uri, "skill://skill-b");
        assert_eq!(result.resources[1].name.as_deref(), Some("Skill B"));
    }

    #[test]
    fn tc_1_5_resources_list_result_empty() {
        // [黑盒] TC-1.5: ResourcesListResult with empty resources array
        let json_str = r#"{"resources": []}"#;
        let result: ResourcesListResult = serde_json::from_str(json_str).unwrap();

        assert!(result.resources.is_empty());
    }

    // -----------------------------------------------------------------------
    // TC-1.6/1.7/1.8: ResourcesReadResult and ResourceContent [黑盒]
    // -----------------------------------------------------------------------

    #[test]
    fn tc_1_6_resources_read_result_with_text() {
        // [黑盒] TC-1.6: ResourcesReadResult with text content
        let json_str = r#"{
            "contents": [
                {
                    "uri": "skill://my-skill",
                    "mimeType": "text/plain",
                    "text": "---\ndescription: My skill\n---\n# My Skill"
                }
            ]
        }"#;
        let result: ResourcesReadResult = serde_json::from_str(json_str).unwrap();

        assert_eq!(result.contents.len(), 1);
        let content = &result.contents[0];
        assert_eq!(content.uri, "skill://my-skill");
        assert_eq!(content.mime_type.as_deref(), Some("text/plain"));
        assert!(
            content
                .text
                .as_deref()
                .unwrap()
                .contains("description: My skill")
        );
    }

    #[test]
    fn tc_1_7_resource_content_no_text_field() {
        // [黑盒] TC-1.7: ResourceContent without text (blob resource) — text is None
        let json_str = r#"{"uri": "skill://binary", "mimeType": "application/octet-stream"}"#;
        let content: ResourceContent = serde_json::from_str(json_str).unwrap();

        assert_eq!(content.uri, "skill://binary");
        assert_eq!(
            content.mime_type.as_deref(),
            Some("application/octet-stream")
        );
        assert!(content.text.is_none());
    }

    #[test]
    fn tc_1_8_resource_content_no_mime_type() {
        // [黑盒] TC-1.8: ResourceContent without mimeType — mime_type is None
        let json_str = r#"{"uri": "skill://no-mime", "text": "content"}"#;
        let content: ResourceContent = serde_json::from_str(json_str).unwrap();

        assert_eq!(content.uri, "skill://no-mime");
        assert!(content.mime_type.is_none());
        assert_eq!(content.text.as_deref(), Some("content"));
    }

    #[test]
    fn tc_1_wb_resource_content_mime_type_camel_case() {
        // [白盒] ResourceContent.mimeType uses same serde rename as McpResource
        let json_str = r#"{"uri": "skill://x", "mimeType": "text/markdown", "text": "hello"}"#;
        let content: ResourceContent = serde_json::from_str(json_str).unwrap();

        assert_eq!(content.mime_type.as_deref(), Some("text/markdown"));
        assert_eq!(content.text.as_deref(), Some("hello"));
    }

    #[test]
    fn tc_1_wb_resources_read_result_multiple_contents() {
        // [白盒] TC: read_resource uses find_map — multiple contents, only first text is used
        // Here we verify the ipc_interface type itself can hold multiple contents
        let json_str = r#"{
            "contents": [
                {"uri": "skill://x", "text": null},
                {"uri": "skill://x", "text": "actual content"}
            ]
        }"#;
        let result: ResourcesReadResult = serde_json::from_str(json_str).unwrap();

        assert_eq!(result.contents.len(), 2);
        assert!(result.contents[0].text.is_none());
        assert_eq!(result.contents[1].text.as_deref(), Some("actual content"));
    }
}
