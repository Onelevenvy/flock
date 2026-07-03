use flock_core::db::DbManager;
use crate::sandbox_core::manager::execute_command_in_sandbox;

/// VNC 桌面服务端监听端口 (默认 6080，基于 websockify 提供 Web VNC 服务)
pub const WEBSOCKIFY_PORT: u16 = 6080;

/// 原始 VNC 服务监听端口 (默认 5900)
pub const X11VNC_PORT: u16 = 5900;

/// 默认的 X11 Display 标识
pub const DISPLAY_ID: &str = ":0";

/// 桌面分辨率
pub const SCREEN_RESOLUTION: &str = "1280x1024x24";

/// 确保沙盒中 VNC 桌面相关进程正在后台运行，具有自愈拉起和 setsid/nohup 防进程清理机制。
pub async fn ensure_vnc_running_in_sandbox(db: &DbManager, sandbox_id: &str) -> anyhow::Result<()> {
    // 检查 websockify 是否已经在运行且在指定端口监听
    let check_cmd = format!("python3 -c \"import socket; s = socket.socket(); s.connect(('127.0.0.1', {}))\"", WEBSOCKIFY_PORT);
    let (_, exit_code) = execute_command_in_sandbox(db, sandbox_id, &check_cmd).await.unwrap_or(("-1".to_string(), -1));
    if exit_code == 0 {
        // websockify 在跑，额外检查 fluxbox 是否存活（防止桌面黑屏）
        let fluxbox_check = "pgrep -x fluxbox >/dev/null 2>&1 && echo ok || echo missing";
        let (fluxbox_out, _) = execute_command_in_sandbox(db, sandbox_id, fluxbox_check)
            .await
            .unwrap_or(("missing".to_string(), 1));
        if fluxbox_out.trim() == "ok" {
            crate::emit_info(&flock_core::tr("检测到 VNC 桌面服务已经在运行。", "Detected VNC desktop service is already running."));
            return Ok(());
        }
        // fluxbox 未运行，只补启 fluxbox
        crate::emit_info(&flock_core::tr("VNC 端口在线但桌面管理器未运行，正在补启 fluxbox...", "VNC port active but window manager not running, restarting fluxbox..."));
        let restart_fluxbox = format!(
            "setsid nohup env DISPLAY={display} fluxbox >/tmp/fluxbox.log 2>&1 & sleep 2",
            display = DISPLAY_ID
        );
        let _ = execute_command_in_sandbox(db, sandbox_id, &restart_fluxbox).await;
        return Ok(());
    }

    crate::emit_info(&flock_core::tr("检测到 VNC 服务未运行，手动拉起 Xvfb, VNC, noVNC...", "Detected VNC service not running, manually starting Xvfb, VNC, noVNC..."));
    let launch_cmd = format!("sh -c '\
        if command -v start-vnc >/dev/null 2>&1; then \
            setsid nohup start-vnc >/tmp/vnc_start.log 2>&1 & \
            sleep 3; \
        else \
            export DISPLAY={display} && \
            rm -f /tmp/.X0-lock && \
            setsid nohup Xvfb {display} -screen 0 {res} >/tmp/xvfb.log 2>&1 & \
            sleep 1 && \
            setsid nohup env DISPLAY={display} fluxbox >/tmp/fluxbox.log 2>&1 & \
            sleep 1 && \
            setsid nohup env DISPLAY={display} x11vnc -display {display} -forever -shared -nopw -rfbport {vnc_port} >/tmp/x11vnc.log 2>&1 & \
            sleep 1 && \
            setsid nohup websockify --web /usr/share/novnc 0.0.0.0:{web_port} localhost:{vnc_port} >/tmp/websockify.log 2>&1 & \
            sleep 2; \
        fi'",
        display = DISPLAY_ID,
        res = SCREEN_RESOLUTION,
        vnc_port = X11VNC_PORT,
        web_port = WEBSOCKIFY_PORT
    );
    
    let (out, code) = execute_command_in_sandbox(db, sandbox_id, &launch_cmd).await?;
    if code != 0 {
        crate::emit_info(&flock_core::tr(
            &format!("手动拉起桌面服务进程失败 (退出码 {}): {}", code, out),
            &format!("Failed to manually start desktop service process (exit code {}): {}", code, out)
        ));
    } else {
        crate::emit_info(&flock_core::tr("手动拉起桌面服务进程指令已发送。", "Manual start desktop service process command sent."));
    }
    
    Ok(())
}
