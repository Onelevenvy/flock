use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use std::time::Duration;

use notify::{recommended_watcher, Event, EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use tokio::sync::watch;
use tokio::task::JoinHandle;

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/// Watches skill directories for filesystem changes and broadcasts a version
/// counter via a `watch` channel whenever a relevant change is detected.
///
/// Changes are debounced: multiple events within a 300 ms window are coalesced
/// into a single notification.  The version counter is a monotonically
/// increasing `u64`; consumers compare the received value against the previous
/// one to decide whether a reload is needed.
///
/// Hidden files (names starting with `.`) are silently ignored so that editor
/// swap/temp files do not trigger spurious reloads.
///
/// # Usage
///
/// ```ignore
/// let dirs = vec![user_skills_dir().unwrap()];
/// let (mut watcher, rx) = SkillWatcher::new()?;
/// watcher.start(dirs)?;
///
/// tokio::spawn(async move {
///     while rx.changed().await.is_ok() {
///         let version = *rx.borrow();
///         println!("skills changed, version={version}");
///         // reload skills here …
///     }
/// });
/// ```
pub struct SkillWatcher {
    /// The underlying notify watcher.  Wrapped in `Option` so that `stop()`
    /// can drop it (which terminates the OS-level monitoring thread).
    watcher: Option<RecommendedWatcher>,
    /// Sender side of the signal channel shared with the notify callback.
    /// Sending a `()` signals the debounce task that an event occurred.
    signal_tx: watch::Sender<()>,
    /// Sender side of the public version channel.  The debounce task calls
    /// `version_tx.send(n)` after the debounce window expires.
    version_tx: watch::Sender<u64>,
    /// Monotonically increasing version counter.
    version: Arc<AtomicU64>,
    /// Handle to the debounce tokio task so that `stop()` can abort it.
    debounce_task: Option<JoinHandle<()>>,
    /// Directories currently being watched.
    watched_dirs: Vec<PathBuf>,
}

impl SkillWatcher {
    /// Create a new `SkillWatcher`.
    ///
    /// Returns `(watcher, change_receiver)`.  Pass directories to
    /// [`start`](Self::start) to begin watching them.
    pub fn new() -> notify::Result<(Self, watch::Receiver<u64>)> {
        let (signal_tx, _signal_rx) = watch::channel(());
        let (version_tx, version_rx) = watch::channel(0u64);
        let version = Arc::new(AtomicU64::new(0));

        // Clone signal_tx for use inside the notify callback (runs on an OS
        // thread — `watch::Sender::send` is sync and safe to call there).
        let cb_signal_tx = signal_tx.clone();

        let inner_watcher = recommended_watcher(move |res: notify::Result<Event>| {
            if let Ok(event) = res {
                if should_ignore(&event) {
                    return;
                }
                // Signal the debounce task.  Errors mean the receiver was
                // dropped (watcher is shutting down) — ignore silently.
                let _ = cb_signal_tx.send(());
            }
        })?;

        let watcher = Self {
            watcher: Some(inner_watcher),
            signal_tx,
            version_tx,
            version,
            debounce_task: None,
            watched_dirs: Vec::new(),
        };

        Ok((watcher, version_rx))
    }

    /// Begin watching the directories supplied to [`new`](Self::new) and spawn
    /// the debounce task.
    ///
    /// Can only be called once per `SkillWatcher` instance.  Calling `start`
    /// after `stop` is not supported.
    pub fn start(&mut self, dirs: Vec<PathBuf>) -> notify::Result<()> {
        for dir in dirs {
            self.watch_directory(&dir)?;
        }

        let mut signal_rx = self.signal_tx.subscribe();
        let version = Arc::clone(&self.version);
        let version_tx = self.version_tx.clone();

        let handle = tokio::spawn(async move {
            loop {
                // Wait for the next signal from the notify callback.
                if signal_rx.changed().await.is_err() {
                    // Sender dropped — watcher stopped.
                    break;
                }

                // Debounce: wait 300 ms, consuming any additional signals that
                // arrive during the window.
                tokio::time::sleep(Duration::from_millis(300)).await;

                // Drain any signals queued during the sleep.
                while signal_rx.has_changed().unwrap_or(false) {
                    let _ = signal_rx.changed().await;
                }

                // Increment version and broadcast.
                let new_version = version.fetch_add(1, Ordering::Relaxed) + 1;
                // Errors mean all receivers were dropped; ignore.
                let _ = version_tx.send(new_version);
            }
        });

        self.debounce_task = Some(handle);
        Ok(())
    }

    /// Dynamically add a directory to the watch list.
    ///
    /// Skips directories that do not exist, logging a message.  Safe to call
    /// after [`start`](Self::start).
    pub fn watch_directory(&mut self, dir: &Path) -> notify::Result<()> {
        if !dir.is_dir() {
            eprintln!(
                "[skills/watcher] Skipped non-existent directory: {}",
                dir.display()
            );
            return Ok(());
        }

        if self.watched_dirs.contains(&dir.to_path_buf()) {
            return Ok(());
        }

        if let Some(ref mut w) = self.watcher {
            w.watch(dir, RecursiveMode::Recursive)?;
            self.watched_dirs.push(dir.to_path_buf());
            eprintln!("[skills/watcher] Watching: {}", dir.display());
        }

        Ok(())
    }

    /// Stop watching all directories and clean up resources.
    ///
    /// Drops the underlying notify watcher (which stops the OS monitoring
    /// thread) and aborts the debounce tokio task.
    pub fn stop(&mut self) {
        // Drop the notify watcher — this implicitly unwatches all paths and
        // shuts down the OS monitoring thread.
        self.watcher = None;

        // Abort the debounce task.
        if let Some(handle) = self.debounce_task.take() {
            handle.abort();
        }

        self.watched_dirs.clear();
    }

    /// Return the list of directories currently being watched.
    pub fn watched_dirs(&self) -> &[PathBuf] {
        &self.watched_dirs
    }
}

impl Drop for SkillWatcher {
    fn drop(&mut self) {
        self.stop();
    }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/// Returns `true` for events that should not trigger a reload.
///
/// Filtered events:
/// - `Access` events (read-only, no content change)
/// - `Modify(Metadata(_))` events (timestamp/permission/xattr changes only —
///   macOS FSEvents emits these on the parent directory when a hidden file is
///   written, which would otherwise bypass the hidden-file name filter)
/// - `Create(Folder)` events — macOS FSEvents emits a `Create(Folder)` event
///   on the watched directory itself when the watcher is first registered.
///   This is a spurious watcher-init event, not a real skill-relevant change.
///   On Linux (inotify) this event is not emitted for existing directories.
/// - Events on hidden files/directories (names starting with `.`)
fn should_ignore(event: &Event) -> bool {
    // Filter access-only and pure metadata events.
    if matches!(
        event.kind,
        EventKind::Access(_) | EventKind::Modify(notify::event::ModifyKind::Metadata(_))
    ) {
        return true;
    }

    // Filter directory-creation events.  macOS FSEvents fires Create(Folder)
    // on the watched directory itself upon watcher registration, and also when
    // a hidden file is written (the parent directory appears "created" again).
    // Directory creation is never a skill-relevant change — skills are files.
    if matches!(
        event.kind,
        EventKind::Create(notify::event::CreateKind::Folder)
    ) {
        return true;
    }

    // Filter hidden files (editor swap/temp files, .DS_Store, etc.).
    // Only check the final path component (file name), not intermediate
    // directory components — otherwise paths like `.flock/skills/SKILL.md`
    // would be incorrectly filtered because `.flock` starts with `.`.
    event.paths.iter().all(|p| {
        p.file_name()
            .map(|n| n.to_string_lossy().starts_with('.'))
            .unwrap_or(false)
    })
}

// ---------------------------------------------------------------------------
// White-box unit tests for internal helpers and struct branches
// ---------------------------------------------------------------------------
