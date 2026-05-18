use tauri::State;

use crate::SharedDbManager;

/// 获取数据库路径
#[tauri::command]
pub fn get_db_path(db: State<'_, SharedDbManager>) -> String {
    db.db_path().to_string_lossy().to_string()
}

/// 列出所有模型提供商
#[tauri::command]
pub async fn list_providers(
    db: State<'_, SharedDbManager>,
) -> Result<Vec<flock_core::db::ModelProvider>, String> {
    db.list_providers().await.map_err(|e| e.to_string())
}

/// 创建或更新模型提供商
#[tauri::command]
pub async fn upsert_provider(
    db: State<'_, SharedDbManager>,
    provider: flock_core::db::ModelProvider,
) -> Result<(), String> {
    db.upsert_provider(&provider).await.map_err(|e| e.to_string())
}

/// 删除模型提供商
#[tauri::command]
pub async fn delete_provider(
    db: State<'_, SharedDbManager>,
    id: String,
) -> Result<(), String> {
    db.delete_provider(&id).await.map_err(|e| e.to_string())
}

/// 列出指定提供商下的模型
#[tauri::command]
pub async fn list_models(
    db: State<'_, SharedDbManager>,
    provider_id: String,
) -> Result<Vec<flock_core::db::Model>, String> {
    db.list_models(&provider_id).await.map_err(|e| e.to_string())
}

/// 创建或更新模型
#[tauri::command]
pub async fn upsert_model(
    db: State<'_, SharedDbManager>,
    model: flock_core::db::Model,
) -> Result<(), String> {
    db.upsert_model(&model).await.map_err(|e| e.to_string())
}

/// 删除模型
#[tauri::command]
pub async fn delete_model(
    db: State<'_, SharedDbManager>,
    id: String,
) -> Result<(), String> {
    db.delete_model(&id).await.map_err(|e| e.to_string())
}

/// 测试 Provider 连通性
#[tauri::command]
pub async fn test_provider_connection(
    db: State<'_, SharedDbManager>,
    provider_id: String,
) -> Result<String, String> {
    use langgraph_prebuilt::BaseChatModel;
    use flock_core::model_factory::{create_model, ModelProviderParams};

    // 1. 从数据库获取 provider 信息
    let provider = db.get_provider(&provider_id).await
        .map_err(|e| format!("获取 Provider 失败: {}", e))?
        .ok_or_else(|| format!("Provider '{}' 不存在", provider_id))?;

    let api_key = provider.api_key
        .ok_or("该 Provider 未配置 API Key")?;

    if api_key.is_empty() {
        return Err("该 Provider 未配置 API Key".to_string());
    }

    let base_url = provider.base_url.clone()
        .unwrap_or_else(|| "https://api.openai.com".to_string());

    // 2. 确定用于测试的模型名称
    let test_model = if let Some(tm) = provider.test_model {
        if !tm.is_empty() {
            tm
        } else {
            pick_heuristic_model(&db, &provider_id).await
        }
    } else {
        pick_heuristic_model(&db, &provider_id).await
    };

    // 3. 创建模型并测试
    let model = create_model(ModelProviderParams {
        provider_type: provider.provider_type.clone(),
        model: test_model.clone(),
        api_key: api_key.clone(),
        base_url: Some(base_url.clone()),
        max_tokens: Some(64),
    }).map_err(|e| format!("创建模型失败: {}", e))?;

    let test_msg = langgraph_prebuilt::Message::Human {
        content: langgraph_prebuilt::MessageContent::Text("Hi, reply with just 'OK'.".to_string()),
        id: None,
    };

    let config = std::collections::HashMap::new();
    match model.invoke(&[test_msg], &config) {
        Ok(_response) => {
            Ok(format!("连接成功! 使用模型: {}, Base URL: {}", test_model, base_url))
        }
        Err(e) => {
            Err(format!("连接失败 (使用模型 {}): {}", test_model, e))
        }
    }
}

/// 激活 Provider：测试连通性，成功后开启该 Provider 下的所有模型并标记为可用
/// 失败时将模型和 Provider 标记为不可用
#[tauri::command]
pub async fn activate_provider(
    db: State<'_, SharedDbManager>,
    provider_id: String,
) -> Result<String, String> {
    let db_inner = db.inner().clone();

    // 1. 测试连通性
    match test_provider_connection(db.clone(), provider_id.clone()).await {
        Ok(res) => {
            // 2. 连通性测试通过，开启该 Provider 下的所有模型
            let models = db_inner.list_models(&provider_id).await
                .map_err(|e| format!("获取模型列表失败: {}", e))?;

            for mut model in models {
                if !model.is_online {
                    model.is_online = true;
                    db_inner.upsert_model(&model).await
                        .map_err(|e| format!("更新模型 '{}' 状态失败: {}", model.model_name, e))?;
                }
            }

            // 3. 确保 Provider 标记为可用
            if let Ok(Some(mut provider)) = db_inner.get_provider(&provider_id).await {
                if !provider.is_available {
                    provider.is_available = true;
                    db_inner.upsert_provider(&provider).await
                        .map_err(|e| format!("更新 Provider 状态失败: {}", e))?;
                }
            }

            Ok(res)
        }
        Err(e) => {
            // 测试失败，将模型和 Provider 标记为不可用
            if let Ok(models) = db_inner.list_models(&provider_id).await {
                for mut model in models {
                    if model.is_online {
                        model.is_online = false;
                        let _ = db_inner.upsert_model(&model).await;
                    }
                }
            }
            if let Ok(Some(mut provider)) = db_inner.get_provider(&provider_id).await {
                if provider.is_available {
                    provider.is_available = false;
                    let _ = db_inner.upsert_provider(&provider).await;
                }
            }

            Err(format!("连接失败: {}", e))
        }
    }
}

