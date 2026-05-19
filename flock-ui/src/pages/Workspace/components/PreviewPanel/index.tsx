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
} from '@mantine/core';
import {
  IconX,
  IconCopy,
  IconCheck,
} from '@tabler/icons-react';
import { useUiStore } from '../../../../store/uiStore';
import { useWorkspaceStore } from '../../../../store/workspaceStore';
import { invoke } from '@tauri-apps/api/core';

import { ImageView } from './ImageView';
import { PdfView } from './PdfView';
import { HtmlView } from './HtmlView';
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
  const { isPreviewOpen, previewFile, setPreviewFile } = useUiStore();
  const { activeWorkspaceId } = useWorkspaceStore();
  const [absPath, setAbsPath] = useState<string>('');

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

  const ext = previewFile.extension?.toLowerCase() || '';
  const lang = getLanguage(ext);
  const fileName = previewFile.path.split(/[/\\]/).pop() || '';

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

  return (
    <Box
      style={{
        // embedded 模式：完全撑满父容器（父容器负责尺寸）
        // 非 embedded 模式：作为独立面板，左边有分隔线
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
      {/* 头部 Toolbar */}
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
        <Group gap="xs">
          <Badge
            size="xs"
            variant="dot"
            color={isCode || isMarkdown ? 'blue' : 'teal'}
            style={{ textTransform: 'lowercase' }}
          >
            {previewFile.extension || 'txt'}
          </Badge>
          <Text
            size="sm"
            fw={500}
            style={{ fontFamily: 'monospace', color: 'var(--flock-text-primary)' }}
          >
            {fileName}
          </Text>
        </Group>

        <Group gap={4}>
          {(isCode || isMarkdown) && (
            <CopyButton value={previewFile.content} timeout={2000}>
              {({ copied, copy }) => (
                <Tooltip label={copied ? '已复制' : '复制内容'} withArrow>
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
          <Tooltip label="关闭预览" withArrow>
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
        <Text size="xs" c="dimmed" style={{ fontFamily: 'monospace', opacity: 0.55 }}>
          {previewFile.path}
        </Text>
      </Box>

      {/* 内容区 */}
      <ScrollArea style={{ flex: 1 }}>
        {/* 1. Markdown 渲染 */}
        {isMarkdown && <MarkdownView content={previewFile.content} />}

        {/* 2. 代码/文本 语法高亮 */}
        {isCode && <CodeView content={previewFile.content} lang={lang} />}

        {/* 3. 图像预览 */}
        {isImage && absPath && <ImageView absPath={absPath} fileName={fileName} />}

        {/* 4. PDF 预览 */}
        {isPdf && absPath && <PdfView absPath={absPath} fileName={fileName} />}

        {/* 5. HTML 预览 */}
        {isHtml && <HtmlView content={previewFile.content} fileName={fileName} />}

        {/* 6. Office 预览卡片 (Word, Excel, PPT) */}
        {isOffice && (
          <OfficeView
            fileName={fileName}
            ext={ext}
            filePath={previewFile.path}
            activeWorkspaceId={activeWorkspaceId || ''}
          />
        )}

        {/* 7. 未知或不支持格式的 Fallback */}
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
