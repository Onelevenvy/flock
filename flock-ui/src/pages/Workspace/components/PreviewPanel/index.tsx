import { useState, useEffect } from 'react';
import { Box, Text, ScrollArea } from '@mantine/core';
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
import { PreviewHeader } from './components/PreviewHeader';
import { SandboxRunner } from './components/SandboxRunner';

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
  const isVnc = ext === 'vnc' || previewFile.path.startsWith('http://') || previewFile.path.startsWith('https://');
  
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
        title: t('chat.workspace.downloadSuccess'),
        message: t('chat.workspace.downloadSuccessDesc', { dest: destination }),
        color: 'teal',
      });
    } catch (err: unknown) {
      notifications.show({
        title: t('chat.workspace.downloadFailed'),
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
        title: t('chat.workspace.refreshSuccess'),
        message: t('chat.workspace.refreshSuccessDesc'),
        color: 'teal',
        autoClose: 1000,
      });
    } catch (err: unknown) {
      notifications.show({
        title: t('chat.workspace.refreshFailed'),
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
      <PreviewHeader
        fileName={fileName}
        viewMode={viewMode}
        toggleable={toggleable}
        content={previewFile.content}
        isCode={isCode}
        isMarkdown={isMarkdown}
        isHtml={isHtml}
        onViewModeChange={(val) => setViewMode(val)}
        onRefresh={handleRefresh}
        onDownload={handleDownload}
        onClose={() => setPreviewFile(null)}
      />

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
          <SandboxRunner content={previewFile.content} />
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
        {!isMarkdown && !isCode && !isImage && !isPdf && !isHtml && !isOffice && !isVnc && (
          <FallbackView
            fileName={fileName}
            ext={ext}
            filePath={previewFile.path}
            activeWorkspaceId={activeWorkspaceId || ''}
          />
        )}

        {/* 9. VNC noVNC 远程桌面嵌入 */}
        {isVnc && (
          <Box style={{ width: '100%', height: '100%', padding: '16px', background: 'var(--flock-bg-deepest)' }}>
            <iframe
              src={previewFile.path}
              style={{
                width: '100%',
                height: 'calc(100vh - 140px)',
                border: '1px solid var(--flock-border-dim)',
                background: 'var(--flock-bg-deep)',
                borderRadius: 12,
                boxShadow: '0 8px 24px rgba(0,0,0,0.2)'
              }}
              allow="fullscreen; clipboard-read; clipboard-write"
              sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
            />
          </Box>
        )}
      </ScrollArea>
    </Box>
  );
}
