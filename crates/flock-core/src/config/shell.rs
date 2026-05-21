use std::process::{Output, Stdio};

use tokio::process::Command;

pub struct ShellInfo {
    pub program: &'static str,
    pub flag: &'static str,
}

pub fn shell_info() -> ShellInfo {
    if cfg!(windows) {
        ShellInfo {
            program: "cmd",
            flag: "/C",
        }
    } else {
        ShellInfo {
            program: "sh",
            flag: "-c",
        }
    }
}

pub fn shell_command_builder(command_str: &str) -> Command {
    let info = shell_info();
    let mut cmd = Command::new(info.program);
    cmd.arg(info.flag).arg(command_str);
    // 在 json_stream 模式下 flock 的 stdin 是管道，不设置 null 时
    // python / cmd 等会等待 EOF 而永远阻塞，直到超时。
    cmd.stdin(Stdio::null());

    // 移除 CREATE_NO_WINDOW，因为它可能导致某些 Windows 进程（如 python 重定向器）无法正确输出到管道
    
    cmd
}

pub async fn shell_command(command_str: &str) -> std::io::Result<Output> {
    shell_command_builder(command_str).output().await
}
