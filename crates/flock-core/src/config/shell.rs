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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn shell_info_returns_platform_appropriate_values() {
        let info = shell_info();
        if cfg!(windows) {
            assert_eq!(info.program, "cmd");
            assert_eq!(info.flag, "/C");
        } else {
            assert_eq!(info.program, "sh");
            assert_eq!(info.flag, "-c");
        }
    }

    #[tokio::test]
    async fn shell_command_runs_echo() {
        let output = shell_command("echo hello")
            .await
            .expect("shell_command failed");
        let stdout = String::from_utf8_lossy(&output.stdout);
        assert!(stdout.contains("hello"));
    }

    #[tokio::test]
    async fn shell_command_builder_allows_env_and_cwd() {
        let tmp = std::env::temp_dir();
        let cmd_str = if cfg!(windows) {
            "echo %MY_VAR%"
        } else {
            "echo $MY_VAR"
        };
        let output = shell_command_builder(cmd_str)
            .env("MY_VAR", "test_value")
            .current_dir(&tmp)
            .output()
            .await
            .expect("builder failed");
        let stdout = String::from_utf8_lossy(&output.stdout);
        assert!(stdout.contains("test_value"));
    }
}
