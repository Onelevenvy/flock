import { useState, useEffect } from 'react';
import { Box, Text, ScrollArea, SegmentedControl, ActionIcon, Group, Center } from '@mantine/core';
import { IconX, IconCode, IconBrowser, IconDeviceDesktop, IconTerminal2 } from '@tabler/icons-react';
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
import { ConsoleTerminalView } from './components/ConsoleTerminalView';
import { PreviewHeader } from './components/PreviewHeader';
import { SandboxRunner } from './components/SandboxRunner';
import { VncView } from './components/VncView';
import { useVncUrl, usePreviewFileState } from './hooks/usePreviewState';

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

interface EnvironmentPanelProps {
  embedded?: boolean;
}

export function EnvironmentPanel({ embedded = false }: EnvironmentPanelProps) {
  const { t } = useTranslation();
  const { isPreviewOpen, previewFile, setPreviewFile, environmentMode, setEnvironmentMode, closeEnvironment } = useUiStore();
  const { activeWorkspaceId, activeConversationId } = useWorkspaceStore();

  const ext = previewFile?.extension?.toLowerCase() || '';
  const lang = getLanguage(ext);
  const fileName = previewFile?.path.split(/[/\\]/).pop() || '';

  const sessionId = activeConversationId || 'default';
  const targetScreenshotName = `screenshot_${sessionId}.png`;
  const targetScreenshotPath = `.flock/sandbox/screenshot_${sessionId}.png`;

  const { absPath, screenshotAbsPath, refreshTrigger, setRefreshTrigger } = usePreviewFileState(
    previewFile?.path,
    ext,
    isPreviewOpen,
    activeWorkspaceId ?? undefined,
  );

  const isVnc = ext === 'vnc' || (previewFile?.path?.startsWith('http://') || false) || (previewFile?.path?.startsWith('https://') || false);
  const formattedVncUrl = useVncUrl(isVnc ? previewFile?.path : undefined);

  // 哪些文件可以进行 Code / Preview 双重切换
  const toggleable = ['html', 'htm', 'md', 'mdx', 'svg'].includes(ext);
  const [viewMode, setViewMode] = useState<'code' | 'preview'>(toggleable ? 'preview' : 'code');

  useEffect(() => {
    if (previewFile) {
      const t = ['html', 'htm', 'md', 'mdx', 'svg'].includes(ext);
      setViewMode(t ? 'preview' : 'code');
    }
  }, [previewFile, ext]);

  // 如果根本没有打开，直接不渲染
  if (!isPreviewOpen || environmentMode === 'closed') return null;

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

  const handleRefresh = async () => {
    if (!activeWorkspaceId || !previewFile) return;

    const IMG_EXTS = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp'];
    if (IMG_EXTS.includes(ext) || ext === 'vnc') {
      setRefreshTrigger((prev) => prev + 1);
      notifications.show({
        title: t('chat.workspace.refreshSuccess'),
        message: t('chat.workspace.refreshSuccessDesc'),
        color: 'teal',
        autoClose: 1000,
      });
      return;
    }

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
      {/* 顶部 Tab 控制栏 */}
      <Box
        px="sm"
        py={8}
        style={{
          borderBottom: '1px solid var(--flock-border-dim)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'var(--flock-bg-surface)',
          flexShrink: 0,
        }}
      >
        <SegmentedControl
          value={environmentMode}
          onChange={(val: any) => setEnvironmentMode(val)}
          data={[
            {
              value: 'code',
              label: (
                <Center style={{ gap: 6 }}>
                  <IconCode size={14} />
                  <span>{t('chat.workspace.tabCode', { defaultValue: 'Files' })}</span>
                </Center>
              ),
            },
            {
              value: 'terminal',
              label: (
                <Center style={{ gap: 6 }}>
                  <IconTerminal2 size={14} />
                  <span>{t('chat.workspace.tabTerminal', { defaultValue: 'Terminal' })}</span>
                </Center>
              ),
            },
            {
              value: 'browser',
              label: (
                <Center style={{ gap: 6 }}>
                  <IconBrowser size={14} />
                  <span>{t('chat.workspace.tabBrowser', { defaultValue: 'Browser' })}</span>
                </Center>
              ),
            },
            {
              value: 'computer',
              label: (
                <Center style={{ gap: 6 }}>
                  <IconDeviceDesktop size={14} />
                  <span>{t('chat.workspace.tabComputer', { defaultValue: 'Computer' })}</span>
                </Center>
              ),
            },
          ]}
          size="xs"
          radius="md"
          color="blue"
          styles={{
            root: { background: 'var(--flock-bg-base)' },
          }}
        />

        <ActionIcon variant="subtle" color="gray" onClick={closeEnvironment}>
          <IconX size={16} />
        </ActionIcon>
      </Box>

      {/* Code/Files 模式独有的 PreviewHeader */}
      {environmentMode === 'code' && previewFile && (
        <PreviewHeader
          fileName={fileName === targetScreenshotName || ext === 'vnc' ? 'FLOCK COMPUTER' : fileName}
          viewMode={viewMode}
          toggleable={toggleable}
          content={previewFile.content}
          isCode={isCode}
          isMarkdown={isMarkdown}
          isHtml={isHtml}
          onViewModeChange={(val) => setViewMode(val)}
          onRefresh={handleRefresh}
          onDownload={handleDownload}
          onClose={closeEnvironment}
        />
      )}

      {/* 文件路径指示器 (仅在 Code 模式下) */}
      {environmentMode === 'code' && previewFile && (
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
            {previewFile.path === targetScreenshotPath || ext === 'vnc' ? 'FLOCK COMPUTER' : previewFile.path}
          </Text>
        </Box>
      )}

      {/* 内容区 */}
      <ScrollArea style={{ flex: 1, height: '100%' }}>
        {/* === TERMINAL 模式 === */}
        {environmentMode === 'terminal' && (
          <Box style={{ height: '100%', minHeight: 400 }}>
             {previewFile ? (
               <ConsoleTerminalView content={previewFile.content} />
             ) : (
               <Center style={{ height: '100%', color: 'var(--flock-text-dimmed)' }}>
                 <Text size="sm">{t('chat.workspace.noLogSelected', { defaultValue: 'No terminal session active' })}</Text>
               </Center>
             )}
          </Box>
        )}

        {/* === BROWSER 模式 === */}
        {environmentMode === 'browser' && (
          <Box style={{ height: '100%', minHeight: 400 }}>
             {(isHtml || toggleable) && previewFile ? (
               <SandboxRunner content={previewFile.content} />
             ) : (
               <Center style={{ height: '100%', color: 'var(--flock-text-dimmed)' }}>
                 <Text size="sm">{t('chat.workspace.noHtmlPreview', { defaultValue: 'No active web preview' })}</Text>
               </Center>
             )}
          </Box>
        )}

        {/* === COMPUTER 模式 === */}
        {environmentMode === 'computer' && (
          <Box style={{ height: '100%', minHeight: 400 }}>
            <VncView
              formattedVncUrl={formattedVncUrl}
              screenshotAbsPath={screenshotAbsPath}
              activeWorkspaceId={activeWorkspaceId || ''}
              refreshTrigger={refreshTrigger}
            />
          </Box>
        )}

        {/* === CODE / FILES 模式 === */}
        {environmentMode === 'code' && previewFile && (
          <>
            {/* 1. HTML 预览 (Fallback if explicitly in preview mode) */}
            {isHtml && viewMode === 'preview' && (
              <SandboxRunner content={previewFile.content} />
            )}

            {/* 2. Markdown 渲染 */}
            {isMarkdown && viewMode === 'preview' && <MarkdownView content={previewFile.content} />}

            {/* 3. 强制源码模式 */}
            {(viewMode === 'code' && (isHtml || isMarkdown)) && (
              <CodeView content={previewFile.content} lang={isHtml ? 'html' : 'markdown'} />
            )}

            {/* 4. 普通代码 */}
            {isCode && !isHtml && !isMarkdown && <CodeView content={previewFile.content} lang={lang} />}

            {/* 5. 图像预览 */}
            {isImage && absPath && (
              <ImageView
                absPath={absPath}
                workspaceId={activeWorkspaceId || ''}
                relativePath={previewFile.path}
                fileName={fileName === targetScreenshotName ? 'FLOCK COMPUTER' : fileName}
                refreshKey={previewFile.path === targetScreenshotPath ? refreshTrigger : undefined}
              />
            )}

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

            {/* 8. Fallback */}
            {!isMarkdown && !isCode && !isImage && !isPdf && !isHtml && !isOffice && !isVnc && (
              <FallbackView
                fileName={fileName}
                ext={ext}
                filePath={previewFile.path}
                activeWorkspaceId={activeWorkspaceId || ''}
              />
            )}
          </>
        )}

        {environmentMode === 'code' && !previewFile && (
           <Center style={{ height: '100%', color: 'var(--flock-text-dimmed)' }}>
             <Text size="sm">{t('chat.workspace.noFileSelected', { defaultValue: 'No file selected' })}</Text>
           </Center>
        )}
      </ScrollArea>
    </Box>
  );
}

export default EnvironmentPanel;
