use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::Mutex;

use serde::{Deserialize, Serialize};

/// A recorded set of HTTP interactions
#[derive(Debug, Serialize, Deserialize)]
pub struct RecordedSession {
    pub name: String,
    pub recorded_at: String,
    pub interactions: Vec<HttpInteraction>,
}

/// A single request-response pair
#[derive(Debug, Serialize, Deserialize)]
pub struct HttpInteraction {
    pub request: RecordedRequest,
    pub response: RecordedResponse,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RecordedRequest {
    pub method: String,
    pub url: String,
    pub headers: HashMap<String, String>,
    pub body: serde_json::Value,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RecordedResponse {
    pub status: u16,
    pub headers: HashMap<String, String>,
    /// Body stored as string (may be SSE event stream)
    pub body: String,
}

/// VCR operating mode
pub enum RecordingMode {
    /// Normal operation, no VCR
    Off,
    /// Record interactions to cassette file
    Record(PathBuf),
    /// Replay from cassette file (no network)
    Replay(PathBuf),
}

/// VCR layer that intercepts HTTP interactions for recording/replay
pub struct RecordingLayer {
    mode: RecordingMode,
    cassette: Mutex<RecordedSession>,
    replay_index: Mutex<usize>,
}

impl RecordingLayer {
    /// Create a VCR layer from environment variables
    pub fn from_env() -> Option<Self> {
        let mode = std::env::var("VCR_MODE").ok()?;
        let cassette_path = std::env::var("VCR_CASSETTE").ok()?;
        let path = PathBuf::from(&cassette_path);

        match mode.as_str() {
            "record" => Some(Self::record(path)),
            "replay" => Self::replay(path).ok(),
            _ => None,
        }
    }

    /// Create a recording VCR layer
    pub fn record(path: PathBuf) -> Self {
        let name = path
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("unnamed")
            .to_string();

        Self {
            mode: RecordingMode::Record(path),
            cassette: Mutex::new(RecordedSession {
                name,
                recorded_at: chrono::Utc::now().to_rfc3339(),
                interactions: Vec::new(),
            }),
            replay_index: Mutex::new(0),
        }
    }

    /// Create a replay VCR layer from a cassette file
    pub fn replay(path: PathBuf) -> anyhow::Result<Self> {
        let cassette = load_cassette(&path)?;
        Ok(Self {
            mode: RecordingMode::Replay(path),
            cassette: Mutex::new(cassette),
            replay_index: Mutex::new(0),
        })
    }

    /// Check if this VCR layer is in replay mode
    pub fn is_replay(&self) -> bool {
        matches!(self.mode, RecordingMode::Replay(_))
    }

    /// Record an interaction (only in record mode)
    #[allow(clippy::too_many_arguments)]
    pub fn record_interaction(
        &self,
        method: &str,
        url: &str,
        request_headers: &HashMap<String, String>,
        request_body: serde_json::Value,
        status: u16,
        response_headers: &HashMap<String, String>,
        response_body: &str,
    ) {
        if let RecordingMode::Record(_) = &self.mode {
            let interaction = HttpInteraction {
                request: RecordedRequest {
                    method: method.to_string(),
                    url: url.to_string(),
                    headers: sanitize_headers(request_headers),
                    body: request_body,
                },
                response: RecordedResponse {
                    status,
                    headers: response_headers.clone(),
                    body: response_body.to_string(),
                },
            };
            if let Ok(mut cassette) = self.cassette.lock() {
                cassette.interactions.push(interaction);
            }
        }
    }

    /// Get the next replay response (only in replay mode)
    pub fn next_replay(&self) -> Option<&RecordedResponse> {
        // We need to work around Mutex not allowing returning references.
        // Instead, use get_replay_response which returns owned data.
        None
    }

    /// Get the next replay response as owned data
    pub fn get_replay_response(&self) -> Option<(u16, HashMap<String, String>, String)> {
        if let RecordingMode::Replay(_) = &self.mode {
            let mut index = self.replay_index.lock().ok()?;
            let cassette = self.cassette.lock().ok()?;

            if *index < cassette.interactions.len() {
                let interaction = &cassette.interactions[*index];
                *index += 1;
                Some((
                    interaction.response.status,
                    interaction.response.headers.clone(),
                    interaction.response.body.clone(),
                ))
            } else {
                None
            }
        } else {
            None
        }
    }

    /// Save the cassette to disk (only in record mode)
    pub fn save(&self) -> anyhow::Result<()> {
        if let RecordingMode::Record(path) = &self.mode {
            let cassette = self
                .cassette
                .lock()
                .map_err(|e| anyhow::anyhow!("Lock error: {}", e))?;

            if cassette.interactions.is_empty() {
                return Ok(()); // nothing to save
            }

            if let Some(parent) = path.parent() {
                std::fs::create_dir_all(parent)?;
            }

            let json = serde_json::to_string_pretty(&*cassette)?;
            std::fs::write(path, json)?;
            eprintln!(
                "[vcr] Saved {} interactions to {}",
                cassette.interactions.len(),
                path.display()
            );
        }
        Ok(())
    }
}

impl Drop for RecordingLayer {
    fn drop(&mut self) {
        if let Err(e) = self.save() {
            eprintln!("[vcr] Failed to save cassette: {}", e);
        }
    }
}

/// Load a cassette from disk
fn load_cassette(path: &Path) -> anyhow::Result<RecordedSession> {
    let content = std::fs::read_to_string(path)?;
    let cassette: RecordedSession = serde_json::from_str(&content)?;
    eprintln!(
        "[vcr] Loaded cassette '{}' with {} interactions",
        cassette.name,
        cassette.interactions.len()
    );
    Ok(cassette)
}

/// Remove sensitive headers from recorded requests
fn sanitize_headers(headers: &HashMap<String, String>) -> HashMap<String, String> {
    headers
        .iter()
        .map(|(k, v)| {
            let sanitized_value = if k.to_lowercase().contains("key")
                || k.to_lowercase().contains("auth")
                || k.to_lowercase().contains("token")
            {
                "[REDACTED]".to_string()
            } else {
                v.clone()
            };
            (k.clone(), sanitized_value)
        })
        .collect()
}
