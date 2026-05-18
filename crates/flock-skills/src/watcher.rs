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

#[cfg(test)]
mod tests {
    use super::*;
    use notify::{
        event::{AccessKind, CreateKind, ModifyKind, RemoveKind, RenameMode},
        EventKind,
    };

    // Helper: build a minimal Event with the given kind and paths.
    fn make_event(kind: EventKind, paths: Vec<PathBuf>) -> Event {
        Event {
            kind,
            paths,
            attrs: Default::default(),
        }
    }

    // -----------------------------------------------------------------------
    // TC-WB-01 [白盒] should_ignore: Access(Read) event → true
    // -----------------------------------------------------------------------

    #[test]
    fn wb01_should_ignore_access_read() {
        let ev = make_event(
            EventKind::Access(AccessKind::Read),
            vec![PathBuf::from("/some/SKILL.md")],
        );
        assert!(should_ignore(&ev), "Access(Read) should be ignored");
    }

    #[test]
    fn wb01b_should_ignore_access_any() {
        let ev = make_event(
            EventKind::Access(AccessKind::Any),
            vec![PathBuf::from("/some/SKILL.md")],
        );
        assert!(should_ignore(&ev), "Access(Any) should be ignored");
    }

    // -----------------------------------------------------------------------
    // TC-WB-02 [白盒] should_ignore: Create event with visible filename → false
    // -----------------------------------------------------------------------

    #[test]
    fn wb02_should_not_ignore_create_visible_file() {
        let ev = make_event(
            EventKind::Create(CreateKind::File),
            vec![PathBuf::from("/skills/SKILL.md")],
        );
        assert!(
            !should_ignore(&ev),
            "Create on visible file should NOT be ignored"
        );
    }

    // -----------------------------------------------------------------------
    // TC-WB-03 [白盒] should_ignore: Modify(Any) event with visible filename → false
    // -----------------------------------------------------------------------

    #[test]
    fn wb03_should_not_ignore_modify_visible_file() {
        let ev = make_event(
            EventKind::Modify(ModifyKind::Any),
            vec![PathBuf::from("/home/user/skills/SKILL.md")],
        );
        assert!(
            !should_ignore(&ev),
            "Modify(Any) on visible file should NOT be ignored"
        );
    }

    // -----------------------------------------------------------------------
    // TC-WB-03b [白盒] should_ignore: Modify(Metadata(_)) → true (Bug-2 fix)
    //
    // macOS FSEvents emits Modify(Metadata(Extended)) on the parent directory
    // when a hidden file is written.  This event must be filtered to prevent
    // spurious reloads when editor temp files are saved.
    // -----------------------------------------------------------------------

    #[test]
    fn wb03b_should_ignore_modify_metadata() {
        use notify::event::MetadataKind;
        let ev = make_event(
            EventKind::Modify(ModifyKind::Metadata(MetadataKind::Extended)),
            vec![PathBuf::from("/skills")],
        );
        assert!(
            should_ignore(&ev),
            "Modify(Metadata(Extended)) should be ignored (macOS parent-dir metadata event)"
        );
    }

    #[test]
    fn wb03c_should_ignore_modify_metadata_any() {
        use notify::event::MetadataKind;
        let ev = make_event(
            EventKind::Modify(ModifyKind::Metadata(MetadataKind::Any)),
            vec![PathBuf::from("/skills/SKILL.md")],
        );
        assert!(
            should_ignore(&ev),
            "Modify(Metadata(Any)) should be ignored"
        );
    }

    // -----------------------------------------------------------------------
    // TC-WB-04 [白盒] should_ignore: Remove event with visible filename → false
    // -----------------------------------------------------------------------

    #[test]
    fn wb04_should_not_ignore_remove_visible_file() {
        let ev = make_event(
            EventKind::Remove(RemoveKind::File),
            vec![PathBuf::from("/skills/SKILL.md")],
        );
        assert!(
            !should_ignore(&ev),
            "Remove on visible file should NOT be ignored"
        );
    }

