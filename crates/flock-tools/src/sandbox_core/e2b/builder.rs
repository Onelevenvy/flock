use anyhow::{Context, Result};
use flock_core::config::settings::SandboxConfig;
use std::path::PathBuf;
use std::process::Stdio;
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command;

/// 自动构建 E2B 的专属桌面镜像（自带 VNC 和 Playwright）
/// 构建日志将通过传入的回调函数 (on_log) 实时推送
pub async fn build_enhanced_template<F>(api_key: &str, api_url: Option<&str>, name: &str, on_log: F) -> Result<String>
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

    // 删除残留的 e2b.toml，避免干扰新的构建
    if toml_path.exists() {
        let _ = std::fs::remove_file(&toml_path);
    }

    // 1. 写入 Dockerfile
    let dockerfile_content = r#"FROM e2bdev/desktop:latest
USER root
# 安装 python3-pip 和相关依赖
RUN apt-get update && apt-get install -y python3-pip

# 安装 Playwright 及浏览器
RUN pip install playwright && \
    playwright install chromium && \
    playwright install-deps chromium

USER user
"#;
    std::fs::write(&dockerfile_path, dockerfile_content)
        .context("Failed to write Dockerfile")?;

    on_log("环境准备完毕，开始调用 E2B CLI 构建镜像 (E2B 2.0 在云端构建，不需要本地安装 Docker)...\n".to_string());
    
    // 3. 执行 npx @e2b/cli template create
    // 在 Windows 下需要调用 npx.cmd
    let npx_cmd = if cfg!(windows) { "npx.cmd" } else { "npx" };
    
    let mut cmd = Command::new(npx_cmd);
    cmd.arg("-y")
        .arg("@e2b/cli@latest")
        .arg("template")
        .arg("create")
        .arg("-d")
        .arg("Dockerfile")
        .arg("-c")
        .arg("/start_command.sh")
        .arg("--ready-cmd")
        .arg("python3 -c \"import socket; s = socket.socket(); s.connect(('127.0.0.1', 6080))\"")
        .arg(name)
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
        anyhow::bail!("E2B template build failed with exit code: {}.\nError details:\n{}", status, full_output);
    }

    on_log("构建成功！正在解析 Template ID...\n".to_string());

    // 解析出 template ID
    let re = regex::Regex::new(r"(?i)\b(?:id|template_id)[:\s]+([a-z0-9]{20})\b").unwrap();
    if let Some(cap) = re.captures(&full_output) {
        let id = cap.get(1).unwrap().as_str().to_string();
        return Ok(id);
    }

    // 回退解析：寻找任何非 "dockerfile" 的 20 位字母数字组合作为 ID
    let re_fallback = regex::Regex::new(r"\b([a-z0-9]{20})\b").unwrap();
    for cap in re_fallback.captures_iter(&full_output) {
        let matched = cap.get(1).unwrap().as_str();
        if matched != "dockerfile" && matched != "template" {
            return Ok(matched.to_string());
        }
    }

    anyhow::bail!("构建成功，但未能从 E2B CLI 输出日志中提取出生成的 template_id")
}
