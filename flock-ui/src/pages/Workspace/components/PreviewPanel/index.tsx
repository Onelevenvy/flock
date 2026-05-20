import { useState, useEffect } from 'react';
import {
  Box,
  Text,
  Group,
  ActionIcon,
  Tooltip,
  ScrollArea,
  Badge,
  CopyButton,
  SegmentedControl,
} from '@mantine/core';
import {
  IconX,
  IconCopy,
  IconCheck,
  IconDownload,
  IconRefresh,
} from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { notifications } from '@mantine/notifications';
import { save } from '@tauri-apps/plugin-dialog';
import { useUiStore } from '../../../../store/uiStore';
import { useWorkspaceStore } from '../../../../store/workspaceStore';
import { invoke } from '@tauri-apps/api/core';

import { ImageView } from './ImageView';
import { PdfView } from './PdfView';
import { OfficeView } from './OfficeView';
import { CodeView } from './CodeView';
import { MarkdownView } from './MarkdownView';
import { FallbackView } from './FallbackView';

const LANG_MAP: Record<string, string> = {
  ts: 'typescript', tsx: 'tsx', js: 'javascript', jsx: 'jsx',
  py: 'python', rs: 'rust', css: 'css', scss: 'scss', less: 'less',
  html: 'html', htm: 'html', json: 'json', toml: 'toml',
  yaml: 'yaml', yml: 'yaml', md: 'markdown', mdx: 'markdown',
  sh: 'bash', bash: 'bash', zsh: 'bash',
};

function getLanguage(extension?: string): string {
  if (!extension) return 'text';
  return LANG_MAP[extension.toLowerCase()] || 'text';
}

interface PreviewPanelProps {
  /** 嵌入模式：由父布局控制宽高，不自带固定宽度 */
  embedded?: boolean;
}