    // -----------------------------------------------------------------------
    // TC-WB-05 [白盒] should_ignore: hidden filename (.swp) → true
    // -----------------------------------------------------------------------

    #[test]
    fn wb05_should_ignore_hidden_filename() {
        let ev = make_event(
            EventKind::Create(CreateKind::File),
            vec![PathBuf::from("/skills/.swp")],
        );
        assert!(should_ignore(&ev), ".swp hidden file should be ignored");
    }

    #[test]
    fn wb05b_should_ignore_ds_store() {
        let ev = make_event(
            EventKind::Create(CreateKind::File),
            vec![PathBuf::from("/skills/.DS_Store")],
        );
        assert!(should_ignore(&ev), ".DS_Store should be ignored");
    }

    // -----------------------------------------------------------------------
    // TC-WB-06 [白盒] should_ignore: empty paths list → true (vacuous truth)
    //
    // Iterator::all() on an empty iterator returns true.  This documents the
    // current behaviour where a zero-path event is treated as "all hidden".
    // -----------------------------------------------------------------------

    #[test]
    fn wb06_should_ignore_empty_paths_vacuous_true() {
        let ev = make_event(EventKind::Create(CreateKind::Any), vec![]);
        assert!(
            should_ignore(&ev),
            "empty paths: all() vacuous truth → treated as ignored"
        );
    }

    // -----------------------------------------------------------------------
    // TC-WB-07 [白盒] should_ignore: mixed paths (one visible, one hidden) → false
    //
    // all() requires every path to be hidden; one visible file name breaks it.
    // -----------------------------------------------------------------------

    #[test]
    fn wb07_should_not_ignore_mixed_paths() {
        let ev = make_event(
            EventKind::Modify(ModifyKind::Any),
            vec![
                PathBuf::from("/skills/SKILL.md"), // visible filename
                PathBuf::from("/skills/.swp"),     // hidden filename
            ],
        );
        assert!(
            !should_ignore(&ev),
            "mixed paths (one visible filename) should NOT be ignored"
        );
    }

    // -----------------------------------------------------------------------
    // TC-WB-08 [白盒] should_ignore: hidden intermediate dir, visible filename → false
    //
    // After the fix (file_name() only), a path like
    // `/private/var/folders/.tmpABC/SKILL.md` should NOT be ignored because
    // the file name `SKILL.md` does not start with `.`.
    // -----------------------------------------------------------------------

    #[test]
    fn wb08_hidden_intermediate_dir_visible_filename_not_ignored() {
        let ev = make_event(
            EventKind::Create(CreateKind::File),
            vec![PathBuf::from("/private/var/folders/.tmpABC123/SKILL.md")],
        );
        assert!(
            !should_ignore(&ev),
            "visible filename under hidden dir should NOT be ignored (file_name check only)"
        );
    }

    // -----------------------------------------------------------------------
    // TC-WB-09 [白盒] should_ignore: Rename event with visible filename → false
    // -----------------------------------------------------------------------

    #[test]
    fn wb09_should_not_ignore_rename_visible() {
        let ev = make_event(
            EventKind::Modify(notify::event::ModifyKind::Name(RenameMode::Any)),
            vec![PathBuf::from("/skills/SKILL.md")],
        );
        assert!(
            !should_ignore(&ev),
            "Rename (ModifyKind::Name) on visible file should NOT be ignored"
        );
    }

    // -----------------------------------------------------------------------
    // TC-WB-10 [白盒] should_ignore: path with no file_name component → false
    //
    // file_name() returns None for root ("/") or paths ending in "..".
    // unwrap_or(false) means "don't ignore" — a safe default.
    // -----------------------------------------------------------------------

    #[test]
    fn wb10_should_not_ignore_path_without_filename() {
        let ev = make_event(
            EventKind::Create(CreateKind::Any),
            // Path "/" has no file_name() — unwrap_or(false) → not hidden
            vec![PathBuf::from("/")],
        );
        assert!(
            !should_ignore(&ev),
            "path with no file_name (root) should NOT be ignored (unwrap_or(false))"
        );
    }

