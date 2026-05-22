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

/// Helper function to select Chinese or English string based on current locale.
pub fn tr(zh: &str, en: &str) -> String {
    let locale = get_locale();
    if locale.starts_with("zh") {
        zh.to_string()
    } else {
        en.to_string()
    }
}
