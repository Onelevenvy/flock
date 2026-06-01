use std::path::{Path, PathBuf};
use futures::future::join_all;

use crate::bundled;
use crate::mcp::load_mcp_skills;
use crate::paths::{
    additional_skills_dirs, project_commands_dirs, project_skills_dirs, user_commands_dir,
    user_skills_dir, workspace_skills_dir,
};
use crate::types::{LoadChannel, SkillMetadata, SkillSource};
use flock_tools::mcp::manager::McpManager;

use super::types::LoadedSkill;
use super::fs::{load_skills_from_dir, load_skills_from_commands_dir};
use super::utils::{deduplicate, deduplicate_by_name};

pub async fn load_all_skills(
    cwd: &Path,
    add_dirs: &[PathBuf],
    bare: bool,
    mcp_manager: Option<&McpManager>,
    extra_raw_dirs: &[PathBuf],
) -> Vec<SkillMetadata> {
    let bundled_loaded = prepare_bundled_loaded().await;

    let mut all: Vec<LoadedSkill> = Vec::new();

    if bare {
        let dirs = additional_skills_dirs(add_dirs);
        let futures: Vec<_> = dirs
            .iter()
            .map(|d| load_skills_from_dir(d, SkillSource::Project, LoadChannel::Skills))
            .collect();
        for batch in join_all(futures).await {
            all.extend(batch);
        }
        let futures: Vec<_> = extra_raw_dirs
            .iter()
            .filter(|d| d.is_dir())
            .map(|d| load_skills_from_dir(d, SkillSource::User, LoadChannel::Skills))
            .collect();
        for batch in join_all(futures).await {
            all.extend(batch);
        }
        all.splice(0..0, bundled_loaded);
        let final_skills = deduplicate_by_name(deduplicate(all));
        // log::info!("===== [Flock Skills] Loaded {} skills (bare) =====", final_skills.len());
        // for skill in &final_skills {
        //     log::info!("  - Name: '{}', Context: {:?}, Source: {:?}", skill.name, skill.execution_context, skill.source);
        // }
        // log::info!("==================================================");
        return final_skills;
    }

    if let Some(dir) = user_skills_dir()
        && dir.is_dir()
    {
        all.extend(load_skills_from_dir(&dir, SkillSource::User, LoadChannel::Skills).await);
    }

    let ws_dir = workspace_skills_dir();
    if ws_dir.is_dir() {
        all.extend(load_skills_from_dir(&ws_dir, SkillSource::Bundled, LoadChannel::Skills).await);
    }

    let project_dirs = project_skills_dirs(cwd);
    let futures: Vec<_> = project_dirs
        .iter()
        .map(|d| load_skills_from_dir(d, SkillSource::Project, LoadChannel::Skills))
        .collect();
    for batch in join_all(futures).await {
        all.extend(batch);
    }

    let add_skill_dirs = additional_skills_dirs(add_dirs);
    let futures: Vec<_> = add_skill_dirs
        .iter()
        .map(|d| load_skills_from_dir(d, SkillSource::Project, LoadChannel::Skills))
        .collect();
    for batch in join_all(futures).await {
        all.extend(batch);
    }

    let futures: Vec<_> = extra_raw_dirs
        .iter()
        .filter(|d| d.is_dir())
        .map(|d| load_skills_from_dir(d, SkillSource::User, LoadChannel::Skills))
        .collect();
    for batch in join_all(futures).await {
        all.extend(batch);
    }

    if let Some(dir) = user_commands_dir()
        && dir.is_dir()
    {
        all.extend(load_skills_from_commands_dir(&dir, SkillSource::User).await);
    }

    let cmd_dirs = project_commands_dirs(cwd);
    let futures: Vec<_> = cmd_dirs
        .iter()
        .map(|d| load_skills_from_commands_dir(d, SkillSource::Project))
        .collect();
    for batch in join_all(futures).await {
        all.extend(batch);
    }

    let mcp_loaded = match mcp_manager {
        Some(mgr) => load_mcp_skills(mgr).await,
        None => Vec::new(),
    };

    all.splice(0..0, mcp_loaded);
    all.splice(0..0, bundled_loaded);

    let final_skills = deduplicate_by_name(deduplicate(all));
    // log::info!("===== [Flock Skills] Loaded {} skills =====", final_skills.len());
    // for skill in &final_skills {
    //     log::info!("  - Name: '{}', Context: {:?}, Source: {:?}", skill.name, skill.execution_context, skill.source);
    // }
    // log::info!("=============================================");
    final_skills
}

async fn prepare_bundled_loaded() -> Vec<LoadedSkill> {
    bundled::extract_bundled_skills()
        .await
        .into_iter()
        .map(|meta| {
            let virtual_path = PathBuf::from(format!("<bundled:{}>", meta.name));
            LoadedSkill {
                metadata: meta,
                resolved_path: virtual_path,
            }
        })
        .collect()
}
