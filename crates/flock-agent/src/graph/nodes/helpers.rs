use serde_json::Value as JsonValue;
use crate::graph::state::AgentState;

pub fn parse_state(input: &JsonValue) -> AgentState {
    match serde_json::from_value(input.clone()) {
        Ok(state) => state,
        Err(e) => {
            log::warn!(
                "[parse_state] failed to deserialize AgentState: {}. \
                 Hint: add #[serde(default)] to all fields in AgentState. \
                 Returning default state (messages will be empty!).",
                e
            );
            AgentState::default()
        }
    }
}
