use std::collections::HashSet;
use std::path::Path;

use crate::frontmatter::{parse_frontmatter, parse_skill_fields};
use crate::types::{LoadChannel, SkillSource};
use super::types::LoadedSkill;
use super::utils::{find_exact_file, try_canonicalize};

pub(crate) async fn load_skills_from_dir(
    base_dir: &Path,
    source: SkillSource,
    loaded_from: LoadChannel,
) -> Vec<LoadedSkill> {
    let mut results = Vec::new();
    if let Some(skill_file) = find_exact_file(base_dir, "SKILL.md").await {
        if let Some(skill) =
            load_skill_file(&skill_file, base_dir, base_dir, source, loaded_from).await
        {
            results.push(skill);
            return results;
        }
    }
    collect_skill_md(base_dir, base_dir, source, loaded_from, &mut results).await;
    results
}

fn collect_skill_md<'a>(
    base_dir: &'a Path,
    dir: &'a Path,
    source: SkillSource,
    loaded_from: LoadChannel,
    results: &'a mut Vec<LoadedSkill>,
) -> std::pin::Pin<Box<dyn std::future::Future<Output = ()> + Send + 'a>> {
    Box::pin(async move {
        let mut read_dir = match tokio::fs::read_dir(dir).await {
            Ok(rd) => rd,
            Err(_) => return,
        };

        while let Ok(Some(entry)) = read_dir.next_entry().await {
            let path = entry.path();
            let is_dir = match tokio::fs::metadata(&path).await {
                Ok(meta) => meta.is_dir(),
                Err(_) => continue,
            };

            if is_dir {
                if let Some(skill_file) = find_exact_file(&path, "SKILL.md").await {
                    if let Some(skill) =
                        load_skill_file(&skill_file, base_dir, &path, source, loaded_from).await
                    {
                        results.push(skill);
                    }
                } else {
                    collect_skill_md(base_dir, &path, source, loaded_from, results).await;
                }
            }
        }
    })
}

pub(crate) async fn load_skills_from_commands_dir(base_dir: &Path, source: SkillSource) -> Vec<LoadedSkill> {
    let mut results = Vec::new();
    collect_commands(base_dir, base_dir, source, &mut results).await;
    results
}

fn collect_commands<'a>(
    base_dir: &'a Path,
    dir: &'a Path,
    source: SkillSource,
    results: &'a mut Vec<LoadedSkill>,
) -> std::pin::Pin<Box<dyn std::future::Future<Output = ()> + Send + 'a>> {
    Box::pin(async move {
        let mut read_dir = match tokio::fs::read_dir(dir).await {
            Ok(rd) => rd,
            Err(_) => return,
        };

        let mut entries = Vec::new();
        while let Ok(Some(entry)) = read_dir.next_entry().await {
            entries.push(entry);
        }

        let mut dir_names: HashSet<String> = HashSet::new();

        for entry in &entries {
            let path = entry.path();
            let is_dir = match tokio::fs::metadata(&path).await {
                Ok(meta) => meta.is_dir(),
                Err(_) => continue,
            };

            if is_dir {
                if let Some(skill_file) = find_exact_file(&path, "SKILL.md").await {
                    if let Some(skill) = load_skill_file(
                        &skill_file,
                        base_dir,
                        &path,
                        source,
                        LoadChannel::CommandsDeprecated,
                    )
                    .await
                    {
                        let name = path
                            .file_name()
                            .map(|n| n.to_string_lossy().into_owned())
                            .unwrap_or_default();
                        dir_names.insert(name);
                        results.push(skill);
                    }
                } else {
                    collect_commands(base_dir, &path, source, results).await;
                }
            }
        }

        for entry in &entries {
            let path = entry.path();
            let is_file = match tokio::fs::metadata(&path).await {
                Ok(meta) => meta.is_file(),
                Err(_) => continue,
            };

            if is_file && path.extension().and_then(|e| e.to_str()) == Some("md") {
                let stem = path
                    .file_stem()
                    .map(|s| s.to_string_lossy().into_owned())
                    .unwrap_or_default();

                if dir_names.contains(&stem) {
                    continue;
                }

                let pseudo_dir = path.parent().unwrap_or(base_dir).join(&stem);
                if let Some(skill) = load_skill_file(
                    &path,
                    base_dir,
                    &pseudo_dir,
                    source,
                    LoadChannel::CommandsDeprecated,
                )
                .await
                {
                    results.push(skill);
                }
            }
        }
    })
}

pub(crate) async fn load_skill_file(
    file_path: &Path,
    base_dir: &Path,
    skill_dir: &Path,
    source: SkillSource,
    loaded_from: LoadChannel,
) -> Option<LoadedSkill> {
    let content = tokio::fs::read_to_string(file_path).await.ok()?;
    let parsed = parse_frontmatter(&content);

    let resolved_name = build_skill_namespace(base_dir, skill_dir);
    let skill_root = Some(skill_dir.to_string_lossy().into_owned());

    let metadata = parse_skill_fields(
        &parsed.frontmatter,
        &parsed.content,
        &resolved_name,
        source,
        loaded_from,
        skill_root.as_deref(),
    );

    let resolved_path = try_canonicalize(file_path).unwrap_or_else(|| file_path.to_owned());

    Some(LoadedSkill {
        metadata,
        resolved_path,
    })
}

pub(crate) fn build_skill_namespace(base_dir: &Path, target_dir: &Path) -> String {
    match target_dir.strip_prefix(base_dir) {
        Ok(relative) => relative
            .components()
            .map(|c| c.as_os_str().to_string_lossy().into_owned())
            .collect::<Vec<_>>()
            .join(":"),
        Err(_) => target_dir
            .file_name()
            .map(|n| n.to_string_lossy().into_owned())
            .unwrap_or_default(),
    }
}
