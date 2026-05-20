import { useState, useCallback, useRef } from 'react';
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
  IconSearch,
  IconFilePlus,
  IconFolderPlus,
  IconUpload,
  IconTrash,
} from '@tabler/icons-react';
import { invoke } from '@tauri-apps/api/core';
import { useTranslation } from 'react-i18next';
import { useUiStore, FileEntry } from '../../../store/uiStore';
import { useWorkspaceStore } from '../../../store/workspaceStore';
import { useWorkspacesQuery } from '../../../hooks/useWorkspaces';
import { useWorkspaceFiles } from '../../../hooks/useWorkspaceFiles';


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
  onDelete,
}: {
  entry: FileEntry;
  depth: number;
  workspaceId: string;
  onDelete?: (relativePath: string, name: string, isDir: boolean) => Promise<void>;
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

// ---- 文件树面板 ----
export function FileTreePanel() {
  const { t } = useTranslation();
  const { isFileTreeOpen } = useUiStore();
  const { activeWorkspaceId } = useWorkspaceStore();
  const { data: workspaces = [] } = useWorkspacesQuery();

  const {
    files,
    loading,
    loadFiles,
    createFile,
    createDirectory,
    uploadFile,
    deleteFileOrDir,
  } = useWorkspaceFiles(activeWorkspaceId);

  // 新建文件和文件夹状态
  const [isCreating, setIsCreating] = useState<'file' | 'dir' | null>(null);
  const [createInput, setCreateInput] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 搜索相关状态
  const [showSearchInput, setShowSearchInput] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const activeWs = workspaces.find((w) => w.id === activeWorkspaceId);

  // 新建提交
  const handleCreateKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setIsCreating(null);
      setCreateInput('');
    } else if (e.key === 'Enter') {
      if (!createInput.trim()) {
        setIsCreating(null);
        return;
      }
      if (isCreating === 'file') {
        await createFile(createInput.trim());
      } else {
        await createDirectory(createInput.trim());
      }
      setIsCreating(null);
      setCreateInput('');
    }
  };

  // 上传文件
  const handleUploadClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await uploadFile(file);
    e.target.value = '';
  };

  // 简易前端文件搜索过滤
  const filterFiles = (list: FileEntry[]): FileEntry[] => {
    if (!searchQuery.trim()) return list;
    const query = searchQuery.toLowerCase();

    const recursiveFilter = (items: FileEntry[]): FileEntry[] => {
      return items
        .map((item) => {
          if (item.is_dir) {
            const childList = item.children ? recursiveFilter(item.children) : [];
            const isMatch = item.name.toLowerCase().includes(query);
            if (isMatch || childList.length > 0) {
              return { ...item, children: childList };
            }
            return null;
          } else {
            const isMatch = item.name.toLowerCase().includes(query);
            return isMatch ? item : null;
          }
        })
        .filter((item): item is FileEntry => item !== null);
    };

    return recursiveFilter(list);
  };

  const displayFiles = filterFiles(files);

  return (
    <Box
      style={{
        width: isFileTreeOpen ? 260 : 0,
        minWidth: isFileTreeOpen ? 260 : 0,
        height: '100%',
        background: 'var(--flock-bg-base)',
        border: isFileTreeOpen ? '1px solid var(--flock-border-subtle)' : 'none',
        borderRadius: isFileTreeOpen ? '16px' : '0',
        boxShadow: isFileTreeOpen ? '0 4px 20px rgba(0, 0, 0, 0.03)' : 'none',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        transition: 'all 0.2s ease',
        marginRight: isFileTreeOpen ? 0 : -12,
      }}
    >
      {/* 隐藏的上传 Input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />

      <Group
        justify="space-between"
        px={12}
        py={10}
        style={{ borderBottom: '1px solid var(--flock-border-dim)', flexShrink: 0 }}
      >
        <Box style={{ flex: 1, minWidth: 0 }}>
          <Text size="xs" fw={700} style={{ color: 'var(--flock-text-secondary)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
            {t('sidebar.workspace')}
          </Text>
          {activeWs && (
            <Text size="xs" c="dimmed" style={{ opacity: 0.5, fontSize: 10, marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {activeWs.name}
            </Text>
          )}
        </Box>

        <Group gap={4} style={{ flexShrink: 0 }}>
          <Tooltip label={t('chat.workspace.searchFiles')} withArrow>
            <ActionIcon
              size="sm"
              variant={showSearchInput ? "light" : "subtle"}
              color="gray"
              onClick={() => {
                setShowSearchInput(!showSearchInput);
                if (showSearchInput) setSearchQuery('');
              }}
            >
              <IconSearch size={14} />
            </ActionIcon>
          </Tooltip>

          <Tooltip label={t('chat.workspace.newFile')} withArrow>
            <ActionIcon
              size="sm"
              variant="subtle"
              color="gray"
              onClick={() => {
                setIsCreating('file');
                setShowSearchInput(false);
                setSearchQuery('');
              }}
            >
              <IconFilePlus size={14} />
            </ActionIcon>
          </Tooltip>

          <Tooltip label={t('chat.workspace.newFolder')} withArrow>
            <ActionIcon
              size="sm"
              variant="subtle"
              color="gray"
              onClick={() => {
                setIsCreating('dir');
                setShowSearchInput(false);
                setSearchQuery('');
              }}
            >
              <IconFolderPlus size={14} />
            </ActionIcon>
          </Tooltip>

          <Tooltip label={t('chat.workspace.uploadFile')} withArrow>
            <ActionIcon
              size="sm"
              variant="subtle"
              color="gray"
              onClick={handleUploadClick}
            >
              <IconUpload size={14} />
            </ActionIcon>
          </Tooltip>

          <Tooltip label={t('chat.workspace.refresh')} withArrow>
            <ActionIcon
              size="sm"
              variant="subtle"
              color="gray"
              onClick={loadFiles}
              loading={loading}
            >
              <IconRefresh size={14} />
            </ActionIcon>
          </Tooltip>
        </Group>
      </Group>

      {/* 搜索输入框 */}
      {showSearchInput && (
        <Box px={12} py={6} style={{ borderBottom: '1px solid var(--flock-border-dim)', flexShrink: 0 }}>
          <input
            autoFocus
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('chat.workspace.searchFiles')}
            style={{
              width: '100%',
              padding: '5px 8px',
              borderRadius: '6px',
              border: '1px solid var(--flock-border-dim)',
              background: 'var(--flock-bg-surface)',
              color: 'var(--flock-text-primary)',
              fontSize: '11px',
              outline: 'none',
            }}
          />
        </Box>
      )}

      {/* 文件树内容 */}
      <ScrollArea style={{ flex: 1 }} py={4}>
        {!activeWorkspaceId ? (
          <Box py={24} style={{ textAlign: 'center' }}>
            <Text size="xs" c="dimmed">{t('chat.workspace.selectWorkspace')}</Text>
          </Box>
        ) : loading && files.length === 0 ? (
          <Box py={24} style={{ display: 'flex', justifyContent: 'center' }}>
            <Loader size="sm" />
          </Box>
        ) : (
          <>
            {/* 新建输入行 */}
            {isCreating && (
              <Box
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  paddingLeft: 8,
                  paddingRight: 8,
                  height: 28,
                  borderRadius: 6,
                  background: 'var(--flock-bg-hover)',
                  margin: '2px 8px',
                  border: '1px solid var(--flock-accent)',
                }}
              >
                {isCreating === 'dir' ? (
                  <IconFolder size={14} color="#f59e0b" style={{ marginRight: 5, flexShrink: 0 }} />
                ) : (
                  <IconFile size={14} color="#6b7280" style={{ marginRight: 5, flexShrink: 0 }} />
                )}
                <input
                  autoFocus
                  value={createInput}
                  onChange={(e) => setCreateInput(e.target.value)}
                  onKeyDown={handleCreateKeyDown}
                  onBlur={() => {
                    setTimeout(() => {
                      setIsCreating(null);
                      setCreateInput('');
                    }, 200);
                  }}
                  placeholder={isCreating === 'dir' ? `${t('chat.workspace.newFolder')}...` : `${t('chat.workspace.newFile')}...`}
                  style={{
                    flex: 1,
                    background: 'transparent',
                    border: 'none',
                    outline: 'none',
                    color: 'var(--flock-text-primary)',
                    fontSize: '12px',
                    padding: '2px 0',
                  }}
                />
              </Box>
            )}

            {displayFiles.length === 0 ? (
              <Box py={24} style={{ textAlign: 'center' }}>
                <Text size="xs" c="dimmed">{searchQuery ? t('chat.workspace.noResults', '未搜索到匹配项') : t('chat.workspace.workspaceEmpty')}</Text>
              </Box>
            ) : (
              displayFiles.map((entry) => (
                <FileTreeItem
                  key={entry.path}
                  entry={entry}
                  workspaceId={activeWorkspaceId}
                  depth={0}
                  onDelete={deleteFileOrDir}
                />
              ))
            )}
          </>
        )}
      </ScrollArea>
    </Box>
  );
}
