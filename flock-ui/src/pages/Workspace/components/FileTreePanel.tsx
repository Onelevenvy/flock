import { useEffect, useState, useCallback } from 'react';
import {
  Box,
  Text,
  ScrollArea,
  Group,
  ActionIcon,
  Tooltip,
  Loader,
} from '@mantine/core';
import {
  IconFile,
  IconFolder,
  IconFolderOpen,
  IconRefresh,
  IconChevronRight,
  IconChevronDown,
  IconEye,
  IconCode,
  IconFileText,
  IconPhoto,
  IconFileTypeCss,
  IconFileTypeJs,
  IconFileTypeTs,
  IconBraces,
  IconMarkdown,
} from '@tabler/icons-react';
import { invoke } from '@tauri-apps/api/core';
import { useTranslation } from 'react-i18next';
import { useUiStore, FileEntry } from '../../../store/uiStore';
import { useWorkspaceStore } from '../../../store/workspaceStore';
import { useWorkspacesQuery } from '../../../hooks/useWorkspaces';


// ---- 文件图标 ----
function getFileIcon(name: string, extension?: string) {
  const ext = extension?.toLowerCase() || name.split('.').pop()?.toLowerCase() || '';
  const size = 14;
  switch (ext) {
    case 'ts':
    case 'tsx':
      return <IconFileTypeTs size={size} color="#3178c6" />;
    case 'js':
    case 'jsx':
    case 'mjs':
      return <IconFileTypeJs size={size} color="#f7df1e" />;
    case 'py':
      return <IconCode size={size} color="#3776ab" />;
    case 'css':
    case 'scss':
    case 'less':
      return <IconFileTypeCss size={size} color="#1572b6" />;
    case 'json':
    case 'toml':
    case 'yaml':
    case 'yml':
      return <IconBraces size={size} color="#f59e0b" />;
    case 'md':
    case 'mdx':
      return <IconMarkdown size={size} color="#6b7280" />;
    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'gif':
    case 'svg':
    case 'webp':
      return <IconPhoto size={size} color="#ec4899" />;
    case 'rs':
      return <IconCode size={size} color="#e57324" />;
    case 'html':
    case 'htm':
      return <IconCode size={size} color="#e34c26" />;
    case 'txt':
    case 'log':
      return <IconFileText size={size} color="#9ca3af" />;
    default:
      return <IconFile size={size} color="#6b7280" />;
  }
}

// ---- 文件大小格式化 ----
function formatSize(bytes?: number): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

// ---- 单条文件/目录条目 ----
function FileTreeItem({
  entry,
  depth,
  workspaceId,
}: {
  entry: FileEntry;
  depth: number;
  workspaceId: string;
}) {
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

        {!entry.is_dir && (
          <Group gap={4} style={{ flexShrink: 0, opacity: 0 }} className="file-actions">
            <Tooltip label={t('workspace.preview')} withArrow position="left">
              <ActionIcon size={16} variant="transparent" color="gray" onClick={(e) => { e.stopPropagation(); handlePreview(); }}>
                <IconEye size={12} />
              </ActionIcon>
            </Tooltip>
          </Group>
        )}

        {entry.size !== undefined && (
          <Text size="xs" c="dimmed" style={{ flexShrink: 0, fontSize: 10, marginLeft: 4 }}>
            {formatSize(entry.size)}
          </Text>
        )}
      </Box>

      {entry.is_dir && isExpanded && (
        <>
          {children.map((child) => (
            <FileTreeItem key={child.path} entry={child} depth={depth + 1} workspaceId={workspaceId} />
          ))}
          {children.length === 0 && !loading && (
            <Text
              size="xs"
              c="dimmed"
              style={{ paddingLeft: paddingLeft + 14, paddingBottom: 4, opacity: 0.5, fontSize: 11 }}
            >
              {t('workspace.emptyDir')}
            </Text>
          )}
        </>
      )}
    </>
  );
}

// ---- 文件树面板 ----
export function FileTreePanel() {
  const { t } = useTranslation();
  const { isFileTreeOpen, fileTreeRefreshKey, setFileTreeOpen } = useUiStore();
  const { activeWorkspaceId } = useWorkspaceStore();
  const { data: workspaces = [] } = useWorkspacesQuery();
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const loadFiles = useCallback(async () => {
    if (!activeWorkspaceId) {
      setFileTreeOpen(false);
      return;
    }
    setLoading(true);
    try {
      const items = await invoke<FileEntry[]>('list_workspace_files', {
        workspaceId: activeWorkspaceId,
        relativePath: '',
        recursive: false,
      });
      setFiles(items);
      if (items.length > 0) {
        setFileTreeOpen(true);
      } else {
        setFileTreeOpen(false);
      }
    } catch {
      setFiles([]);
      setFileTreeOpen(false);
    } finally {
      setLoading(false);
    }
  }, [activeWorkspaceId, setFileTreeOpen]);

  useEffect(() => {
    if (activeWorkspaceId) {
      loadFiles();
    }
  }, [activeWorkspaceId, fileTreeRefreshKey, loadFiles]);

  const activeWs = workspaces.find((w) => w.id === activeWorkspaceId);

  return (
    <Box
      style={{
        width: isFileTreeOpen ? 240 : 0,
        minWidth: isFileTreeOpen ? 240 : 0,
        height: '100%',
        background: 'var(--flock-bg-base)',
        border: isFileTreeOpen ? '1px solid var(--flock-border-subtle)' : 'none',
        borderRadius: isFileTreeOpen ? '16px' : '0',
        boxShadow: isFileTreeOpen ? '0 4px 20px rgba(0, 0, 0, 0.03)' : 'none',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        transition: 'all 0.2s ease',
        marginRight: isFileTreeOpen ? 0 : -12, // Offset the gap when closed
      }}
    >
      <Group
        justify="space-between"
        px={12}
        py={10}
        style={{ borderBottom: '1px solid var(--flock-border-dim)' }}
      >
        <Box>
          <Text size="xs" fw={600} style={{ color: 'var(--flock-text-secondary)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
            {t('workspace.file')}
          </Text>
          {activeWs && (
            <Text size="xs" c="dimmed" style={{ opacity: 0.5, fontSize: 10, marginTop: 1 }}>
              {activeWs.name}
            </Text>
          )}
        </Box>
        <Tooltip label={t('workspace.refresh')} withArrow>
          <ActionIcon
            size="xs"
            variant="subtle"
            onClick={loadFiles}
            loading={loading}
          >
            <IconRefresh size={13} />
          </ActionIcon>
        </Tooltip>
      </Group>

      {/* 文件树 */}
      <ScrollArea style={{ flex: 1 }} py={4}>
        {!activeWorkspaceId ? (
          <Box py={24} style={{ textAlign: 'center' }}>
            <Text size="xs" c="dimmed">{t('workspace.selectWorkspace')}</Text>
          </Box>
        ) : loading ? (
          <Box py={24} style={{ display: 'flex', justifyContent: 'center' }}>
            <Loader size="sm" />
          </Box>
        ) : files.length === 0 ? (
          <Box py={24} style={{ textAlign: 'center' }}>
            <Text size="xs" c="dimmed">{t('workspace.workspaceEmpty')}</Text>
          </Box>
        ) : (
          files.map((entry) => (
            <FileTreeItem
              key={entry.path}
              entry={entry}
              workspaceId={activeWorkspaceId}
              depth={0}
            />
          ))
        )}
      </ScrollArea>
    </Box>
  );
}
