use flock_core::config::settings::SandboxConfig;
use crate::sandbox_core::config::get_api_base;
use serde_json::Value;

pub async fn get_or_create_volume(cfg: &SandboxConfig, workspace_id: &str) -> anyhow::Result<String> {
    let client = reqwest::Client::new();
    let base = get_api_base(cfg.api_url.as_ref().unwrap());
    let api_key = cfg.api_key.as_ref().unwrap();
    let vol_name = format!("flock-vol-{}", workspace_id);

    let get_url = format!("{}/api/volumes", base);
    let res = client.get(&get_url)
        .header("Authorization", format!("Bearer {}", api_key))
        .send()
        .await?;

    if res.status().is_success() {
        if let Ok(volumes) = res.json::<Vec<Value>>().await {
            for vol in volumes {
                if let Some(name) = vol.get("name").and_then(|n| n.as_str()) {
                    if name == vol_name {
                        if let Some(id) = vol.get("id").and_then(|i| i.as_str()) {
                            return Ok(id.to_string());
                        }
                    }
                }
            }
        }
    }

    // Create volume if not found
    let create_url = format!("{}/api/volumes", base);
    let create_body = serde_json::json!({
        "name": vol_name
    });

    let res = client.post(&create_url)
        .header("Authorization", format!("Bearer {}", api_key))
        .json(&create_body)
        .send()
        .await?;

    let status = res.status();
    let res_text = res.text().await.unwrap_or_default();

    if !status.is_success() {
        anyhow::bail!("Failed to create volume: {} - {}", status, res_text);
    }

    let val: Value = serde_json::from_str(&res_text)?;
    let vol_id = val.get("id").and_then(|i| i.as_str()).ok_or_else(|| {
        anyhow::anyhow!("No volume ID found in response: {}", val)
    })?;

    Ok(vol_id.to_string())
}
