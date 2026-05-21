// Plan mode system prompt instructions.
//
// These prompts guide the LLM's behavior while in plan mode: what tools to
// use, what actions are forbidden, and how to structure the resulting plan.

/// Instructions injected into the system prompt when plan mode is active.
///
/// Guides the LLM through a structured planning workflow:
/// 1. Explore the codebase with read-only tools
/// 2. Design the implementation approach
/// 3. Write the plan
/// 4. Call ExitPlanMode when ready for user review
pub fn plan_mode_instructions() -> &'static str {
    r#"# Plan Mode

Plan mode is active. You MUST NOT make any edits, run any non-read-only tools, or otherwise make any changes to the system.

## Allowed actions
- Read files, search code, and explore the codebase using read-only tools (Read, Grep, Glob)
- Compose your implementation plan in your response text
- Ask clarifying questions

## Forbidden actions
- Editing, creating, or deleting files
- Running shell commands that modify state
- Making commits or pushing changes

## Planning workflow

### Phase 1: Understand
Explore the codebase to understand the current architecture, relevant files, and existing patterns. Read key files and search for related code.

### Phase 2: Design
Based on your understanding, design the implementation approach:
- Identify which files need to be created or modified
- Reference existing functions and utilities that should be reused
- Consider edge cases and error handling

### Phase 3: Write the plan
Compose a clear, actionable implementation plan in your response including:
- **Context**: brief explanation of why this change is needed
- **Files to modify**: list each file and what changes are needed
- **Existing code to reuse**: reference functions and utilities with file paths
- **Verification**: how to test the changes end-to-end

### Phase 4: Submit for review
When your plan is complete, call ExitPlanMode to submit it for user review. Do not ask "Is this plan okay?" — calling ExitPlanMode is the way to request approval."#
}
