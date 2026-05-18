use serde::{Deserialize, Serialize};
use sqlx::Row;

use crate::crypto;
use crate::types::tool::ToolDef;

/// Tool provider stored in the `tool_provider` table.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolProvider {
    pub id: String,
    pub provider_name: String,
    pub description: Option<String>,
    pub icon: Option<String>,
    /// Decrypted credentials JSON (not stored directly; encrypted form is in DB).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub credentials: Option<String>,
    /// JSON schema describing required credential fields.
    /// If present → provider needs auth; if None → no auth needed.
    pub credentials_schema: Option<String>,
    pub is_available: bool,
    pub created_at: String,
    pub updated_at: String,
}

/// Decrypt credentials from a DB row.
pub(super) fn decrypt_credentials_from_row(row: &sqlx::sqlite::SqliteRow, salt: &[u8]) -> Option<String> {
    let enc: Option<String> = row.try_get("credentials_encrypted").ok()?;
    let nonce: Option<String> = row.try_get("credentials_nonce").ok()?;
    match (enc, nonce) {
        (Some(ct), Some(n)) => crypto::decrypt_value(&ct, &n, salt).ok(),
        _ => None,
    }
}

/// Tool stored in the `tool` table.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Tool {
    pub id: String,
    pub name: String,
    pub description: String,
    pub category: String,
    pub input_schema: String,
    pub provider_id: String,
    pub is_deferred: bool,
    pub created_at: String,
    pub updated_at: String,
}

impl From<&ToolDef> for Tool {
    fn from(def: &ToolDef) -> Self {
        Tool {
            id: format!("tool:{}", def.name.to_lowercase()),
            name: def.name.clone(),
            description: def.description.clone(),
            category: def.category.clone(),
            input_schema: serde_json::to_string(&def.input_schema).unwrap_or_default(),
            provider_id: def.provider_id.clone(),
            is_deferred: def.deferred,
            created_at: String::new(),
            updated_at: String::new(),
        }
    }
}
