use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use std::collections::HashMap;
use tokio::sync::Mutex;
use tokio::task::JoinHandle;

pub struct ActiveTask {
    pub join_handle: JoinHandle<()>,
    pub cancel_flag: Arc<AtomicBool>,
    pub is_running: Arc<AtomicBool>,
}

pub struct ExecutionManager {
    tasks: Mutex<HashMap<String, ActiveTask>>,
}

impl ExecutionManager {
    pub fn new() -> Self {
        Self {
            tasks: Mutex::new(HashMap::new()),
        }
    }

    /// Register a new task. If an active task with the same ID exists, abort/cancel it first.
    pub async fn register_task(
        &self,
        task_id: String,
        join_handle: JoinHandle<()>,
        cancel_flag: Arc<AtomicBool>,
        is_running: Arc<AtomicBool>,
    ) {
        let mut lock = self.tasks.lock().await;
        if let Some(old_task) = lock.remove(&task_id) {
            old_task.cancel_flag.store(true, Ordering::SeqCst);
            old_task.join_handle.abort();
        }
        lock.insert(
            task_id,
            ActiveTask {
                join_handle,
                cancel_flag,
                is_running,
            },
        );
    }

    /// Check if a task is running.
    pub async fn is_task_running(&self, task_id: &str) -> bool {
        let lock = self.tasks.lock().await;
        if let Some(task) = lock.get(task_id) {
            task.is_running.load(Ordering::SeqCst)
        } else {
            false
        }
    }

    /// Cancel a running task by ID.
    pub async fn cancel_task(&self, task_id: &str) -> bool {
        let mut lock = self.tasks.lock().await;
        if let Some(task) = lock.remove(task_id) {
            task.cancel_flag.store(true, Ordering::SeqCst);
            task.join_handle.abort();
            true
        } else {
            false
        }
    }

    /// Remove/cleanup task from registry.
    pub async fn unregister_task(&self, task_id: &str) {
        let mut lock = self.tasks.lock().await;
        lock.remove(task_id);
    }
}
