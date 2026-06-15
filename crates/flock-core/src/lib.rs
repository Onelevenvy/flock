pub mod types;
pub mod ipc_interface;
pub mod context_compression;
pub mod config;
pub mod crypto;
pub mod db;
pub mod model_factory;

use std::sync::{OnceLock, RwLock};

static GLOBAL_LOCALE: OnceLock<RwLock<String>> = OnceLock::new();

pub fn set_locale(locale: &str) {
    if let Some(lock) = GLOBAL_LOCALE.get() {
        if let Ok(mut writer) = lock.write() {
            *writer = locale.to_string();
        }
    } else {
        let _ = GLOBAL_LOCALE.set(RwLock::new(locale.to_string()));
    }
}

pub fn get_locale() -> String {
    GLOBAL_LOCALE.get()
        .and_then(|lock| lock.read().ok())
        .map(|reader| reader.clone())
        .unwrap_or_else(|| "zh".to_string())
}

pub fn tr(zh: &str, en: &str) -> String {
    let is_zh = GLOBAL_LOCALE.get()
        .and_then(|lock| lock.read().ok())
        .map(|reader| reader.starts_with("zh"))
        .unwrap_or(true);
    if is_zh {
        zh.to_string()
    } else {
        en.to_string()
    }
}

tokio::task_local! {
    pub static CURRENT_SESSION_ID: String;
}

pub fn get_current_session_id() -> String {
    CURRENT_SESSION_ID.try_with(|id| id.clone()).unwrap_or_else(|_| "default".to_string())
}