async fn pick_heuristic_model(db: &flock_core::db::DbManager, provider_id: &str) -> String {
    let models = db.list_models(provider_id).await.unwrap_or_default();

    if provider_id == "zhipuai" {
        models.iter()
            .find(|m| m.model_name == "glm-4-flash")
            .map(|m| m.model_name.clone())
            .or_else(|| models.first().map(|m| m.model_name.clone()))
            .unwrap_or_else(|| "glm-4-flash".to_string())
    } else {
        models.iter()
            .find(|m| {
                let name = m.model_name.to_lowercase();
                name.contains("flash") || name.contains("mini") || name.contains("haiku")
            })
            .map(|m| m.model_name.clone())
            .or_else(|| models.first().map(|m| m.model_name.clone()))
            .unwrap_or_else(|| "gpt-4o-mini".to_string())
    }
}

/// 获取当前活跃的模型配置
#[tauri::command]
pub async fn get_active_model(
    db: State<'_, SharedDbManager>,
) -> Result<Option<serde_json::Value>, String> {
    let config: Option<serde_json::Value> = db.get_config("active_model").await;
    Ok(config)
}

/// 设置当前活跃的模型
#[tauri::command]
pub async fn set_active_model(
    db: State<'_, SharedDbManager>,
    provider_id: String,
    model_name: String,
) -> Result<(), String> {
    let active = serde_json::json!({
        "provider_id": provider_id,
        "model_name": model_name,
    });
    db.set_config("active_model", &active).await
        .map_err(|e| format!("保存活跃模型失败: {}", e))
}

/// 创建自定义模型并加密其专属 API Key
#[tauri::command]
pub async fn upsert_custom_model(
    db: State<'_, SharedDbManager>,
    provider_id: String,
    model_name: String,
    base_url: String,
    api_key: String,
) -> Result<(), String> {
    let db_inner = db.inner().clone();
    
    // Encrypt the custom API key
    let salt = db_inner.get_or_create_salt().await
        .map_err(|e| format!("无法获取加密盐: {}", e))?;
    
    let (encrypted_key, nonce) = flock_core::crypto::encrypt_value(&api_key, &salt)
        .map_err(|e| format!("加密失败: {}", e))?;

    let meta = serde_json::json!({
        "base_url": base_url,
        "api_key_encrypted": encrypted_key,
        "api_key_nonce": nonce,
    });

    let model = flock_core::db::Model {
        id: format!("{}:{}", provider_id, model_name),
        provider_id: provider_id.clone(),
        model_name,
        categories: vec!["chat".to_string()],
        capabilities: vec![],
        is_online: true,
        meta: Some(meta),
        created_at: String::new(), // Will be handled by DB
        updated_at: String::new(),
    };

    db_inner.upsert_model(&model).await
        .map_err(|e| format!("保存自定义模型失败: {}", e))?;

    // 联动激活 Provider 外壳状态
    if let Ok(Some(mut provider)) = db_inner.get_provider(&provider_id).await {
        if !provider.is_available {
            provider.is_available = true;
            let _ = db_inner.upsert_provider(&provider).await;
        }
    }

    Ok(())
}

/// 测试自定义模型连通性（不保存到数据库）
#[tauri::command]
pub async fn test_custom_model_connection(
    db: State<'_, SharedDbManager>,
    provider_id: String,
    model_name: String,
    base_url: String,
    api_key: String,
) -> Result<String, String> {
    let db_inner = db.inner().clone();
    
    // 1. 获取 provider 以得知 provider_type
    let provider = db_inner.get_provider(&provider_id).await
        .map_err(|e| format!("数据库错误: {}", e))?
        .ok_or_else(|| "找不到该提供商".to_string())?;

    // 2. 构造测试模型
    use flock_core::model_factory::{create_model, ModelProviderParams};
    let model = create_model(ModelProviderParams {
        provider_type: provider.provider_type,
        model: model_name.clone(),
        api_key,
        base_url: Some(base_url),
        max_tokens: Some(64),
    }).map_err(|e| format!("创建模型实例失败: {}", e))?;

    let test_msg = langgraph_prebuilt::Message::Human {
        content: langgraph_prebuilt::MessageContent::Text("Hi, reply with just 'OK'.".to_string()),
        id: None,
    };

    let config = std::collections::HashMap::new();
    match model.invoke(&[test_msg], &config) {
        Ok(_) => Ok("连接成功!".to_string()),
        Err(e) => Err(format!("连接失败: {}", e)),
    }
}