export function PreviewPanel({ embedded = false }: PreviewPanelProps) {
  const { t } = useTranslation();
  const { isPreviewOpen, previewFile, setPreviewFile } = useUiStore();
  const { activeWorkspaceId } = useWorkspaceStore();
  const [absPath, setAbsPath] = useState<string>('');

  const ext = previewFile?.extension?.toLowerCase() || '';
  const lang = getLanguage(ext);
  const fileName = previewFile?.path.split(/[/\\]/).pop() || '';

  // 哪些文件可以进行 Code / Preview 双重切换
  const toggleable = ['html', 'htm', 'md', 'mdx', 'svg'].includes(ext);
  const [viewMode, setViewMode] = useState<'code' | 'preview'>(toggleable ? 'preview' : 'code');

  useEffect(() => {
    if (previewFile) {
      const toggleable = ['html', 'htm', 'md', 'mdx', 'svg'].includes(ext);
      setViewMode(toggleable ? 'preview' : 'code');
    }
  }, [previewFile, ext]);

  useEffect(() => {
    if (!previewFile || !activeWorkspaceId) {
      setAbsPath('');
      return;
    }
    invoke<string>('get_workspace_file_absolute_path', {
      workspaceId: activeWorkspaceId,
      relativePath: previewFile.path,
    })
      .then((path) => {
        setAbsPath(path);
      })
      .catch((e) => {
        console.error('Failed to get absolute path:', e);
      });
  }, [previewFile, activeWorkspaceId]);

  if (!isPreviewOpen || !previewFile) return null;

  // Rendering Dispatcher flags
  const isMarkdown = ext === 'md' || ext === 'mdx';
  const previewableExts = ['txt', 'json', 'toml', 'yaml', 'yml', 'ts', 'tsx', 'js', 'jsx', 'py', 'rs', 'css', 'scss', 'log', 'diff', 'patch'];
  const isCode = previewableExts.includes(ext);
  
  const IMAGE_EXTS = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp'];
  const isImage = IMAGE_EXTS.includes(ext);
  const isPdf = ext === 'pdf';
  const isHtml = ext === 'html' || ext === 'htm';
  
  const OFFICE_EXTS = ['docx', 'doc', 'xlsx', 'xls', 'pptx', 'ppt'];
  const isOffice = OFFICE_EXTS.includes(ext);

  // 下载操作
  const handleDownload = async () => {
    if (!activeWorkspaceId || !previewFile) return;
    try {
      const destination = await save({
        defaultPath: fileName,
        filters: ext ? [{ name: ext.toUpperCase(), extensions: [ext] }] : undefined,
      });

      if (!destination) return;

      await invoke('download_workspace_file', {
        workspaceId: activeWorkspaceId,
        relativePath: previewFile.path,
        localDestPath: destination,
      });

      notifications.show({
        title: '下载成功',
        message: `已导出至本地：${destination}`,
        color: 'teal',
      });
    } catch (err: unknown) {
      notifications.show({
        title: '下载失败',
        message: String(err),
        color: 'red',
      });
    }
  };

  // 刷新操作
  const handleRefresh = async () => {
    if (!activeWorkspaceId || !previewFile) return;
    try {
      const content = await invoke<string>('read_workspace_file', {
        workspaceId: activeWorkspaceId,
        relativePath: previewFile.path,
      });
      setPreviewFile({ path: previewFile.path, content, extension: previewFile.extension });
      notifications.show({
        title: '刷新成功',
        message: '已加载最新内容',
        color: 'teal',
        autoClose: 1000,
      });
    } catch (err: unknown) {
      notifications.show({
        title: '刷新失败',
        message: String(err),
        color: 'red',
      });
    }
  };

  return (
    <Box
      style={{
        flex: embedded ? 1 : undefined,
        width: embedded ? undefined : 580,
        height: '100%',
        borderLeft: embedded ? 'none' : '1px solid var(--flock-border-dim)',
        background: 'var(--flock-bg-deepest)',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: embedded ? undefined : 0,
        minWidth: 0,
      }}
    >
      {/* 头部 Toolbar - Flock Computer */}
      <Group
        justify="space-between"
        px="md"
        py={10}
        style={{
          borderBottom: '1px solid var(--flock-border-dim)',
          background: 'var(--flock-bg-base)',
          flexShrink: 0,
        }}
      >
        <Group gap="md">
          {/* Flock Computer 标签与名字 */}
          <Group gap="xs">
            <Badge
              size="xs"
              variant="dot"
              color="indigo"
              style={{ textTransform: 'uppercase', paddingLeft: 6, paddingRight: 6 }}
            >
              Flock Computer
            </Badge>
            <Text
              size="sm"
              fw={600}
              style={{ fontFamily: 'var(--mantine-font-family-monospace)', color: 'var(--flock-text-primary)' }}
            >
              {fileName}
            </Text>
          </Group>

          {/* 切换 Tab (仅支持切换的文件) */}
          {toggleable && (
            <SegmentedControl
              size="xs"
              value={viewMode}
              onChange={(val) => setViewMode(val as 'code' | 'preview')}
              data={[
                { label: '预览', value: 'preview' },
                { label: '代码', value: 'code' },
              ]}
              styles={{
                root: {
                  background: 'var(--flock-bg-hover)',
                  border: '1px solid var(--flock-border-dim)',
                  padding: 2,
                },
                control: {
                  transition: 'color 0.15s ease',
                }
              }}
            />
          )}
        </Group>

        {/* 顶部操作区：刷新和下载 */}
        <Group gap={6}>
          {viewMode === 'code' && (isCode || isMarkdown || isHtml) && (
            <CopyButton value={previewFile.content} timeout={2000}>
              {({ copied, copy }) => (
                <Tooltip label={copied ? t('chat.copied') : t('workspace.copyContent')} withArrow>
                  <ActionIcon
                    size="sm"
                    variant="subtle"
                    color={copied ? 'green' : 'gray'}
                    onClick={copy}
                  >
                    {copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
                  </ActionIcon>
                </Tooltip>
              )}
            </CopyButton>
          )}

          <Tooltip label="刷新内容" withArrow>
            <ActionIcon
              size="sm"
              variant="subtle"
              color="gray"
              onClick={handleRefresh}
            >
              <IconRefresh size={14} />
            </ActionIcon>
          </Tooltip>

          <Tooltip label="下载此文件" withArrow>
            <ActionIcon
              size="sm"
              variant="subtle"
              color="gray"
              onClick={handleDownload}
            >
              <IconDownload size={14} />
            </ActionIcon>
          </Tooltip>

          <Tooltip label={t('workspace.closePreview')} withArrow>
            <ActionIcon
              size="sm"
              variant="subtle"
              color="gray"
              onClick={() => setPreviewFile(null)}
            >
              <IconX size={14} />
            </ActionIcon>
          </Tooltip>
        </Group>
      </Group>

      {/* 文件路径 */}
      <Box
        px="md"
        py={4}
        style={{
          borderBottom: '1px solid var(--flock-border-dim)',
          background: 'var(--flock-bg-deepest)',
          flexShrink: 0,
        }}
      >
        <Text size="xs" c="dimmed" style={{ fontFamily: 'var(--mantine-font-family-monospace)', opacity: 0.55 }}>
          {previewFile.path}
        </Text>
      </Box>

      {/* 内容区 */}
      <ScrollArea style={{ flex: 1, height: '100%' }}>
        {/* 1. HTML 预览：如果处于 preview 模式，使用 iframe 进行网页运行效果仿真 */}
        {isHtml && viewMode === 'preview' && (
          <iframe
            srcDoc={previewFile.content}
            title="HTML Sandbox Runner"
            sandbox="allow-scripts"
            style={{
              width: '100%',
              height: 'calc(100vh - 120px)',
              border: 'none',
              background: '#ffffff',
            }}
          />
        )}

        {/* 2. Markdown 渲染：预览模式 */}
        {isMarkdown && viewMode === 'preview' && <MarkdownView content={previewFile.content} />}

        {/* 3. 强制显示源码的模式：适用于双视图的 'code' 模式 */}
        {(viewMode === 'code' && (isHtml || isMarkdown)) && (
          <CodeView content={previewFile.content} lang={isHtml ? 'html' : 'markdown'} />
        )}

        {/* 4. 普通代码文件 */}
        {isCode && !isHtml && !isMarkdown && <CodeView content={previewFile.content} lang={lang} />}

        {/* 5. 图像预览 */}
        {isImage && absPath && <ImageView absPath={absPath} fileName={fileName} />}

        {/* 6. PDF 预览 */}
        {isPdf && absPath && <PdfView absPath={absPath} fileName={fileName} />}

        {/* 7. Office 预览 */}
        {isOffice && (
          <OfficeView
            fileName={fileName}
            ext={ext}
            filePath={previewFile.path}
            activeWorkspaceId={activeWorkspaceId || ''}
          />
        )}

        {/* 8. 未知或不支持格式的 Fallback */}
        {!isMarkdown && !isCode && !isImage && !isPdf && !isHtml && !isOffice && (
          <FallbackView
            fileName={fileName}
            ext={ext}
            filePath={previewFile.path}
            activeWorkspaceId={activeWorkspaceId || ''}
          />
        )}
      </ScrollArea>
    </Box>
  );
}
