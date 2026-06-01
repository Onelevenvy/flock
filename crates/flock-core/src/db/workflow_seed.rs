use serde_json::json;
use crate::types::tool::I18nString;
use super::workflow::UpsertWorkflow;

/// Default built-in workflows seeded on every startup.
pub fn builtin_workflows() -> Vec<UpsertWorkflow> {
    vec![
        UpsertWorkflow {
            id: Some("builtin-wf-joke-teller".to_string()),
            name: I18nString::new("每日幽默段子生成器", "Daily Joke Generator"),
            description: I18nString::new(
                "接收用户的指令，生成一个有创意的幽默段子，并由另一个LLM节点进行评分和润色。",
                "Receives user instructions, generates a creative joke, and has another LLM node polish and rate it."
            ),
            is_active: true,
            config: json!({
                "nodes": [
                    {
                        "id": "start",
                        "type": "start",
                        "position": { "x": 50, "y": 200 },
                        "width": 240,
                        "height": 46,
                        "data": {}
                    },
                    {
                        "id": "llm_generate",
                        "type": "llm",
                        "position": { "x": 400, "y": 200 },
                        "width": 240,
                        "height": 85,
                        "data": {
                            "model": "",
                            "temperature": 0.8,
                            "systemMessage": "You are a witty and humorous humorist who specializes in writing lighthearted, funny, and creative jokes.",
                            "userMessage": "Please write a short and funny joke or one-liner based on the theme: \"{{input_msg}}\"."
                        }
                    },
                    {
                        "id": "llm_polish",
                        "type": "llm",
                        "position": { "x": 750, "y": 200 },
                        "width": 240,
                        "height": 85,
                        "data": {
                            "model": "",
                            "temperature": 0.5,
                            "systemMessage": "You are a professional literary editor for comedy. You polish jokes to make them flow better, and append a short, witty editor's commentary.",
                            "userMessage": "Please format, streamline, or polish the following joke to make it even funnier, and add a witty [Editor's Note] at the very end:\n\n{{node_outputs.llm_generate.response}}"
                        }
                    },
                    {
                        "id": "answer",
                        "type": "answer",
                        "position": { "x": 1100, "y": 200 },
                        "width": 240,
                        "height": 85,
                        "data": {
                            "answer": "{{node_outputs.llm_polish.response}}"
                        }
                    }
                ],
                "edges": [
                    {
                        "id": "e_start_gen",
                        "source": "start",
                        "target": "llm_generate",
                        "sourceHandle": "right",
                        "targetHandle": "left"
                    },
                    {
                        "id": "e_gen_polish",
                        "source": "llm_generate",
                        "target": "llm_polish",
                        "sourceHandle": "right",
                        "targetHandle": "left"
                    },
                    {
                        "id": "e_polish_ans",
                        "source": "llm_polish",
                        "target": "answer",
                        "sourceHandle": "right",
                        "targetHandle": "left"
                    }
                ]
            })
        },
        UpsertWorkflow {
            id: Some("builtin-wf-smart-translator".to_string()),
            name: I18nString::new("多语言智能翻译与分类器", "Smart Translator & Classifier"),
            description: I18nString::new(
                "首先将输入的任意语言文本翻译为中文，再利用分类器判断文本的类型（如技术、娱乐、其他），提供全自动处理流。",
                "Translates any source text to Chinese first, then classifies the topic (e.g. tech, life, other) for automatic routing."
            ),
            is_active: true,
            config: json!({
                "nodes": [
                    {
                        "id": "start",
                        "type": "start",
                        "position": { "x": 50, "y": 250 },
                        "width": 240,
                        "height": 46,
                        "data": {}
                    },
                    {
                        "id": "llm_translate",
                        "type": "llm",
                        "position": { "x": 380, "y": 250 },
                        "width": 240,
                        "height": 85,
                        "data": {
                            "model": "",
                            "temperature": 0.3,
                            "systemMessage": "You are a professional translator. Directly translate the user's input text into fluent, natural English. If it is already in English, correct any grammar mistakes and polish it. Output ONLY the translated or polished text without any extra explanation.",
                            "userMessage": "{{input_msg}}"
                        }
                    },
                    {
                        "id": "classifier_topic",
                        "type": "classifier",
                        "position": { "x": 720, "y": 250 },
                        "width": 240,
                        "height": 120,
                        "data": {
                            "model": "",
                            "input": "{{node_outputs.llm_translate.response}}",
                            "categories": [
                                { "category_id": "tech", "category_name": "Technology & Coding" },
                                { "category_id": "life", "category_name": "Life & Entertainment" },
                                { "category_id": "others_category", "category_name": "Others" }
                            ]
                        }
                    },
                    {
                        "id": "ans_tech",
                        "type": "answer",
                        "position": { "x": 1080, "y": 100 },
                        "width": 240,
                        "height": 85,
                        "data": {
                            "answer": "[Category: Technology]\n\nSmart Translation Result:\n{{node_outputs.llm_translate.response}}"
                        }
                    },
                    {
                        "id": "ans_life",
                        "type": "answer",
                        "position": { "x": 1080, "y": 250 },
                        "width": 240,
                        "height": 85,
                        "data": {
                            "answer": "[Category: Life & Entertainment]\n\nSmart Translation Result:\n{{node_outputs.llm_translate.response}}"
                        }
                    },
                    {
                        "id": "ans_other",
                        "type": "answer",
                        "position": { "x": 1080, "y": 400 },
                        "width": 240,
                        "height": 85,
                        "data": {
                            "answer": "[Category: Others]\n\nSmart Translation Result:\n{{node_outputs.llm_translate.response}}"
                        }
                    }
                ],
                "edges": [
                    {
                        "id": "e_start_trans",
                        "source": "start",
                        "target": "llm_translate",
                        "sourceHandle": "right",
                        "targetHandle": "left"
                    },
                    {
                        "id": "e_trans_class",
                        "source": "llm_translate",
                        "target": "classifier_topic",
                        "sourceHandle": "right",
                        "targetHandle": "left"
                    },
                    {
                        "id": "e_class_tech",
                        "source": "classifier_topic",
                        "target": "ans_tech",
                        "sourceHandle": "tech",
                        "targetHandle": "left"
                    },
                    {
                        "id": "e_class_life",
                        "source": "classifier_topic",
                        "target": "ans_life",
                        "sourceHandle": "life",
                        "targetHandle": "left"
                    },
                    {
                        "id": "e_class_other",
                        "source": "classifier_topic",
                        "target": "ans_other",
                        "sourceHandle": "others_category",
                        "targetHandle": "left"
                    }
                ]
            })
        }
    ]
}

