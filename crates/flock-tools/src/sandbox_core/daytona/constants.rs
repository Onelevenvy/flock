/// VNC 桌面服务端监听端口 (默认 6080，基于 websockify 提供 Web VNC 服务)
pub const WEBSOCKIFY_PORT: u16 = 6080;

/// 原始 VNC 服务监听端口 (默认 5900)
pub const X11VNC_PORT: u16 = 5900;

/// 默认的 X11 Display 标识
pub const DISPLAY_ID: &str = ":0";

/// 桌面分辨率
pub const SCREEN_RESOLUTION: &str = "1280x1024x24";
