const MIN_FOLD_COUNT: usize = 3;
const MIN_PREFIX_RATIO: f64 = 0.5;

fn common_prefix_len(a: &str, b: &str) -> usize {
    a.chars()
        .zip(b.chars())
        .take_while(|(ca, cb)| ca == cb)
        .count()
}

fn lines_are_similar(a: &str, b: &str) -> bool {
    if a.is_empty() || b.is_empty() {
        return false;
    }
    let prefix = common_prefix_len(a, b);
    let min_len = a.len().min(b.len());
    prefix as f64 / min_len as f64 >= MIN_PREFIX_RATIO
}

pub fn fold_repeated_lines(text: &str) -> String {
    if text.is_empty() {
        return String::new();
    }

    let lines: Vec<&str> = text.split('\n').collect();
    let mut result: Vec<String> = Vec::new();
    let mut i = 0;

    while i < lines.len() {
        let mut j = i + 1;
        while j < lines.len() && lines_are_similar(lines[i], lines[j]) {
            j += 1;
        }

        let group_len = j - i;
        if group_len >= MIN_FOLD_COUNT {
            let folded = group_len - 2;
            result.push(lines[i].to_string());
            let identical = (i + 1..j).all(|k| lines[k] == lines[i]);
            if identical {
                result.push(format!("[... {folded} identical lines]"));
            } else {
                result.push(format!("[... {folded} similar lines]"));
            }
            result.push(lines[j - 1].to_string());
        } else {
            for line in &lines[i..j] {
                result.push(line.to_string());
            }
        }

        i = j;
    }

    result.join("\n")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn fold_identical_consecutive_lines() {
        let input = "ok\nok\nok\nok\nok\ndone";
        let result = fold_repeated_lines(input);
        assert!(result.contains("[... 3 identical lines]"));
        assert!(result.contains("ok"));
        assert!(result.contains("done"));
    }

    #[test]
    fn fold_no_repeats_unchanged() {
        let input = "apple\nbanana\ncherry";
        assert_eq!(fold_repeated_lines(input), input);
    }

    #[test]
    fn fold_similar_prefix_lines() {
        let lines: Vec<String> = (0..10)
            .map(|i| format!("Compiling crate-{i} v0.1.0"))
            .collect();
        let input = lines.join("\n");
        let result = fold_repeated_lines(&input);
        assert!(result.contains("[... 8 similar lines]"));
        assert!(result.contains("Compiling crate-0"));
        assert!(result.contains("Compiling crate-9"));
    }

    #[test]
    fn fold_below_threshold_unchanged() {
        let input = "Compiling a v0.1.0\nCompiling b v0.1.0\ndone";
        assert_eq!(fold_repeated_lines(input), input);
    }

    #[test]
    fn fold_mixed_groups() {
        let mut lines = Vec::new();
        for i in 0..6 {
            lines.push(format!("Downloading dep-{i}..."));
        }
        lines.push("Install complete".to_string());
        for i in 0..5 {
            lines.push(format!("Compiling mod-{i}"));
        }
        let input = lines.join("\n");
        let result = fold_repeated_lines(&input);
        assert!(
            result.contains("[... 4 similar lines]"),
            "first group folded: {result}"
        );
        assert!(result.contains("Install complete"));
        assert!(
            result.contains("[... 3 similar lines]"),
            "second group folded: {result}"
        );
    }

    #[test]
    fn fold_empty_input() {
        assert_eq!(fold_repeated_lines(""), "");
    }
}
