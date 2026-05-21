use std::sync::LazyLock;

use regex::Regex;

static ANSI_RE: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"\x1b\[[0-9;]*[a-zA-Z]").unwrap());

pub fn strip_ansi(text: &str) -> String {
    ANSI_RE.replace_all(text, "").into_owned()
}

pub fn collapse_cr_lines(text: &str) -> String {
    let mut result = String::with_capacity(text.len());
    for line in text.split('\n') {
        if !result.is_empty() {
            result.push('\n');
        }
        if let Some(last) = line.rsplit('\r').next() {
            result.push_str(last);
        }
    }
    result
}

pub fn merge_blank_lines(text: &str) -> String {
    let mut result = String::with_capacity(text.len());
    let mut prev_blank = false;
    for line in text.split('\n') {
        let is_blank = line.trim().is_empty();
        if is_blank {
            if !prev_blank {
                if !result.is_empty() {
                    result.push('\n');
                }
                result.push('\n');
            }
            prev_blank = true;
        } else {
            if !result.is_empty() && !prev_blank {
                result.push('\n');
            } else if prev_blank && result.ends_with('\n') {
                // blank section already has trailing newline
            } else if !result.is_empty() {
                result.push('\n');
            }
            result.push_str(line.trim_end());
            prev_blank = false;
        }
    }
    result
}

pub fn trim_trailing_whitespace(text: &str) -> String {
    text.lines()
        .map(|line| line.trim_end())
        .collect::<Vec<_>>()
        .join("\n")
}

pub fn sanitize(text: &str) -> String {
    let text = strip_ansi(text);
    let text = collapse_cr_lines(&text);
    let text = trim_trailing_whitespace(&text);
    merge_blank_lines(&text)
}

