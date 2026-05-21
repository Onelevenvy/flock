pub mod fold;
pub mod json;
pub mod level;
pub mod sanitize;
pub mod toon;

pub use level::CompressionLevel;
pub use toon::toon_format_instructions;

pub fn compact_output(text: &str, level: CompressionLevel) -> String {
    match level {
        CompressionLevel::Off => text.to_string(),
        CompressionLevel::Safe => sanitize::sanitize(text),
        CompressionLevel::Full => {
            let text = sanitize::sanitize(text);
            let text = fold::fold_repeated_lines(&text);
            json::compact_json(&text)
        }
    }
}

pub fn compact_output_toon(text: &str) -> String {
    toon::try_toon_encode(text)
}
