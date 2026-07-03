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
    let start_script_path = builder_dir.join("start_command.sh");
    let toml_path = builder_dir.join("e2b.toml");

    // 删除残留的 e2b.toml，避免干扰新的构建
    if toml_path.exists() {
        let _ = std::fs::remove_file(&toml_path);
    }

    // 写入 start_command.sh 启动脚本
    let start_script_content = r#"#!/bin/bash
echo "=== Debug: Checking installed commands ==="
which Xvfb || echo "Xvfb missing"
which fluxbox || echo "fluxbox missing"
which x11vnc || echo "x11vnc missing"
which websockify || echo "websockify missing"
which chromium || echo "chromium (system) missing"
echo "=========================================="

export DISPLAY=:0
export PLAYWRIGHT_BROWSERS_PATH=/opt/playwright-browsers
rm -f /tmp/.X0-lock
setsid Xvfb :0 -screen 0 1280x800x24 -ac +extension GLX +render -noreset >/tmp/xvfb.log 2>&1 &
sleep 1
setsid fluxbox >/tmp/fluxbox.log 2>&1 &
sleep 2
setsid x11vnc -display :0 -forever -shared -nopw -rfbport 5900 -noxrecord -noxfixes -noxdamage >/tmp/x11vnc.log 2>&1 &
sleep 1
setsid websockify --web /usr/share/novnc 0.0.0.0:6080 127.0.0.1:5900 >/tmp/websockify.log 2>&1 &
sleep 1
"#;
    let lf_content = start_script_content.replace("\r\n", "\n");
    std::fs::write(&start_script_path, lf_content)
        .context("Failed to write start_command.sh")?;

    // 1. 写入 Dockerfile
    let dockerfile_content = r#"FROM e2bdev/desktop:latest
USER root

# 复制启动脚本并赋予执行权限
COPY start_command.sh /start_command.sh
RUN chmod +x /start_command.sh

# 安装 VNC 桌面组件、系统级 Chromium 和 CJK 字体
# 系统级 chromium 是关键：browser/mod.rs 用 command -v chromium 检测并在 X11 DISPLAY 上启动可视窗口
RUN apt-get update && apt-get install -y --no-install-recommends \
    fluxbox websockify novnc \
    chromium chromium-sandbox \
    xterm \
    fonts-wqy-zenhei fonts-wqy-microhei fonts-noto-cjk \
    && rm -rf /var/lib/apt/lists/*

# 安装 Playwright 及其 Chromium，路径统一到 /opt/playwright-browsers（与 Daytona 一致）
RUN mkdir -p /opt/playwright-browsers && chmod 777 /opt/playwright-browsers
ENV PLAYWRIGHT_BROWSERS_PATH=/opt/playwright-browsers
RUN pip3 install --break-system-packages playwright && \
    PLAYWRIGHT_BROWSERS_PATH=/opt/playwright-browsers python3 -m playwright install-deps chromium && \
    PLAYWRIGHT_BROWSERS_PATH=/opt/playwright-browsers python3 -m playwright install chromium

USER user
"#;
    std::fs::write(&dockerfile_path, dockerfile_content)
        .context("Failed to write Dockerfile")?;

    on_log("Environment setup complete. Invoking E2B CLI to build the image (E2B 2.0 builds in the cloud; no local Docker installation is required)...\n".to_string());
    
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
        .arg("--cpu-count")
        .arg("2")
        .arg("--memory-mb")
        .arg("2048")
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

    on_log("Build succeeded! Parsing Template ID...\n".to_string());

    // 解析出 template ID
    let re = regex::Regex::new(r"(?i)\b(?:id|template_id)[:\s]+([a-z0-9]{20})\b").unwrap();
    if let Some(cap) = re.captures(&full_output) {
        let id = cap.get(1).unwrap().as_str().to_string();
        on_log(format!("Template ID successfully parsed: {}\n", id));
        return Ok(id);
    }

    anyhow::bail!("Template build succeeded, but failed to extract the generated templateID from E2B CLI logs")
}
