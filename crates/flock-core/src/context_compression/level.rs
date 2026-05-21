use std::fmt;
use std::str::FromStr;

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "lowercase")]
pub enum CompressionLevel {
    Off,
    #[default]
    Safe,
    Full,
}

impl fmt::Display for CompressionLevel {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Off => write!(f, "off"),
            Self::Safe => write!(f, "safe"),
            Self::Full => write!(f, "full"),
        }
    }
}

impl FromStr for CompressionLevel {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.to_lowercase().as_str() {
            "off" => Ok(Self::Off),
            "safe" => Ok(Self::Safe),
            "full" => Ok(Self::Full),
            other => Err(format!(
                "unknown compaction level: '{other}' (expected: off, safe, full)"
            )),
        }
    }
}
