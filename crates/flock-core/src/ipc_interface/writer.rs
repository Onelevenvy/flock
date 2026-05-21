use std::io::{self, BufWriter, Stdout, Write};
use std::sync::Mutex;

use crate::ipc_interface::events::ProtocolEvent;

/// Trait for emitting ipc_interface events to a host.
///
/// The default implementation (`ProtocolWriter`) writes JSON Lines to stdout.
/// Backend integrations provide alternative implementations that bridge events
/// to their own event systems.
pub trait ProtocolEmitter: Send + Sync {
    fn emit(&self, event: &ProtocolEvent) -> io::Result<()>;
}

/// Thread-safe JSON Lines writer to stdout
pub struct ProtocolWriter {
    writer: Mutex<BufWriter<Stdout>>,
}

impl Default for ProtocolWriter {
    fn default() -> Self {
        Self::new()
    }
}

impl ProtocolWriter {
    pub fn new() -> Self {
        Self {
            writer: Mutex::new(BufWriter::new(io::stdout())),
        }
    }
}

impl ProtocolEmitter for ProtocolWriter {
    fn emit(&self, event: &ProtocolEvent) -> io::Result<()> {
        let mut w = self
            .writer
            .lock()
            .map_err(|_| io::Error::other("ipc_interface writer lock poisoned"))?;
        serde_json::to_writer(&mut *w, event)
            .map_err(|e| io::Error::other(format!("failed to serialize ipc_interface event: {}", e)))?;
        writeln!(&mut *w)?;
        w.flush()
    }
}

