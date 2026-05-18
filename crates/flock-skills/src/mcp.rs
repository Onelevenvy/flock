use std::path::PathBuf;

use crate::frontmatter::{parse_frontmatter, parse_skill_fields};
use crate::loader::LoadedSkill;
use crate::types::{LoadChannel, SkillSource};
use flock_tools::mcp::manager::McpManager;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/// Discover and load skills from all connected MCP servers.
///
/// For each server that supports resources:
/// 1. Call resources/list
/// 2. Filter URIs starting with "skill://"
/// 3. Call resources/read for each skill resource
/// 4. Parse Markdown frontmatter → SkillMetadata
/// 5. Set source=Mcp, loaded_from=Mcp, name=<server>:<skill_name>
///
/// Individual resource or server failures are non-fatal: logged via eprintln
/// and skipped so that other servers/resources continue loading.
pub async fn load_mcp_skills(manager: &McpManager) -> Vec<LoadedSkill> {
    let mut results = Vec::new();

    for server_name in manager.server_names() {
        if !manager.server_supports_resources(&server_name) {
            continue;
        }

        let resources = match manager.list_resources(&server_name).await {
            Ok(r) => r,
            Err(e) => {
                eprintln!(
                    "[skills/mcp] Failed to list resources from '{}': {}",
                    server_name, e
                );
                continue;
            }
        };

        for resource in resources {
            // Only handle skill:// URIs
            if !resource.uri.starts_with("skill://") {
                continue;
            }

            let text = match manager.read_resource(&server_name, &resource.uri).await {
                Ok(t) => t,
                Err(e) => {
                    eprintln!(
                        "[skills/mcp] Failed to read resource '{}' from '{}': {}",
                        resource.uri, server_name, e
                    );
                    continue;
                }
            };

            let skill_name = uri_to_skill_name(&server_name, &resource.uri);
            let parsed = parse_frontmatter(&text);
            let metadata = parse_skill_fields(
                &parsed.frontmatter,
                &parsed.content,
                &skill_name,
                SkillSource::Mcp,
                LoadChannel::Mcp,
                None, // MCP skills have no local skill_root directory
            );

            // Virtual path used for deduplication — never matches real filesystem paths
            let virtual_path = PathBuf::from(format!("<mcp:{}>", skill_name));

            results.push(LoadedSkill {
                metadata,
                resolved_path: virtual_path,
            });
        }
    }

    results
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/// Convert a skill:// URI and server name into a colon-separated skill name.
///
/// Examples:
/// - server="my-server", uri="skill://my-skill"  → "my-server:my-skill"
/// - server="my-server", uri="skill://db/migrate" → "my-server:db:migrate"
fn uri_to_skill_name(server_name: &str, uri: &str) -> String {
    let stripped = uri.strip_prefix("skill://").unwrap_or(uri);
    // Replace path separators with colon-namespace separators
    let name_part = stripped.replace('/', ":");
    format!("{}:{}", server_name, name_part)
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;
    use async_trait::async_trait;
    use flock_tools::mcp::manager::McpManager;
    use flock_tools::mcp::protocol::{JsonRpcRequest, JsonRpcResponse};
    use flock_tools::mcp::transport::{McpError, McpTransport};
    use std::sync::Mutex;

    // -----------------------------------------------------------------------
    // MockTransport for mcp.rs tests
    // -----------------------------------------------------------------------

    struct MockTransport {
        responses: Mutex<Vec<serde_json::Value>>,
    }

    impl MockTransport {
        fn new(responses: Vec<serde_json::Value>) -> Self {
            Self {
                responses: Mutex::new(responses),
            }
        }
    }

    #[async_trait]
    impl McpTransport for MockTransport {
        async fn request(&self, _req: &JsonRpcRequest) -> Result<JsonRpcResponse, McpError> {
            let mut guard = self.responses.lock().unwrap();
            let value = if guard.is_empty() {
                serde_json::json!(null)
            } else {
                guard.remove(0)
            };
            Ok(JsonRpcResponse {
                jsonrpc: "2.0".to_string(),
                id: Some(1),
                result: Some(value),
                error: None,
            })
        }

        async fn notify(&self, _req: &JsonRpcRequest) -> Result<(), McpError> {
            Ok(())
        }

        async fn close(&self) -> Result<(), McpError> {
            Ok(())
        }
    }

    struct ErrorTransport;

    #[async_trait]
    impl McpTransport for ErrorTransport {
        async fn request(&self, _req: &JsonRpcRequest) -> Result<JsonRpcResponse, McpError> {
            Err(McpError::Transport("mock error".into()))
        }

        async fn notify(&self, _req: &JsonRpcRequest) -> Result<(), McpError> {
            Ok(())
        }

        async fn close(&self) -> Result<(), McpError> {
            Ok(())
        }
    }

    fn make_list_response(uris: Vec<&str>) -> serde_json::Value {
        let resources: Vec<_> = uris
            .into_iter()
            .map(|u| serde_json::json!({"uri": u}))
            .collect();
        serde_json::json!({"resources": resources})
    }

    fn make_read_response(text: &str) -> serde_json::Value {
        serde_json::json!({
            "contents": [{"uri": "skill://x", "mimeType": "text/plain", "text": text}]
        })
    }

    // -----------------------------------------------------------------------
    // TC-WB: uri_to_skill_name (private function — white-box inline tests)
    // -----------------------------------------------------------------------

    #[test]
    fn tc_wb_uri_simple() {
        // [白盒] skill://my-skill → server:my-skill
        assert_eq!(
            uri_to_skill_name("my-server", "skill://my-skill"),
            "my-server:my-skill"
        );
    }

    #[test]
    fn tc_wb_uri_nested_one_slash() {
        // [白盒] TC-3.4: skill://db/migrate → server:db:migrate
        assert_eq!(
            uri_to_skill_name("demo", "skill://db/migrate"),
            "demo:db:migrate"
        );
    }

    #[test]
    fn tc_wb_uri_nested_two_slashes() {
        // [白盒] TC-3.5: skill://a/b/c → server:a:b:c
        assert_eq!(uri_to_skill_name("demo", "skill://a/b/c"), "demo:a:b:c");
    }

    #[test]
    fn tc_wb_uri_no_skill_prefix_passthrough() {
        // [白盒] strip_prefix returns uri unchanged when prefix not present;
        // then replace('/', ':') is applied to the entire uri including "://"
        // so "tool://something" → "tool:::something" after replace
        assert_eq!(
            uri_to_skill_name("srv", "tool://something"),
            "srv:tool:::something"
        );
    }

    #[test]
    fn tc_wb_uri_empty_path_after_prefix() {
        // [白盒] skill:// → server: (empty name part)
        assert_eq!(uri_to_skill_name("srv", "skill://"), "srv:");
    }

    // -----------------------------------------------------------------------
    // TC-3.x: load_mcp_skills [黑盒 + 白盒]
    // -----------------------------------------------------------------------

    #[tokio::test]
    async fn tc_3_1_load_mcp_skills_normal() {
        // [黑盒] TC-3.1: normal discovery — skill:// resource parsed to SkillMetadata
        let list_resp = make_list_response(vec!["skill://my-skill"]);
        let read_resp = make_read_response("---\ndescription: My MCP skill\n---\n# My MCP Skill\n");

        let manager = McpManager::new_for_test(vec![(
            "my-server",
            true,
            Box::new(MockTransport::new(vec![list_resp, read_resp])),
        )]);

        let results = load_mcp_skills(&manager).await;
        assert_eq!(results.len(), 1);
        let meta = &results[0].metadata;
        assert_eq!(meta.name, "my-server:my-skill");
        assert_eq!(meta.source, crate::types::SkillSource::Mcp);
        assert_eq!(meta.loaded_from, crate::types::LoadChannel::Mcp);
        assert!(meta.skill_root.is_none());
    }

    #[tokio::test]
    async fn tc_3_2_uri_filter_skips_non_skill_uris() {
        // [黑盒] TC-3.2: only skill:// URIs processed — tool:// and file:// are skipped
        let list_resp =
            make_list_response(vec!["skill://valid-skill", "tool://other", "file://doc.md"]);
        let read_resp = make_read_response("---\ndescription: Valid\n---\n");

        let manager = McpManager::new_for_test(vec![(
            "my-server",
            true,
            Box::new(MockTransport::new(vec![list_resp, read_resp])),
        )]);

        let results = load_mcp_skills(&manager).await;
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].metadata.name, "my-server:valid-skill");
    }

    #[tokio::test]
    async fn tc_3_3_naming_rule_simple() {
        // [黑盒] TC-3.3: skill://my-skill → demo:my-skill
        let list_resp = make_list_response(vec!["skill://my-skill"]);
        let read_resp = make_read_response("---\ndescription: x\n---\n");

        let manager = McpManager::new_for_test(vec![(
            "demo",
            true,
            Box::new(MockTransport::new(vec![list_resp, read_resp])),
        )]);

        let results = load_mcp_skills(&manager).await;
        assert_eq!(results[0].metadata.name, "demo:my-skill");
    }

    #[tokio::test]
    async fn tc_3_4_naming_rule_slash_to_colon() {
        // [黑盒] TC-3.4: skill://db/migrate → demo:db:migrate
        let list_resp = make_list_response(vec!["skill://db/migrate"]);
        let read_resp = make_read_response("---\ndescription: migrate\n---\n");

        let manager = McpManager::new_for_test(vec![(
            "demo",
            true,
            Box::new(MockTransport::new(vec![list_resp, read_resp])),
        )]);

        let results = load_mcp_skills(&manager).await;
        assert_eq!(results[0].metadata.name, "demo:db:migrate");
    }

    #[tokio::test]
    async fn tc_3_6_source_and_loaded_from_mcp() {
        // [黑盒] TC-3.6/3.7: source=Mcp, loaded_from=Mcp, skill_root=None
        let list_resp = make_list_response(vec!["skill://skill-x"]);
        let read_resp = make_read_response("---\ndescription: x\n---\n");

        let manager = McpManager::new_for_test(vec![(
            "srv",
            true,
            Box::new(MockTransport::new(vec![list_resp, read_resp])),
        )]);

        let results = load_mcp_skills(&manager).await;
        let meta = &results[0].metadata;
        assert_eq!(meta.source, crate::types::SkillSource::Mcp);
        assert_eq!(meta.loaded_from, crate::types::LoadChannel::Mcp);
        assert!(meta.skill_root.is_none());
    }

    #[tokio::test]
    async fn tc_3_8_frontmatter_parsed() {
        // [黑盒] TC-3.8: frontmatter fields properly parsed from MCP skill content
        let list_resp = make_list_response(vec!["skill://test-skill"]);
        let read_resp = make_read_response(
            "---\ndescription: Test skill description\nallowed-tools: Bash\n---\n# Test\n",
        );

        let manager = McpManager::new_for_test(vec![(
            "srv",
            true,
            Box::new(MockTransport::new(vec![list_resp, read_resp])),
        )]);

        let results = load_mcp_skills(&manager).await;
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].metadata.description, "Test skill description");
        assert!(results[0].metadata.has_user_specified_description);
    }

    #[tokio::test]
    async fn tc_3_9_single_resource_failure_does_not_affect_others() {
        // [黑盒] TC-3.9: when read_resource fails for one skill, others still load
        // Use a transport where resources/list returns two skills, but second read errors
        use std::sync::atomic::{AtomicUsize, Ordering};
        struct PartialErrorTransport {
            call_count: AtomicUsize,
        }
        #[async_trait::async_trait]
        impl McpTransport for PartialErrorTransport {
            async fn request(&self, _req: &JsonRpcRequest) -> Result<JsonRpcResponse, McpError> {
                let count = self.call_count.fetch_add(1, Ordering::Relaxed);
                match count {
                    0 => Ok(JsonRpcResponse {
                        // resources/list
                        jsonrpc: "2.0".to_string(),
                        id: Some(1),
                        result: Some(serde_json::json!({
                            "resources": [{"uri": "skill://good-skill"}, {"uri": "skill://bad-skill"}]
                        })),
                        error: None,
                    }),
                    1 => Ok(JsonRpcResponse {
                        // read good-skill
                        jsonrpc: "2.0".to_string(),
                        id: Some(2),
                        result: Some(serde_json::json!({
                            "contents": [{"uri": "skill://good-skill", "text": "---\ndescription: Good\n---\n"}]
                        })),
                        error: None,
                    }),
                    _ => Err(McpError::Transport("bad resource".into())),
                }
            }
            async fn notify(&self, _req: &JsonRpcRequest) -> Result<(), McpError> {
                Ok(())
            }
            async fn close(&self) -> Result<(), McpError> {
                Ok(())
            }
        }

        let manager = McpManager::new_for_test(vec![(
            "srv",
            true,
            Box::new(PartialErrorTransport {
                call_count: AtomicUsize::new(0),
            }),
        )]);

        let results = load_mcp_skills(&manager).await;
        // good-skill loaded, bad-skill skipped
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].metadata.name, "srv:good-skill");
    }

    #[tokio::test]
    async fn tc_3_10_server_list_failure_does_not_affect_other_servers() {
        // [黑盒] TC-3.10: when list_resources fails for one server, other servers still load
        let list_resp = make_list_response(vec!["skill://ok-skill"]);
        let read_resp = make_read_response("---\ndescription: OK\n---\n");

        let manager = McpManager::new_for_test(vec![
            (
                "server-ok",
                true,
                Box::new(MockTransport::new(vec![list_resp, read_resp])),
            ),
            ("server-fail", true, Box::new(ErrorTransport)),
        ]);

        let results = load_mcp_skills(&manager).await;
        // At least one skill from server-ok; server-fail's error is ignored
        assert!(
            results
                .iter()
                .any(|r| r.metadata.name == "server-ok:ok-skill")
        );
    }

    #[tokio::test]
    async fn tc_3_12_server_without_resources_capability_skipped() {
        // [黑盒] TC-3.12: server without resources capability is not queried
        let manager = McpManager::new_for_test(vec![(
            "no-resources-server",
            false,                    // does not support resources
            Box::new(ErrorTransport), // would fail if called
        )]);

        let results = load_mcp_skills(&manager).await;
        assert!(results.is_empty());
    }

    #[tokio::test]
    async fn tc_3_13_multiple_servers_aggregated() {
        // [黑盒] TC-3.13: skills from multiple servers all appear in results
        let list_a = make_list_response(vec!["skill://x"]);
        let read_a = make_read_response("---\ndescription: X\n---\n");
        let list_b = make_list_response(vec!["skill://y", "skill://z"]);
        let read_b1 = make_read_response("---\ndescription: Y\n---\n");
        let read_b2 = make_read_response("---\ndescription: Z\n---\n");

        let manager = McpManager::new_for_test(vec![
            (
                "server-a",
                true,
                Box::new(MockTransport::new(vec![list_a, read_a])),
            ),
            (
                "server-b",
                true,
                Box::new(MockTransport::new(vec![list_b, read_b1, read_b2])),
            ),
        ]);

        let results = load_mcp_skills(&manager).await;
        assert_eq!(results.len(), 3);
        let names: Vec<_> = results.iter().map(|r| r.metadata.name.as_str()).collect();
        assert!(names.contains(&"server-a:x"));
        assert!(names.contains(&"server-b:y"));
        assert!(names.contains(&"server-b:z"));
    }

    #[tokio::test]
    async fn tc_3_wb_virtual_path_format() {
        // [白盒] MCP skill virtual path is "<mcp:server:name>" for deduplication
        let list_resp = make_list_response(vec!["skill://my-skill"]);
        let read_resp = make_read_response("---\ndescription: x\n---\n");

        let manager = McpManager::new_for_test(vec![(
            "srv",
            true,
            Box::new(MockTransport::new(vec![list_resp, read_resp])),
        )]);

        let results = load_mcp_skills(&manager).await;
        assert_eq!(results.len(), 1);
        let path_str = results[0].resolved_path.to_string_lossy();
        assert_eq!(path_str, "<mcp:srv:my-skill>");
    }
}
