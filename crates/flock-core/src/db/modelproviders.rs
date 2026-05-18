use serde::{Deserialize, Serialize};
use sqlx::Row;

use crate::crypto;

/// Model provider stored in the `model_provider` table.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelProvider {
    pub id: String,
    pub provider_name: String,
    pub provider_type: String,
    pub base_url: Option<String>,
    /// Decrypted api_key (not stored directly; encrypted form is in DB).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub api_key: Option<String>,
    pub icon: Option<String>,
    pub description: Option<String>,
    pub test_model: Option<String>,
    pub is_available: bool,
    pub created_at: String,
    pub updated_at: String,
}

/// Model stored in the `model` table.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Model {
    pub id: String,
    pub provider_id: String,
    pub model_name: String,
    pub categories: Vec<String>,
    pub capabilities: Vec<String>,
    pub is_online: bool,
    pub meta: Option<serde_json::Value>,
    pub created_at: String,
    pub updated_at: String,
}

/// Helper: decrypt api_key from a row's encrypted columns.
pub(super) fn decrypt_api_key_from_row(row: &sqlx::sqlite::SqliteRow, salt: &[u8]) -> Option<String> {
    let enc: Option<String> = row.try_get("api_key_encrypted").ok()?;
    let nonce: Option<String> = row.try_get("api_key_nonce").ok()?;
    match (enc, nonce) {
        (Some(ct), Some(n)) => crypto::decrypt_value(&ct, &n, salt).ok(),
        _ => None,
    }
}

/// Helper: parse a JSON array column into Vec<String>.
pub(super) fn parse_json_array(val: Option<String>) -> Vec<String> {
    val.and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}

// Provider CRUD methods are implemented on DbManager in mod.rs via delegation,
// or directly here if we choose to move them. For now we keep the implementations
// in mod.rs to minimize the diff. These structs and helpers are the extracted types.
