use super::{register_bundled_skill, BundledSkillDefinition};

/// Register the built-in "hello" skill used to validate the bundled skill framework.
pub fn register_hello_skill() {
    register_bundled_skill(BundledSkillDefinition {
        name: "hello",
        description: "A simple greeting skill for testing the bundled skill framework.",
        content: "Hello! I'm a bundled skill. How can I help you today?\n\n$ARGUMENTS",
        user_invocable: true,
        when_to_use: None,
        argument_hint: None,
        allowed_tools: &[],
        model: None,
        disable_model_invocation: false,
        context: None,
        agent: None,
        files: &[],
    });
}

