import { useState, useEffect } from 'react';
import { Box, Text, ScrollArea, Loader } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { notifications } from '@mantine/notifications';
import { save } from '@tauri-apps/plugin-dialog';
import { useUiStore } from '../../../../store/uiStore';
import { useWorkspaceStore } from '../../../../store/workspaceStore';
import { useAgentStore } from '../../../../store/agentStore';
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
  const [screenshotAbsPath, setScreenshotAbsPath] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'screenshot' | 'vnc'>('screenshot');
  const [refreshTrigger, setRefreshTrigger] = useState<number>(0);
  const [vncPreheatStatus, setVncPreheatStatus] = useState<'idle' | 'loading' | 'success'>('idle');

  // 感知工具是否正在运行，决定轮询频率
  const messages = useAgentStore((s) => s.messages);
  const isSandboxToolRunning = messages.some(m =>
    m.chunks.some(c =>
      c.kind === 'tool_request' &&
      (c.status === 'running' || c.status === 'pending') &&
      (c.tool?.name?.toLowerCase().includes('browser') ||
       c.tool?.name?.toLowerCase().includes('computer') ||
       c.tool?.name?.toLowerCase().includes('sandbox'))
    )
  );

  const ext = previewFile?.extension?.toLowerCase() || '';
  const lang = getLanguage(ext);
  const fileName = previewFile?.path.split(/[/\\]/).pop() || '';

  useEffect(() => {
    const isSandboxPreview = previewFile?.path === '.flock/sandbox/screenshot.png' || ext === 'vnc';
    if (!isSandboxPreview || !isPreviewOpen) return;

    // 工具运行中 → 500ms；否则 → 1500ms
    const interval = isSandboxToolRunning ? 500 : 1500;
    const timer = setInterval(() => {
      setRefreshTrigger((prev) => prev + 1);
    }, interval);

    return () => clearInterval(timer);
  }, [previewFile?.path, ext, isPreviewOpen, isSandboxToolRunning]);

  // 哪些文件可以进行 Code / Preview 双重切换
  const toggleable = ['html', 'htm', 'md', 'mdx', 'svg'].includes(ext);
  const [viewMode, setViewMode] = useState<'code' | 'preview'>(toggleable ? 'preview' : 'code');

  useEffect(() => {
    if (previewFile) {
      const toggleable = ['html', 'htm', 'md', 'mdx', 'svg'].includes(ext);
      setViewMode(toggleable ? 'preview' : 'code');

      const isVncUrl = ext === 'vnc' || previewFile.path.startsWith('http://') || previewFile.path.startsWith('https://');
      if (isVncUrl) {
        setActiveTab('vnc');
      } else {
        setActiveTab('screenshot');
      }
    }
  }, [previewFile, ext]);

  useEffect(() => {
    if (activeWorkspaceId) {
      invoke<string>('get_workspace_file_absolute_path', {
        workspaceId: activeWorkspaceId,
        relativePath: '.flock/sandbox/screenshot.png',
      })
        .then((path) => {
          setScreenshotAbsPath(path);
        })
        .catch((e) => {
          console.log('Failed to get screenshot path:', e);
        });
    }
  }, [activeWorkspaceId, previewFile]);

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

  const isVnc = ext === 'vnc' || (previewFile?.path?.startsWith('http://') || false) || (previewFile?.path?.startsWith('https://') || false);

  const formattedVncUrl = (() => {
    const url = previewFile?.path || '';
    if (url.startsWith('http://') || url.startsWith('https://')) {
      try {
        const u = new URL(url);
        if (u.pathname === '/' || u.pathname === '') {
          u.pathname = '/vnc.html';
        }
        if (!u.searchParams.has('autoconnect')) {
          u.searchParams.set('autoconnect', 'true');
        }
        if (!u.searchParams.has('resize')) {
          u.searchParams.set('resize', 'scale');
        }
        if (!u.searchParams.has('skip-preview-warning')) {
          u.searchParams.set('skip-preview-warning', 'true');
        }
        if (!u.searchParams.has('skip_preview_warning')) {
          u.searchParams.set('skip_preview_warning', 'true');
        }
        return u.toString();
      } catch (e) {
        return url;
      }
    }
    return url;
  })();

  useEffect(() => {
    if (activeTab === 'vnc' && formattedVncUrl && isVnc) {
      setVncPreheatStatus('loading');
      let isCurrent = true;

      const preheat = async () => {
        try {
          await fetch(formattedVncUrl, {
            method: 'GET',
            headers: {
              'X-Daytona-Skip-Preview-Warning': 'true',
              'X-Daytona-Disable-CORS': 'true',
            },
          });
        } catch (err) {
          console.warn('Preheat VNC URL CORS/Network issue, but cookie might still be set:', err);
        } finally {
          if (isCurrent) {
            setVncPreheatStatus('success');
          }
        }
      };

      preheat();

      return () => {
        isCurrent = false;
      };
    } else {
      setVncPreheatStatus('idle');
    }
  }, [formattedVncUrl, activeTab, isVnc]);

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

    // 如果是二进制图片，直接通过增加 refreshTrigger 来通知组件刷新 Base64，无需读取 UTF-8 文本！
    const IMAGE_EXTS = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp'];
    if (IMAGE_EXTS.includes(ext) || ext === 'vnc') {
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
      <PreviewHeader
        fileName={fileName === 'screenshot.png' || ext === 'vnc' ? 'FLOCK COMPUTER' : fileName}
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
          {previewFile.path === '.flock/sandbox/screenshot.png' || ext === 'vnc' ? 'FLOCK COMPUTER' : previewFile.path}
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

        {/* 3. 强制显示源码的模式：适用于双视图 of 'code' 模式 */}
        {(viewMode === 'code' && (isHtml || isMarkdown)) && (
          <CodeView content={previewFile.content} lang={isHtml ? 'html' : 'markdown'} />
        )}

        {/* 4. 普通代码 file */}
        {isCode && !isHtml && !isMarkdown && <CodeView content={previewFile.content} lang={lang} />}

        {/* 5. 图像预览 */}
        {isImage && absPath && (
          <ImageView
            absPath={absPath}
            workspaceId={activeWorkspaceId || ''}
            relativePath={previewFile.path}
            fileName={fileName === 'screenshot.png' ? 'FLOCK COMPUTER' : fileName}
            refreshKey={previewFile.path === '.flock/sandbox/screenshot.png' ? refreshTrigger : undefined}
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

        {/* 8. 未知或不支持格式的 Fallback */}
        {!isMarkdown && !isCode && !isImage && !isPdf && !isHtml && !isOffice && !isVnc && (
          <FallbackView
            fileName={fileName}
            ext={ext}
            filePath={previewFile.path}
            activeWorkspaceId={activeWorkspaceId || ''}
          />
        )}

        {/* 9. VNC noVNC 远程桌面与图片传屏双通道 */}
        {isVnc && (
          <Box style={{ width: '100%', height: '100%', padding: '16px', background: 'var(--flock-bg-deepest)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {/* Tabs 头部 */}
            <Box style={{ display: 'flex', borderBottom: '1px solid var(--flock-border-dim)', paddingBottom: '8px', gap: '16px' }}>
              <Box
                onClick={() => setActiveTab('screenshot')}
                style={{
                  padding: '6px 12px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: 600,
                  transition: 'all 0.2s ease',
                  background: activeTab === 'screenshot' ? 'var(--flock-accent)' : 'transparent',
                  color: activeTab === 'screenshot' ? '#fff' : 'var(--flock-text-dimmed)',
                }}
              >
                📸 实时大图 (图像传屏)
              </Box>
              <Box
                onClick={() => setActiveTab('vnc')}
                style={{
                  padding: '6px 12px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: 600,
                  transition: 'all 0.2s ease',
                  background: activeTab === 'vnc' ? 'var(--flock-accent)' : 'transparent',
                  color: activeTab === 'vnc' ? '#fff' : 'var(--flock-text-dimmed)',
                }}
              >
                🌐 网页控制台 (noVNC)
              </Box>
            </Box>

            {/* 📸 实时截图 (图像传屏) */}
            {activeTab === 'screenshot' && (
              <Box style={{ display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center', justifyContent: 'center', width: '100%', minHeight: '400px' }}>
                <ImageView
                  absPath={screenshotAbsPath}
                  workspaceId={activeWorkspaceId || ''}
                  relativePath=".flock/sandbox/screenshot.png"
                  fileName="FLOCK COMPUTER"
                  refreshKey={refreshTrigger}
                />
                <Text size="xs" c="dimmed" style={{ textAlign: 'center', maxWidth: '80%', lineHeight: '1.6' }}>
                  💡 **提示**：图像传屏模式免受 HTTPS 证书及 HSTS 拦截影响，为您 100% 稳定高保真展现当前沙盒桌面状态。您可以让 Agent 执行操作以流式刷新画面。
                </Text>
              </Box>
            )}

            {/* 🌐 网页控制台 (noVNC) */}
            {activeTab === 'vnc' && (
              <Box style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%' }}>
                {vncPreheatStatus === 'loading' ? (
                  <Box
                    style={{
                      width: '100%',
                      height: 'calc(100vh - 320px)',
                      border: '1px solid var(--flock-border-dim)',
                      background: 'var(--flock-bg-deep)',
                      borderRadius: 12,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '16px',
                      boxShadow: '0 8px 24px rgba(0,0,0,0.2)'
                    }}
                  >
                    <Loader size="md" color="var(--flock-accent)" type="bars" />
                    <Text size="sm" c="dimmed">正在安全连接远程控制台，请稍候...</Text>
                  </Box>
                ) : (
                  <iframe
                    src={formattedVncUrl}
                    style={{
                      width: '100%',
                      height: 'calc(100vh - 320px)',
                      border: '1px solid var(--flock-border-dim)',
                      background: 'var(--flock-bg-deep)',
                      borderRadius: 12,
                      boxShadow: '0 8px 24px rgba(0,0,0,0.2)'
                    }}
                    allow="fullscreen; clipboard-read; clipboard-write"
                    sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
                  />
                )}
                
                <Box style={{
                  padding: '12px',
                  borderRadius: '8px',
                  border: '1px solid #eab308',
                  background: 'rgba(234, 179, 8, 0.05)',
                  fontSize: '12px',
                  color: 'var(--flock-text-dimmed)',
                  lineHeight: '1.6'
                }}>
                  🛡️ **极重要：解除 Edge/Chrome 安全拦截（白屏）的操作指南**：<br />
                  由于云端证书未能覆盖多级代理域名，浏览器会显示“您的连接不是专用连接”并启用 HSTS 拦截（没有“继续前往”按钮）。**请按照以下步骤 100% 成功解除拦截**：<br />
                  1. 点击上方蓝色的 **[Remote VNC Link]({formattedVncUrl})**，会在浏览器新标签页中打开这个报错页面。<br />
                  2. **在此报错网页的任意空白处用鼠标点一下**，确保页面获得焦点。<br />
                  3. **在键盘上直接依次敲入这 12 个字母**：<code style={{ background: 'rgba(0,0,0,0.3)', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold', color: '#f59e0b' }}>thisisunsafe</code>（全部小写，**注意：不需要按回车，页面也没有任何输入框，直接用键盘盲打输入即可**）。<br />
                  4. 输完最后一个字母的瞬间，浏览器会自动绕过安全警告进入 VNC 桌面。此时，**返回当前软件界面点击刷新**，右侧就会立即正常呈现远程桌面！
                </Box>
              </Box>
            )}
          </Box>
        )}
      </ScrollArea>
    </Box>
  );
}
