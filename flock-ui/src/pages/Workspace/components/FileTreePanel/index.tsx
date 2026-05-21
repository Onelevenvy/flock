import { useState, useRef } from 'react';
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
  IconRefresh,
  IconSearch,
  IconFilePlus,
  IconFolderPlus,
  IconUpload,
} from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { useUiStore, FileEntry } from '../../../../store/uiStore';
import { useWorkspaceStore } from '../../../../store/workspaceStore';
import { useWorkspacesQuery } from '../../../../hooks/useWorkspaces';
import { useWorkspaceFiles } from '../../../../hooks/useWorkspaceFiles';
import { FileTreeItem } from './components/FileTreeItem';

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
