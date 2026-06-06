use crate::types::tool::I18nString;
use super::assistants::UpsertAssistant;

/// Default built-in assistants seeded on every startup.
pub fn builtin_assistants() -> Vec<UpsertAssistant> {
    vec![
        UpsertAssistant {
            id: Some("builtin-coder".to_string()),
            name: I18nString::new("代码助手", "Code Assistant"),
            icon: "\u{1f4bb}".to_string(),
            description: I18nString::new(
                "专注于代码编写、调试和重构，支持多种编程语言。",
                "Specializes in code writing, debugging, and refactoring across multiple programming languages."
            ),
            model: String::new(),
            system_prompt: "You are a professional code assistant. Help users write high-quality code, debug issues, and perform code refactoring. Always provide clear code comments and explanations.".to_string(),
            tools: vec![
                "Read".to_string(),
                "Write".to_string(),
                "Edit".to_string(),
                "Bash".to_string(),
                "Grep".to_string(),
                "Glob".to_string(),
            ],
            disabled_tools: vec![],
            skills: vec![],
            is_builtin: true,
            sort_order: 0,
            input_config: None,
        },
        UpsertAssistant {
            id: Some("builtin-writer".to_string()),
            name: I18nString::new("写作助手", "Writing Assistant"),
            icon: "\u{270d}\u{fe0f}".to_string(),
            description: I18nString::new(
                "帮助撰写文章、邮件、报告，提升写作质量。",
                "Helps write articles, emails, and reports to improve writing quality."
            ),
            model: String::new(),
            system_prompt: "You are a professional writing assistant. Help users draft various types of documents, including articles, emails, and reports. Pay attention to the accuracy and fluency of language expression.".to_string(),
            tools: vec![
                "Read".to_string(),
                "Write".to_string(),
                "Edit".to_string(),
                "Grep".to_string(),
                "Glob".to_string(),
                "Google Translate".to_string(),
                "Baidu Translate".to_string(),
            ],
            disabled_tools: vec![],
            skills: vec![],
            is_builtin: true,
            sort_order: 1,
            input_config: None,
        },
        UpsertAssistant {
            id: Some("builtin-analyst".to_string()),
            name: I18nString::new("数据分析师", "Data Analyst"),
            icon: "\u{1f4ca}".to_string(),
            description: I18nString::new(
                "协助数据分析、可视化建议和统计解读。",
                "Assists with data analysis, visualization suggestions, and statistical interpretation."
            ),
            model: String::new(),
            system_prompt: "You are a professional data analyst assistant. Help users analyze data, provide visualization suggestions, interpret statistical results, and offer insightful, data-driven recommendations.".to_string(),
            tools: vec![
                "Read".to_string(),
                "Write".to_string(),
                "Edit".to_string(),
                "Bash".to_string(),
                "Grep".to_string(),
                "Glob".to_string(),
                "Math Calculator".to_string(),
            ],
            disabled_tools: vec![],
            skills: vec![],
            is_builtin: true,
            sort_order: 2,
            input_config: None,
        },
        UpsertAssistant {
            id: Some("builtin-computer-use".to_string()),
            name: I18nString::new("电脑操作助手", "Computer Use Assistant"),
            icon: "\u{1f5a5}".to_string(),
            description: I18nString::new(
                "具备沙盒环境下的电脑操作能力，支持安全的代码执行、网页浏览器、屏幕操控等。",
                "Equipped with computer-use capabilities in a sandbox, supporting safe code execution, web browser, screen control, etc."
            ),
            model: String::new(),
            system_prompt: "You are an assistant capable of interacting with a computer sandbox. You can execute code, open websites, and control the screen to help the user complete desktop tasks.".to_string(),
            tools: vec![
                "Browser".to_string(),
                "CodeExecution".to_string(),
                "ComputerUse".to_string(),
                "RequestHumanAssistance".to_string(),
                "SandboxExec".to_string(),
                "SandboxRead".to_string(),
                "SandboxWrite".to_string(),
                "SandboxEdit".to_string(),
            ],
            disabled_tools: vec![],
            skills: vec![],
            is_builtin: true,
            sort_order: 3,
            input_config: None,
        },
    ]
}
