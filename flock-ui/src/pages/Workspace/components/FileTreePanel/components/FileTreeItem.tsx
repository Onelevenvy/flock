import React, { useState, useCallback } from 'react';
import {
  Box,
  Text,
  Group,
  ActionIcon,
  Tooltip,
  Loader,
} from '@mantine/core';
import {
  IconFolder,
  IconFolderOpen,
  IconChevronRight,
  IconChevronDown,
  IconEye,
  IconTrash,
} from '@tabler/icons-react';
import { invoke } from '@tauri-apps/api/core';
import { useTranslation } from 'react-i18next';
import { useUiStore, FileEntry } from '../../../../../store/uiStore';
import { getFileIcon, formatSize } from '../utils';

interface FileTreeItemProps {
  entry: FileEntry;
  depth: number;
  workspaceId: string;
  onDelete?: (relativePath: string, name: string, isDir: boolean) => Promise<void>;
}

export function FileTreeItem({
  entry,
  depth,
  workspaceId,
  onDelete,
}: FileTreeItemProps) {
  const { t } = useTranslation();
  const { expandedDirs, toggleExpandDir, setPreviewFile } = useUiStore();
  const [children, setChildren] = useState<FileEntry[]>(entry.children || []);
  const [loading, setLoading] = useState(false);
  const isExpanded = expandedDirs.has(entry.path);

  const handleToggle = useCallback(async () => {
    if (!entry.is_dir) return;
    toggleExpandDir(entry.path);

    if (!isExpanded && children.length === 0) {
      setLoading(true);
      try {
        const items = await invoke<FileEntry[]>('list_workspace_files', {
          workspaceId,
          relativePath: entry.path,
          recursive: false,
        });
        setChildren(items);
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    }
  }, [entry, isExpanded, children.length, workspaceId, toggleExpandDir]);

  const handlePreview = useCallback(async () => {
    if (entry.is_dir) return;
    const previewableExts = ['txt', 'md', 'json', 'toml', 'yaml', 'yml', 'ts', 'tsx', 'js', 'jsx', 'py', 'rs', 'css', 'scss', 'html', 'htm', 'log'];
    const ext = entry.extension?.toLowerCase() || '';

    if (previewableExts.includes(ext)) {
      try {
        const content = await invoke<string>('read_workspace_file', {
          workspaceId,
          relativePath: entry.path,
        });
        setPreviewFile({ path: entry.path, content, extension: entry.extension });
      } catch {
        // ignore
      }
    } else {
      // Binary file (image, PDF, office, etc.) - load without fetching text content
      setPreviewFile({ path: entry.path, content: '', extension: entry.extension });
    }
  }, [entry, workspaceId, setPreviewFile]);

  const paddingLeft = depth * 14 + 8;

  return (
    <>
      <Box
        style={{
          display: 'flex',
          alignItems: 'center',
          paddingLeft,
          paddingRight: 8,
          height: 26,
          borderRadius: 6,
          cursor: entry.is_dir ? 'pointer' : 'default',
          transition: 'background 0.1s',
        }}
        className="file-item"
        onClick={entry.is_dir ? handleToggle : handlePreview}
      >
        {entry.is_dir ? (
          <>
            <Box style={{ width: 14, flexShrink: 0 }}>
              {loading ? (
                <Loader size={10} />
              ) : isExpanded ? (
                <IconChevronDown size={12} color="var(--flock-text-dim)" />
              ) : (
                <IconChevronRight size={12} color="var(--flock-text-dim)" />
              )}
            </Box>
            {isExpanded ? (
              <IconFolderOpen size={15} color="#f59e0b" style={{ marginRight: 5, flexShrink: 0 }} />
            ) : (
              <IconFolder size={15} color="#f59e0b" style={{ marginRight: 5, flexShrink: 0 }} />
            )}
          </>
        ) : (
          <>
            <Box style={{ width: 14, flexShrink: 0 }} />
            <Box style={{ marginRight: 5, flexShrink: 0 }}>
              {getFileIcon(entry.name, entry.extension)}
            </Box>
          </>
        )}

        <Text
          size="xs"
          style={{
            flex: 1,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            color: 'var(--flock-text-primary)',
          }}
        >
          {entry.name}
        </Text>

        <Group gap={4} style={{ flexShrink: 0, opacity: 0 }} className="file-actions">
          {!entry.is_dir && (
            <Tooltip label={t('chat.workspace.preview')} withArrow position="left">
              <ActionIcon size={16} variant="transparent" color="gray" onClick={(e) => { e.stopPropagation(); handlePreview(); }}>
                <IconEye size={12} />
              </ActionIcon>
            </Tooltip>
          )}
          <Tooltip label={t('chat.workspace.delete', '删除')} withArrow position="left">
            <ActionIcon
              size={16}
              variant="transparent"
              color="red"
              onClick={async (e) => {
                e.stopPropagation();
                if (onDelete) {
                  await onDelete(entry.path, entry.name, entry.is_dir);
                }
              }}
            >
              <IconTrash size={12} />
            </ActionIcon>
          </Tooltip>
        </Group>

        {entry.size !== undefined && (
          <Text size="xs" c="dimmed" style={{ flexShrink: 0, fontSize: 10, marginLeft: 4 }}>
            {formatSize(entry.size)}
          </Text>
        )}
      </Box>

      {entry.is_dir && isExpanded && (
        <>
          {children.map((child) => (
            <FileTreeItem
              key={child.path}
              entry={child}
              depth={depth + 1}
              workspaceId={workspaceId}
              onDelete={onDelete}
            />
          ))}
          {children.length === 0 && !loading && (
            <Text
              size="xs"
              c="dimmed"
              style={{ paddingLeft: paddingLeft + 14, paddingBottom: 4, opacity: 0.5, fontSize: 11 }}
            >
              {t('chat.workspace.emptyDir')}
            </Text>
          )}
        </>
      )}
    </>
  );
}
