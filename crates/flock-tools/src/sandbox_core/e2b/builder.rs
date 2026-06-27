use anyhow::{Context, Result};
use flock_core::config::settings::SandboxConfig;
use std::path::PathBuf;
use std::process::Stdio;
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command;

/// 自动构建 E2B 的专属桌面镜像（自带 VNC 和 Playwright）
/// 构建日志将通过传入的回调函数 (on_log) 实时推送
pub async fn build_enhanced_template<F>(api_key: &str, api_url: Option<&str>, on_log: F) -> Result<String>
where
    F: Fn(String) + Send + 'static,
{
    let builder_dir = std::env::temp_dir().join("flock_e2b_builder");
    
    if !builder_dir.exists() {
        std::fs::create_dir_all(&builder_dir)
            .context("Failed to create e2b_builder directory")?;
    }

    let dockerfile_path = builder_dir.join("Dockerfile");
    let toml_path = builder_dir.join("e2b.toml");

    // 1. 写入 Dockerfile
    let dockerfile_content = r#"FROM e2bdev/desktop:latest
# 安装 python3-pip 和相关依赖
RUN sudo apt-get update && sudo apt-get install -y python3-pip

# 安装 Playwright 及浏览器
RUN pip install playwright && \
    playwright install chromium && \
    playwright install-deps chromium
"#;
    std::fs::write(&dockerfile_path, dockerfile_content)
        .context("Failed to write Dockerfile")?;

    // 2. 写入 e2b.toml
    let toml_content = r#"template_name = "flock-enhanced-desktop"
dockerfile = "Dockerfile"
"#;
    std::fs::write(&toml_path, toml_content)
        .context("Failed to write e2b.toml")?;

    on_log("环境准备完毕，开始调用 E2B CLI 构建镜像 (可能需要 1-3 分钟)...\n".to_string());
    
    // 3. 执行 npx @e2b/cli template build
    // 在 Windows 下需要调用 npx.cmd
    let npx_cmd = if cfg!(windows) { "npx.cmd" } else { "npx" };
    
    let mut cmd = Command::new(npx_cmd);
    cmd.arg("-y")
        .arg("@e2b/cli@latest")
        .arg("template")
        .arg("build")
        .arg("-c")
        .arg("e2b.toml")
        .env("E2B_API_KEY", api_key)
        .current_dir(&builder_dir)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    if let Some(url) = api_url {
        cmd.env("E2B_API_URL", url);
    }

    let mut child = cmd.spawn()
        .context("Failed to spawn npx @e2b/cli")?;

    let stdout = child.stdout.take().expect("Failed to open stdout");
    let stderr = child.stderr.take().expect("Failed to open stderr");

    let mut stdout_reader = BufReader::new(stdout).lines();
    let mut stderr_reader = BufReader::new(stderr).lines();

    let (tx, mut rx) = tokio::sync::mpsc::unbounded_channel();
    let tx1 = tx.clone();
    
    tokio::spawn(async move {
        while let Ok(Some(line)) = stdout_reader.next_line().await {
            let _ = tx1.send(line);
        }
    });

    let tx2 = tx.clone();
    tokio::spawn(async move {
        while let Ok(Some(line)) = stderr_reader.next_line().await {
            let _ = tx2.send(line);
        }
    });

    drop(tx); // Close the main sender so the receiver will end when tasks complete

    let mut full_output = String::new();
    while let Some(line) = rx.recv().await {
        on_log(format!("{}\n", line));
        full_output.push_str(&line);
        full_output.push('\n');
    }

    let status = child.wait().await?;
    if !status.success() {
        anyhow::bail!("E2B template build failed with exit code: {}", status);
    }

    on_log("构建成功！正在解析 Template ID...\n".to_string());

    // 解析出 template ID (通常在构建输出中，或者在构建后的 e2b.toml 中)
    // E2B CLI 构建后，会将 template_id 写入 e2b.toml
    let updated_toml = std::fs::read_to_string(&toml_path)?;
    for line in updated_toml.lines() {
        if line.starts_with("template_id") {
            let parts: Vec<&str> = line.split('=').collect();
            if parts.len() == 2 {
                let id = parts[1].trim().trim_matches('"').to_string();
                return Ok(id);
            }
        }
    }

    anyhow::bail!("构建成功，但未能在 e2b.toml 中找到生成的 template_id")
}
