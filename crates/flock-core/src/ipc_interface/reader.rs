use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::sync::mpsc;

use crate::ipc_interface::commands::ProtocolCommand;

/// Reads JSON Lines from stdin in a background task.
/// Returns a channel receiver for parsed commands.
pub fn spawn_stdin_reader() -> mpsc::UnboundedReceiver<ProtocolCommand> {
    let (tx, rx) = mpsc::unbounded_channel();

    tokio::spawn(async move {
        let stdin = tokio::io::stdin();
        let mut reader = BufReader::new(stdin);
        let mut line = String::new();

        loop {
            line.clear();
            match reader.read_line(&mut line).await {
                Ok(0) => break, // EOF - client closed stdin
                Ok(_) => {
                    let trimmed = line.trim();
                    if trimmed.is_empty() {
                        continue;
                    }
                    match serde_json::from_str::<ProtocolCommand>(trimmed) {
                        Ok(cmd) => {
                            if tx.send(cmd).is_err() {
                                break;
                            }
                        }
                        Err(e) => {
                            eprintln!("[ipc_interface] Invalid command: {e}");
                        }
                    }
                }
                Err(e) => {
                    eprintln!("[ipc_interface] stdin read error: {e}");
                    break;
                }
            }
        }
    });

    rx
}
