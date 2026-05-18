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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn strip_ansi_color_codes() {
        let input = "\x1b[31mError\x1b[0m: something failed";
        assert_eq!(strip_ansi(input), "Error: something failed");
    }

    #[test]
    fn strip_ansi_bold_and_nested() {
        let input = "\x1b[1m\x1b[32mCompiling\x1b[0m flock-context_compression v0.1.0";
        assert_eq!(strip_ansi(input), "Compiling flock-context_compression v0.1.0");
    }

    #[test]
    fn strip_ansi_no_codes_unchanged() {
        let input = "plain text without any codes";
        assert_eq!(strip_ansi(input), input);
    }

    #[test]
    fn strip_ansi_cursor_movement() {
        let input = "\x1b[2K\x1b[1G> prompt";
        assert_eq!(strip_ansi(input), "> prompt");
    }

    #[test]
    fn strip_ansi_empty_input() {
        assert_eq!(strip_ansi(""), "");
    }

    // --- collapse_cr_lines ---

    #[test]
    fn collapse_cr_overwrites() {
        let input = "Downloading... 10%\rDownloading... 50%\rDownloading... 100%\nDone.";
        assert_eq!(collapse_cr_lines(input), "Downloading... 100%\nDone.");
    }

    #[test]
    fn collapse_cr_no_cr_unchanged() {
        let input = "line1\nline2\nline3";
        assert_eq!(collapse_cr_lines(input), input);
    }

    // --- merge_blank_lines ---

    #[test]
    fn merge_consecutive_blank_lines() {
        let input = "a\n\n\n\n\nb";
        assert_eq!(merge_blank_lines(input), "a\n\nb");
    }

    #[test]
    fn merge_blank_lines_preserves_single() {
        let input = "a\n\nb\n\nc";
        assert_eq!(merge_blank_lines(input), input);
    }

    #[test]
    fn merge_blank_lines_whitespace_only_lines() {
        let input = "a\n   \n  \n\nb";
        assert_eq!(merge_blank_lines(input), "a\n\nb");
    }

    // --- trim_trailing_whitespace ---

    #[test]
    fn trim_trailing_spaces() {
        let input = "hello   \nworld\t\t\nfoo";
        assert_eq!(trim_trailing_whitespace(input), "hello\nworld\nfoo");
    }

    #[test]
    fn trim_trailing_no_trailing() {
        let input = "clean\nlines";
        assert_eq!(trim_trailing_whitespace(input), input);
    }

    // --- sanitize (combined safe layer) ---

    #[test]
    fn sanitize_applies_all() {
        let input = "\x1b[32mCompiling\x1b[0m foo   \n\n\n\nbar\rbar done\n";
        let result = sanitize(input);
        assert!(!result.contains("\x1b["));
        assert!(!result.contains("\n\n\n"));
        assert!(!result.contains("   \n"));
        assert!(result.contains("bar done"));
    }
}
