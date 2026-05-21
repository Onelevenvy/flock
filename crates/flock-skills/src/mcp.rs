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