    // -----------------------------------------------------------------------
    // TC-WB-11 [白盒] watch_directory: duplicate call does not increase count
    // -----------------------------------------------------------------------

    #[tokio::test]
    async fn wb11_watch_directory_duplicate_is_noop() {
        let dir = tempfile::TempDir::new().unwrap();
        let (mut watcher, _rx) = SkillWatcher::new().unwrap();
        watcher.start(vec![dir.path().to_path_buf()]).unwrap();

        let count_before = watcher.watched_dirs().len();
        watcher.watch_directory(dir.path()).unwrap(); // second call, same dir
        let count_after = watcher.watched_dirs().len();

        assert_eq!(
            count_before, count_after,
            "duplicate watch_directory should not increase watched_dirs count"
        );
    }

    // -----------------------------------------------------------------------
    // TC-WB-12 [白盒] watch_directory after stop(): watcher is None → Ok (no panic)
    // -----------------------------------------------------------------------

    #[test]
    fn wb12_watch_directory_after_stop_returns_ok() {
        let rt = tokio::runtime::Runtime::new().unwrap();
        rt.block_on(async {
            let dir = tempfile::TempDir::new().unwrap();
            let (mut watcher, _rx) = SkillWatcher::new().unwrap();
            watcher.start(vec![]).unwrap();
            watcher.stop(); // watcher.watcher is now None

            // dir exists but watcher is None → skip silently → Ok
            let result = watcher.watch_directory(dir.path());
            assert!(
                result.is_ok(),
                "watch_directory after stop() should return Ok"
            );
        });
    }

    // -----------------------------------------------------------------------
    // TC-WB-13 [白盒] stop() before start() does not panic (debounce_task is None)
    // -----------------------------------------------------------------------

    #[test]
    fn wb13_stop_before_start_does_not_panic() {
        let rt = tokio::runtime::Runtime::new().unwrap();
        rt.block_on(async {
            let (mut watcher, _rx) = SkillWatcher::new().unwrap();
            watcher.stop(); // debounce_task is None
        });
    }

    // -----------------------------------------------------------------------
    // TC-WB-14 [白盒] watched_dirs() reflects directories added via start()
    // -----------------------------------------------------------------------

    #[tokio::test]
    async fn wb14_watched_dirs_reflects_start_dirs() {
        let dir_a = tempfile::TempDir::new().unwrap();
        let dir_b = tempfile::TempDir::new().unwrap();

        let (mut watcher, _rx) = SkillWatcher::new().unwrap();
        watcher
            .start(vec![dir_a.path().to_path_buf(), dir_b.path().to_path_buf()])
            .unwrap();

        let dirs = watcher.watched_dirs();
        assert_eq!(dirs.len(), 2, "should have 2 watched dirs");
        assert!(dirs.contains(&dir_a.path().to_path_buf()));
        assert!(dirs.contains(&dir_b.path().to_path_buf()));
    }

    // -----------------------------------------------------------------------
    // TC-WB-15 [白盒] watched_dirs() is empty after stop()
    // -----------------------------------------------------------------------

    #[tokio::test]
    async fn wb15_watched_dirs_cleared_after_stop() {
        let dir = tempfile::TempDir::new().unwrap();
        let (mut watcher, _rx) = SkillWatcher::new().unwrap();
        watcher.start(vec![dir.path().to_path_buf()]).unwrap();

        assert_eq!(watcher.watched_dirs().len(), 1);
        watcher.stop();
        assert_eq!(
            watcher.watched_dirs().len(),
            0,
            "should be empty after stop()"
        );
    }

    // -----------------------------------------------------------------------
    // TC-WB-16 [白盒] Drop impl calls stop() — no double-free / no panic
    // -----------------------------------------------------------------------

    #[tokio::test]
    async fn wb16_drop_calls_stop_no_panic() {
        let dir = tempfile::TempDir::new().unwrap();
        {
            let (mut watcher, _rx) = SkillWatcher::new().unwrap();
            watcher.start(vec![dir.path().to_path_buf()]).unwrap();
            // watcher dropped here — Drop::drop() calls stop()
        }
        // If we reach here without panic, the test passes.
    }
}
