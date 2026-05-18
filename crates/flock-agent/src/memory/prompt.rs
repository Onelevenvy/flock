// Memory system prompt construction.
//
// Builds the behavioral instructions and MEMORY.md content that get
// injected into the agent's system prompt so it knows how to read,
// write, and manage the persistent memory system.

use std::path::Path;

use crate::memory::index::{read_index, truncate_index, MAX_INDEX_LINES};
use crate::memory::paths::ENTRYPOINT_NAME;

// ---------------------------------------------------------------------------
// Display name
// ---------------------------------------------------------------------------

const DISPLAY_NAME: &str = "auto memory";

// ---------------------------------------------------------------------------
// Directory existence guidance
// ---------------------------------------------------------------------------

/// Guidance appended to the memory directory prompt line so the model
/// doesn't waste turns on `ls` / `mkdir -p` before writing.
const DIR_EXISTS_GUIDANCE: &str = "This directory already exists \u{2014} \
    write to it directly with the Write tool \
    (do not run mkdir or check for its existence).";

// ---------------------------------------------------------------------------
// Type taxonomy (individual-only, no team/private scope tags)
// ---------------------------------------------------------------------------

const TYPES_SECTION: &str = "\
## Types of memory

There are several discrete types of memory that you can store in your memory system:

<types>
<type>
    <name>user</name>
    <description>Contain information about the user's role, goals, responsibilities, and knowledge. Great user memories help you tailor your future behavior to the user's preferences and perspective. Your goal in reading and writing these memories is to build up an understanding of who the user is and how you can be most helpful to them specifically. For example, you should collaborate with a senior software engineer differently than a student who is coding for the very first time. Keep in mind, that the aim here is to be helpful to the user. Avoid writing memories about the user that could be viewed as a negative judgement or that are not relevant to the work you're trying to accomplish together.</description>
    <when_to_save>When you learn any details about the user's role, preferences, responsibilities, or knowledge</when_to_save>
    <how_to_use>When your work should be informed by the user's profile or perspective. For example, if the user is asking you to explain a part of the code, you should answer that question in a way that is tailored to the specific details that they will find most valuable or that helps them build their mental model in relation to domain knowledge they already have.</how_to_use>
    <examples>
    user: I'm a data scientist investigating what logging we have in place
    assistant: [saves user memory: user is a data scientist, currently focused on observability/logging]

    user: I've been writing Go for ten years but this is my first time touching the React side of this repo
    assistant: [saves user memory: deep Go expertise, new to React and this project's frontend \u{2014} frame frontend explanations in terms of backend analogues]
    </examples>
</type>
<type>
    <name>feedback</name>
    <description>Guidance the user has given you about how to approach work \u{2014} both what to avoid and what to keep doing. These are a very important type of memory to read and write as they allow you to remain coherent and responsive to the way you should approach work in the project. Record from failure AND success: if you only save corrections, you will avoid past mistakes but drift away from approaches the user has already validated, and may grow overly cautious.</description>
    <when_to_save>Any time the user corrects your approach (\"no not that\", \"don't\", \"stop doing X\") OR confirms a non-obvious approach worked (\"yes exactly\", \"perfect, keep doing that\", accepting an unusual choice without pushback). Corrections are easy to notice; confirmations are quieter \u{2014} watch for them. In both cases, save what is applicable to future conversations, especially if surprising or not obvious from the code. Include *why* so you can judge edge cases later.</when_to_save>
    <how_to_use>Let these memories guide your behavior so that the user does not need to offer the same guidance twice.</how_to_use>
    <body_structure>Lead with the rule itself, then a **Why:** line (the reason the user gave \u{2014} often a past incident or strong preference) and a **How to apply:** line (when/where this guidance kicks in). Knowing *why* lets you judge edge cases instead of blindly following the rule.</body_structure>
    <examples>
    user: don't mock the database in these tests \u{2014} we got burned last quarter when mocked tests passed but the prod migration failed
    assistant: [saves feedback memory: integration tests must hit a real database, not mocks. Reason: prior incident where mock/prod divergence masked a broken migration]

    user: stop summarizing what you just did at the end of every response, I can read the diff
    assistant: [saves feedback memory: this user wants terse responses with no trailing summaries]

    user: yeah the single bundled PR was the right call here, splitting this one would've just been churn
    assistant: [saves feedback memory: for refactors in this area, user prefers one bundled PR over many small ones. Confirmed after I chose this approach \u{2014} a validated judgment call, not a correction]
    </examples>
</type>
<type>
    <name>project</name>
    <description>Information that you learn about ongoing work, goals, initiatives, bugs, or incidents within the project that is not otherwise derivable from the code or git history. Project memories help you understand the broader context and motivation behind the work the user is doing within this working directory.</description>
    <when_to_save>When you learn who is doing what, why, or by when. These states change relatively quickly so try to keep your understanding of this up to date. Always convert relative dates in user messages to absolute dates when saving (e.g., \"Thursday\" \u{2192} \"2026-03-05\"), so the memory remains interpretable after time passes.</when_to_save>
    <how_to_use>Use these memories to more fully understand the details and nuance behind the user's request and make better informed suggestions.</how_to_use>
    <body_structure>Lead with the fact or decision, then a **Why:** line (the motivation \u{2014} often a constraint, deadline, or stakeholder ask) and a **How to apply:** line (how this should shape your suggestions). Project memories decay fast, so the why helps future-you judge whether the memory is still load-bearing.</body_structure>
    <examples>
    user: we're freezing all non-critical merges after Thursday \u{2014} mobile team is cutting a release branch
    assistant: [saves project memory: merge freeze begins 2026-03-05 for mobile release cut. Flag any non-critical PR work scheduled after that date]

    user: the reason we're ripping out the old auth middleware is that legal flagged it for storing session tokens in a way that doesn't meet the new compliance requirements
    assistant: [saves project memory: auth middleware rewrite is driven by legal/compliance requirements around session token storage, not tech-debt cleanup \u{2014} scope decisions should favor compliance over ergonomics]
    </examples>
</type>
<type>
    <name>reference</name>
    <description>Stores pointers to where information can be found in external systems. These memories allow you to remember where to look to find up-to-date information outside of the project directory.</description>
    <when_to_save>When you learn about resources in external systems and their purpose. For example, that bugs are tracked in a specific project in Linear or that feedback can be found in a specific Slack channel.</when_to_save>
    <how_to_use>When the user references an external system or information that may be in an external system.</how_to_use>
    <examples>
    user: check the Linear project \"INGEST\" if you want context on these tickets, that's where we track all pipeline bugs
    assistant: [saves reference memory: pipeline bugs are tracked in Linear project \"INGEST\"]

    user: the Grafana board at grafana.internal/d/api-latency is what oncall watches \u{2014} if you're touching request handling, that's the thing that'll page someone
    assistant: [saves reference memory: grafana.internal/d/api-latency is the oncall latency dashboard \u{2014} check it when editing request-path code]
    </examples>
</type>
</types>
";

// ---------------------------------------------------------------------------
// What NOT to save
// ---------------------------------------------------------------------------

const WHAT_NOT_TO_SAVE: &str = "\
## What NOT to save in memory

- Code patterns, conventions, architecture, file paths, or project structure \u{2014} these can be derived by reading the current project state.
- Git history, recent changes, or who-changed-what \u{2014} `git log` / `git blame` are authoritative.
- Debugging solutions or fix recipes \u{2014} the fix is in the code; the commit message has the context.
- Anything already documented in AGENTS.md files.
- Ephemeral task details: in-progress work, temporary state, current conversation context.

These exclusions apply even when the user explicitly asks you to save. If they ask you to save a PR list or activity summary, ask what was *surprising* or *non-obvious* about it \u{2014} that is the part worth keeping.";

// ---------------------------------------------------------------------------
// How to save (two-step process with MEMORY.md index)
// ---------------------------------------------------------------------------

fn how_to_save_section() -> String {
    format!(
        "\
## How to save memories

Saving a memory is a two-step process:

**Step 1** \u{2014} write the memory to its own file (e.g., `user_role.md`, `feedback_testing.md`) using this frontmatter format:

{FRONTMATTER_EXAMPLE}

**Step 2** \u{2014} add a pointer to that file in `{ep}`. `{ep}` is an index, not a memory \u{2014} each entry should be one line, under ~150 characters: `- [Title](file.md) \u{2014} one-line hook`. It has no frontmatter. Never write memory content directly into `{ep}`.

- `{ep}` is always loaded into your conversation context \u{2014} lines after {max_lines} will be truncated, so keep the index concise
- Keep the name, description, and type fields in memory files up-to-date with the content
- Organize memory semantically by topic, not chronologically
- Update or remove memories that turn out to be wrong or outdated
- Do not write duplicate memories. First check if there is an existing memory you can update before writing a new one.",
        ep = ENTRYPOINT_NAME,
        max_lines = MAX_INDEX_LINES,
    )
}

// ---------------------------------------------------------------------------
// Frontmatter example
// ---------------------------------------------------------------------------

const FRONTMATTER_EXAMPLE: &str = "\
```markdown
---
name: {{memory name}}
description: {{one-line description \u{2014} used to decide relevance in future conversations, so be specific}}
type: {{user, feedback, project, reference}}
---

{{memory content \u{2014} for feedback/project types, structure as: rule/fact, then **Why:** and **How to apply:** lines}}
```";

// ---------------------------------------------------------------------------
// When to access
// ---------------------------------------------------------------------------

const WHEN_TO_ACCESS: &str = "\
## When to access memories
- When memories seem relevant, or the user references prior-conversation work.
- You MUST access memory when the user explicitly asks you to check, recall, or remember.
- If the user says to *ignore* or *not use* memory: proceed as if MEMORY.md were empty. Do not apply remembered facts, cite, compare against, or mention memory content.
- Memory records can become stale over time. Use memory as context for what was true at a given point in time. Before answering the user or building assumptions based solely on information in memory records, verify that the memory is still correct and up-to-date by reading the current state of the files or resources. If a recalled memory conflicts with current information, trust what you observe now \u{2014} and update or remove the stale memory rather than acting on it.";

// ---------------------------------------------------------------------------
// Before recommending from memory
// ---------------------------------------------------------------------------

const BEFORE_RECOMMENDING: &str = "\
## Before recommending from memory

A memory that names a specific function, file, or flag is a claim that it existed *when the memory was written*. It may have been renamed, removed, or never merged. Before recommending it:

- If the memory names a file path: check the file exists.
- If the memory names a function or flag: grep for it.
- If the user is about to act on your recommendation (not just asking about history), verify first.

\"The memory says X exists\" is not the same as \"X exists now.\"

A memory that summarizes repo state (activity logs, architecture snapshots) is frozen in time. If the user asks about *recent* or *current* state, prefer `git log` or reading the code over recalling the snapshot.";

// ---------------------------------------------------------------------------
// Memory vs other persistence
// ---------------------------------------------------------------------------

const PERSISTENCE_SECTION: &str = "\
## Memory and other forms of persistence
Memory is one of several persistence mechanisms available to you as you assist the user in a given conversation. The distinction is often that memory can be recalled in future conversations and should not be used for persisting information that is only useful within the scope of the current conversation.
- When to use or update a plan instead of memory: If you are about to start a non-trivial implementation task and would like to reach alignment with the user on your approach you should use a Plan rather than saving this information to memory. Similarly, if you already have a plan within the conversation and you have changed your approach persist that change by updating the plan rather than saving a memory.
- When to use or update tasks instead of memory: When you need to break your work in current conversation into discrete steps or keep track of your progress use tasks instead of saving to memory. Tasks are great for persisting information about the work that needs to be done in the current conversation, but memory should be reserved for information that will be useful in future conversations.";

// ---------------------------------------------------------------------------
// Minimal memory prompt (lazy — saves ~2,500 tokens)
// ---------------------------------------------------------------------------

/// Compact summary of the memory system rules, without the full type taxonomy,
/// examples, or detailed save/access instructions. Enough for the LLM to
/// read existing memories and know the system exists; the full instructions
/// are injected on-demand when the LLM first writes to the memory directory.
const MINIMAL_RULES: &str = "\
You should build up this memory system over time so that future conversations \
can have a complete picture of who the user is, how they'd like to collaborate \
with you, what behaviors to avoid or repeat, and the context behind the work \
the user gives you.

If the user explicitly asks you to remember something, save it immediately. \
If they ask you to forget something, find and remove the relevant entry.

Memory types: user, feedback, project, reference. Each memory is a Markdown file \
with YAML frontmatter (name, description, type). MEMORY.md is the index — one \
line per entry, never write content directly into it.

Before saving, read existing memories to avoid duplicates. \
Verify file/function names from memory still exist before recommending them.";

// ===========================================================================
// Public API
// ===========================================================================

/// Build a minimal memory prompt with just the path, context_compression rules,
/// and MEMORY.md index content. Omits the full type taxonomy and examples
/// to save ~2,500 tokens on the first turn.
pub fn build_memory_prompt_minimal(memory_dir: &Path) -> String {
    let dir_display = memory_dir.display();

    let mut parts = vec![
        format!("# {DISPLAY_NAME}"),
        String::new(),
        format!(
            "You have a persistent, file-based memory system at `{dir_display}`. \
             {DIR_EXISTS_GUIDANCE}"
        ),
        String::new(),
        MINIMAL_RULES.to_owned(),
        String::new(),
    ];

    // Append MEMORY.md index (same logic as the full version)
    let entrypoint = memory_dir.join(ENTRYPOINT_NAME);
    let raw = read_index(&entrypoint);
    let trimmed = raw.trim();

    if trimmed.is_empty() {
        parts.push(format!("## {ENTRYPOINT_NAME}"));
        parts.push(String::new());
        parts.push(format!(
            "Your {ENTRYPOINT_NAME} is currently empty. \
             When you save new memories, they will appear here."
        ));
    } else {
        let truncation = truncate_index(&raw);
        parts.push(format!("## {ENTRYPOINT_NAME}"));
        parts.push(String::new());
        parts.push(truncation.content);
    }

    parts.join("\n")
}

/// Build the complete memory system prompt including behavioral instructions
/// AND the current MEMORY.md content (or an empty-state message).
///
/// This is the all-in-one function used when the caller needs a single
/// string to inject into the system prompt.
pub fn build_memory_prompt(memory_dir: &Path) -> String {
    let mut lines = build_memory_instructions(memory_dir);

    let entrypoint = memory_dir.join(ENTRYPOINT_NAME);
    let raw = read_index(&entrypoint);
    let trimmed = raw.trim();

    if trimmed.is_empty() {
        lines.push(format!("## {ENTRYPOINT_NAME}"));
        lines.push(String::new());
        lines.push(format!(
            "Your {ENTRYPOINT_NAME} is currently empty. \
             When you save new memories, they will appear here."
        ));
    } else {
        let truncation = truncate_index(&raw);
        lines.push(format!("## {ENTRYPOINT_NAME}"));
        lines.push(String::new());
        lines.push(truncation.content);
    }

    lines.join("\n")
}

/// Build only the behavioral instructions (without MEMORY.md content).
///
/// Returns a `Vec<String>` of logical prompt sections. The caller is
/// responsible for joining them with newlines and injecting any
/// additional content (e.g. MEMORY.md via a separate path).
pub fn build_memory_instructions(memory_dir: &Path) -> Vec<String> {
    let dir_display = memory_dir.display();

    vec![
        format!("# {DISPLAY_NAME}"),
        String::new(),
        format!(
            "You have a persistent, file-based memory system at `{dir_display}`. \
             {DIR_EXISTS_GUIDANCE}"
        ),
        String::new(),
        "You should build up this memory system over time so that future \
         conversations can have a complete picture of who the user is, how \
         they'd like to collaborate with you, what behaviors to avoid or \
         repeat, and the context behind the work the user gives you."
            .to_owned(),
        String::new(),
        "If the user explicitly asks you to remember something, save it \
         immediately as whichever type fits best. If they ask you to forget \
         something, find and remove the relevant entry."
            .to_owned(),
        String::new(),
        TYPES_SECTION.to_owned(),
        WHAT_NOT_TO_SAVE.to_owned(),
        String::new(),
        how_to_save_section(),
        String::new(),
        WHEN_TO_ACCESS.to_owned(),
        String::new(),
        BEFORE_RECOMMENDING.to_owned(),
        String::new(),
        PERSISTENCE_SECTION.to_owned(),
        String::new(),
    ]
}

/// Return the memory type descriptions as a standalone string.
///
/// Useful when only the type taxonomy is needed (e.g. for help text
/// or documentation), without the full behavioral instructions.
pub fn memory_type_descriptions() -> &'static str {
    TYPES_SECTION
}

// ===========================================================================
// Unit tests
// ===========================================================================

#[cfg(test)]
mod tests {
    use super::*;

    // -- constants integrity -------------------------------------------------

    #[test]
    fn types_section_contains_all_four_types() {
        for ty in ["user", "feedback", "project", "reference"] {
            assert!(
                TYPES_SECTION.contains(&format!("<name>{ty}</name>")),
                "TYPES_SECTION missing type: {ty}"
            );
        }
    }

    #[test]
    fn types_section_has_no_scope_tags() {
        assert!(
            !TYPES_SECTION.contains("<scope>"),
            "individual-mode TYPES_SECTION should not contain <scope> tags"
        );
    }

    #[test]
    fn what_not_to_save_mentions_agents_md() {
        assert!(
            WHAT_NOT_TO_SAVE.contains("AGENTS.md"),
            "should reference AGENTS.md, not CLAUDE.md"
        );
    }

    #[test]
    fn what_not_to_save_no_claude_brand() {
        assert!(
            !WHAT_NOT_TO_SAVE.contains("CLAUDE.md"),
            "should not contain bb brand reference CLAUDE.md"
        );
    }

    #[test]
    fn frontmatter_example_has_all_fields() {
        assert!(FRONTMATTER_EXAMPLE.contains("name:"));
        assert!(FRONTMATTER_EXAMPLE.contains("description:"));
        assert!(FRONTMATTER_EXAMPLE.contains("type:"));
    }

    #[test]
    fn frontmatter_example_lists_all_types() {
        assert!(FRONTMATTER_EXAMPLE.contains("user"));
        assert!(FRONTMATTER_EXAMPLE.contains("feedback"));
        assert!(FRONTMATTER_EXAMPLE.contains("project"));
        assert!(FRONTMATTER_EXAMPLE.contains("reference"));
    }

    // -- how_to_save_section -------------------------------------------------

    #[test]
    fn how_to_save_references_entrypoint() {
        let section = how_to_save_section();
        assert!(section.contains(ENTRYPOINT_NAME));
    }

    #[test]
    fn how_to_save_mentions_max_lines() {
        let section = how_to_save_section();
        assert!(section.contains(&MAX_INDEX_LINES.to_string()));
    }

    #[test]
    fn how_to_save_describes_two_steps() {
        let section = how_to_save_section();
        assert!(section.contains("Step 1"));
        assert!(section.contains("Step 2"));
    }

    // -- build_memory_instructions -------------------------------------------

    #[test]
    fn instructions_contain_display_name() {
        let lines = build_memory_instructions(Path::new("/test/memory"));
        let joined = lines.join("\n");
        assert!(joined.contains(DISPLAY_NAME));
    }

    #[test]
    fn instructions_contain_memory_dir_path() {
        let lines = build_memory_instructions(Path::new("/custom/path/memory"));
        let joined = lines.join("\n");
        assert!(joined.contains("/custom/path/memory"));
    }

    #[test]
    fn instructions_contain_dir_exists_guidance() {
        let lines = build_memory_instructions(Path::new("/test/memory"));
        let joined = lines.join("\n");
        assert!(joined.contains("already exists"));
    }

    #[test]
    fn instructions_contain_all_sections() {
        let lines = build_memory_instructions(Path::new("/test/memory"));
        let joined = lines.join("\n");
        assert!(joined.contains("## Types of memory"));
        assert!(joined.contains("## What NOT to save"));
        assert!(joined.contains("## How to save memories"));
        assert!(joined.contains("## When to access memories"));
        assert!(joined.contains("## Before recommending from memory"));
        assert!(joined.contains("## Memory and other forms of persistence"));
    }

    #[test]
    fn instructions_no_bb_brand() {
        let lines = build_memory_instructions(Path::new("/test/memory"));
        let joined = lines.join("\n");
        assert!(
            !joined.contains("~/.claude"),
            "should not reference bb config path"
        );
        assert!(
            !joined.contains("CLAUDE.md"),
            "should not reference bb config file"
        );
    }

    // -- memory_type_descriptions --------------------------------------------

    #[test]
    fn type_descriptions_returns_types_section() {
        let desc = memory_type_descriptions();
        assert!(desc.contains("<types>"));
        assert!(desc.contains("</types>"));
    }

    // -- build_memory_prompt (filesystem-dependent, basic validation) ---------

    #[test]
    fn prompt_with_nonexistent_dir_shows_empty_state() {
        let result = build_memory_prompt(Path::new("/nonexistent/memory/dir"));
        assert!(result.contains(ENTRYPOINT_NAME));
        assert!(result.contains("currently empty"));
    }

    #[test]
    fn prompt_with_existing_index() {
        let tmp = tempfile::tempdir().unwrap();
        let mem_dir = tmp.path().join("memory");
        std::fs::create_dir_all(&mem_dir).unwrap();
        let index_path = mem_dir.join(ENTRYPOINT_NAME);
        std::fs::write(
            &index_path,
            "- [Role](user_role.md) \u{2014} user role info\n",
        )
        .unwrap();

        let result = build_memory_prompt(&mem_dir);
        assert!(result.contains("user_role.md"));
        assert!(result.contains("user role info"));
        assert!(!result.contains("currently empty"));
    }

    #[test]
    fn prompt_with_empty_index_file_shows_empty_state() {
        let tmp = tempfile::tempdir().unwrap();
        let mem_dir = tmp.path().join("memory");
        std::fs::create_dir_all(&mem_dir).unwrap();
        let index_path = mem_dir.join(ENTRYPOINT_NAME);
        std::fs::write(&index_path, "").unwrap();

        let result = build_memory_prompt(&mem_dir);
        assert!(result.contains("currently empty"));
    }

    #[test]
    fn prompt_includes_instructions_before_index() {
        let tmp = tempfile::tempdir().unwrap();
        let mem_dir = tmp.path().join("memory");
        std::fs::create_dir_all(&mem_dir).unwrap();
        let index_path = mem_dir.join(ENTRYPOINT_NAME);
        std::fs::write(&index_path, "- [A](a.md) \u{2014} test\n").unwrap();

        let result = build_memory_prompt(&mem_dir);

        // Instructions (type descriptions) should appear before the index content
        let types_pos = result.find("## Types of memory").unwrap();
        let index_pos = result.find(&format!("## {ENTRYPOINT_NAME}")).unwrap();
        assert!(
            types_pos < index_pos,
            "instructions should appear before MEMORY.md content"
        );
    }

    #[test]
    fn prompt_truncates_large_index() {
        let tmp = tempfile::tempdir().unwrap();
        let mem_dir = tmp.path().join("memory");
        std::fs::create_dir_all(&mem_dir).unwrap();
        let index_path = mem_dir.join(ENTRYPOINT_NAME);

        // Create an index with 250 lines
        let content: String = (0..250)
            .map(|i| format!("- [Item {i}](item_{i}.md) \u{2014} summary {i}\n"))
            .collect();
        std::fs::write(&index_path, &content).unwrap();

        let result = build_memory_prompt(&mem_dir);
        assert!(result.contains("WARNING"));
    }

    // -- build_memory_prompt_minimal -------------------------------------------

    #[test]
    fn minimal_prompt_contains_display_name() {
        let result = build_memory_prompt_minimal(Path::new("/test/memory"));
        assert!(result.contains(DISPLAY_NAME));
    }

    #[test]
    fn minimal_prompt_contains_dir_path() {
        let result = build_memory_prompt_minimal(Path::new("/custom/path/memory"));
        assert!(result.contains("/custom/path/memory"));
    }

    #[test]
    fn minimal_prompt_contains_compact_rules() {
        let result = build_memory_prompt_minimal(Path::new("/test/memory"));
        assert!(
            result.contains("Memory types:"),
            "should list memory types compactly"
        );
        assert!(
            result.contains("MEMORY.md is the index"),
            "should mention MEMORY.md role"
        );
    }

    #[test]
    fn minimal_prompt_omits_full_type_taxonomy() {
        let result = build_memory_prompt_minimal(Path::new("/test/memory"));
        assert!(
            !result.contains("## Types of memory"),
            "minimal prompt should NOT contain full type taxonomy heading"
        );
        assert!(
            !result.contains("<types>"),
            "minimal prompt should NOT contain XML type definitions"
        );
        assert!(
            !result.contains("## What NOT to save"),
            "minimal prompt should NOT contain what-not-to-save section"
        );
        assert!(
            !result.contains("## How to save memories"),
            "minimal prompt should NOT contain detailed save instructions"
        );
    }

    #[test]
    fn minimal_prompt_nonexistent_dir_shows_empty_state() {
        let result = build_memory_prompt_minimal(Path::new("/nonexistent/memory/dir"));
        assert!(result.contains("currently empty"));
    }

    #[test]
    fn minimal_prompt_with_existing_index() {
        let tmp = tempfile::tempdir().unwrap();
        let mem_dir = tmp.path().join("memory");
        std::fs::create_dir_all(&mem_dir).unwrap();
        std::fs::write(
            mem_dir.join(ENTRYPOINT_NAME),
            "- [Role](user_role.md) \u{2014} senior engineer\n",
        )
        .unwrap();

        let result = build_memory_prompt_minimal(&mem_dir);
        assert!(result.contains("user_role.md"));
        assert!(result.contains("senior engineer"));
        assert!(!result.contains("currently empty"));
    }

    #[test]
    fn minimal_prompt_much_shorter_than_full() {
        let tmp = tempfile::tempdir().unwrap();
        let mem_dir = tmp.path().join("memory");
        std::fs::create_dir_all(&mem_dir).unwrap();
        std::fs::write(mem_dir.join(ENTRYPOINT_NAME), "- [A](a.md) \u{2014} test\n").unwrap();

        let full = build_memory_prompt(&mem_dir);
        let minimal = build_memory_prompt_minimal(&mem_dir);

        assert!(
            minimal.len() < full.len() / 2,
            "minimal ({} chars) should be less than half of full ({} chars)",
            minimal.len(),
            full.len()
        );
    }

    #[test]
    fn full_prompt_contains_full_taxonomy() {
        let result = build_memory_prompt(Path::new("/test/memory"));
        assert!(
            result.contains("## Types of memory"),
            "full prompt should contain type taxonomy"
        );
        assert!(
            result.contains("<types>"),
            "full prompt should contain XML type definitions"
        );
        assert!(
            result.contains("## What NOT to save"),
            "full prompt should contain what-not-to-save"
        );
        assert!(
            result.contains("## How to save memories"),
            "full prompt should contain save instructions"
        );
    }

    // -- no hardcoded platform paths -----------------------------------------

    #[test]
    fn constants_no_hardcoded_home_paths() {
        let all_text = [
            TYPES_SECTION,
            WHAT_NOT_TO_SAVE,
            FRONTMATTER_EXAMPLE,
            WHEN_TO_ACCESS,
            BEFORE_RECOMMENDING,
            PERSISTENCE_SECTION,
        ];
        for text in all_text {
            assert!(
                !text.contains("~/.config/flock"),
                "should not hardcode platform-specific path"
            );
            assert!(
                !text.contains("~/.claude"),
                "should not contain bb brand path"
            );
        }
    }
}
