import React from 'react';
import {
  Group,
  Badge,
  Text,
  SegmentedControl,
  CopyButton,
  Tooltip,
  ActionIcon,
} from '@mantine/core';
import {
  IconCheck,
  IconCopy,
  IconRefresh,
  IconDownload,
  IconX,
} from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';

interface PreviewHeaderProps {
  fileName: string;
  viewMode: 'code' | 'preview';
  toggleable: boolean;
  content: string;
  isCode: boolean;
  isMarkdown: boolean;
  isHtml: boolean;
  onViewModeChange: (mode: 'code' | 'preview') => void;
  onRefresh: () => Promise<void>;
  onDownload: () => Promise<void>;
  onClose: () => void;
}

export function PreviewHeader({
  fileName,
  viewMode,
  toggleable,
  content,
  isCode,
  isMarkdown,
  isHtml,
  onViewModeChange,
  onRefresh,
  onDownload,
  onClose,
}: PreviewHeaderProps) {
  const { t } = useTranslation();

  return (
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
        <Group gap="xs">
          <Badge
            size="xs"
            variant="dot"
            color="indigo"
            style={{ textTransform: 'uppercase', paddingLeft: 6, paddingRight: 6 }}
          >
            {t('chat.workspace.flockComputer', 'Flock Computer')}
          </Badge>
          <Text
            size="sm"
            fw={600}
            style={{ fontFamily: 'var(--mantine-font-family-monospace)', color: 'var(--flock-text-primary)' }}
          >
            {fileName}
          </Text>
        </Group>

        {toggleable && (
          <SegmentedControl
            size="xs"
            value={viewMode}
            onChange={(val) => onViewModeChange(val as 'code' | 'preview')}
            data={[
              { label: t('chat.workspace.tabPreview', '预览'), value: 'preview' },
              { label: t('chat.workspace.tabCode', '代码'), value: 'code' },
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

      <Group gap={6}>
        {viewMode === 'code' && (isCode || isMarkdown || isHtml) && (
          <CopyButton value={content} timeout={2000}>
            {({ copied, copy }) => (
              <Tooltip label={copied ? t('chat.copied') : t('chat.workspace.copyContent')} withArrow>
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

        <Tooltip label={t('chat.workspace.refreshTooltip', '刷新内容')} withArrow>
          <ActionIcon
            size="sm"
            variant="subtle"
            color="gray"
            onClick={onRefresh}
          >
            <IconRefresh size={14} />
          </ActionIcon>
        </Tooltip>

        <Tooltip label={t('chat.workspace.downloadTooltip', '下载此文件')} withArrow>
          <ActionIcon
            size="sm"
            variant="subtle"
            color="gray"
            onClick={onDownload}
          >
            <IconDownload size={14} />
          </ActionIcon>
        </Tooltip>

        <Tooltip label={t('chat.workspace.closePreview')} withArrow>
          <ActionIcon
            size="sm"
            variant="subtle"
            color="gray"
            onClick={onClose}
          >
            <IconX size={14} />
          </ActionIcon>
        </Tooltip>
      </Group>
    </Group>
  );
}
