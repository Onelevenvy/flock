use crate::engine::AgentEngine;

impl AgentEngine {
    /// Run stop hooks when the agent session ends
    pub async fn run_stop_hooks(&self) {
        if let Some(hook_engine) = &self.hooks {
            let messages = hook_engine.run_stop().await;
            for msg in messages {
                eprintln!("{}", msg);
            }
        }
    }
}
