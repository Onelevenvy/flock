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
                            "systemMessage": "你是一个幽默风趣的段子手，擅长写各种轻松搞笑的幽默段子。",
                            "userMessage": "请根据主题：\"{{input_msg}}\" 写一个简短好笑的冷笑话或段子."
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
                            "systemMessage": "你是一个专业的幽默文学编辑。负责润色笑话，并为其添加简短而风趣的评语。",
                            "userMessage": "请对以下段子进行排版、精简或润色，使其更加好笑，并在最后加上一行逗趣的[小编点评]：\n\n{{node_outputs.llm_generate.response}}"
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
                            "systemMessage": "你是一个高水平的翻译专家。直接将用户输入的非中文文本翻译成地道的中文；如果已经是中文，则对其进行错别字修正和润色。只输出翻译或修正后的文本，不要带有任何多余的解释。",
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
                                { "category_id": "tech", "category_name": "科技与编程" },
                                { "category_id": "life", "category_name": "生活与娱乐" },
                                { "category_id": "others_category", "category_name": "其他" }
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
                            "answer": "【分类：科技】\n\n智能翻译结果：\n{{node_outputs.llm_translate.response}}"
                        }
                    },
                    {
                        "id": "ans_life",
                        "type": "answer",
                        "position": { "x": 1080, "y": 250 },
                        "width": 240,
                        "height": 85,
                        "data": {
                            "answer": "【分类：生活娱乐】\n\n智能翻译结果：\n{{node_outputs.llm_translate.response}}"
                        }
                    },
                    {
                        "id": "ans_other",
                        "type": "answer",
                        "position": { "x": 1080, "y": 400 },
                        "width": 240,
                        "height": 85,
                        "data": {
                            "answer": "【分类：其他】\n\n智能翻译结果：\n{{node_outputs.llm_translate.response}}"
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

