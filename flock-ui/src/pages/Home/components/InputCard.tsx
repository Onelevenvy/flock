import { Box, Textarea, Group, Menu, Tooltip, ActionIcon, Text } from '@mantine/core';
import { IconSend, IconPlayerStop } from '@tabler/icons-react';
import { WorkspacePicker } from '@/pages/Home/WorkspacePicker';
import { ActiveModelPicker } from '@/components/Common/ActiveModelPicker';

interface InputCardProps {
  t: any;
  textareaRef: React.RefObject<HTMLTextAreaElement>;
  placeholder: string;
  value: string;
  onChange: (val: string) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  disabled: boolean;
  activeWorkspaceId: string | null;
  status: string;
  capabilities: any;
  currentMode: string;
  activeOption: any;
  modeOptions: Array<{ value: string; label: string; icon: any; color: string }>;
  onModeChange: (mode: string) => void;
  isStreaming: boolean;
  canSend: boolean;
  onSend: () => void;
  onStop: () => void;
  onSelectWorkspace: (wsId: string, wsPath: string, wsName: string) => void;
}

export function InputCard({
  t,
  textareaRef,
  placeholder,
  value,
  onChange,
  onKeyDown,
  disabled,
  activeWorkspaceId,
  status,
  capabilities,
  currentMode,
  activeOption,
  modeOptions,
  onModeChange,
  isStreaming,
  canSend,
  onSend,
  onStop,
  onSelectWorkspace,
}: InputCardProps) {
  const ActiveModeIcon = activeOption.icon;

  return (
    <Box
      style={{
        width: '100%',
        maxWidth: 680,
        background: 'var(--flock-bg-raised)',
        border: '1px solid var(--flock-border-base)',
        borderRadius: 16,
        padding: '12px 14px 10px',
        boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
      }}
      className="home-input-card"
    >
      {/* 文本输入 */}
      <Textarea
        ref={textareaRef}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.currentTarget.value)}
        onKeyDown={onKeyDown}
        disabled={disabled}
        autosize
        minRows={2}
        maxRows={10}
        styles={{
          input: {
            background: 'transparent',
            border: 'none',
            padding: 0,
            color: 'var(--flock-text-primary)',
            fontSize: 14,
            lineHeight: 1.6,
            resize: 'none',
            outline: 'none',
            boxShadow: 'none',
          },
        }}
      />

      {/* 底部工具栏 */}
      <Group justify="space-between" mt={10}>
        {/* 左侧：工作区 + 模型 */}
        <Group gap={8} wrap="nowrap">
          <WorkspacePicker onSelect={onSelectWorkspace} />
          <ActiveModelPicker />
        </Group>

        {/* 右侧：模式 + 发送 */}
        <Group gap={6} wrap="nowrap">
          {/* 审批模式 */}
          {status === 'ready' && capabilities && (
            <Menu shadow="md" width={140} position="top-end">
              <Menu.Target>
                <Tooltip label={`${t('home.runMode')}: ${activeOption.label}`} withArrow>
                  <ActionIcon size="sm" variant="subtle" color={activeOption.color} radius="md">
                    <ActiveModeIcon size={15} />
                  </ActionIcon>
                </Tooltip>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Label>{t('home.runMode')}</Menu.Label>
                {modeOptions.map((opt) => (
                  <Menu.Item
                    key={opt.value}
                    leftSection={<opt.icon size={13} color={`var(--mantine-color-${opt.color}-5)`} />}
                    onClick={() => onModeChange(opt.value)}
                    style={{ fontWeight: currentMode === opt.value ? 600 : 400 }}
                  >
                    {opt.label}
                  </Menu.Item>
                ))}
              </Menu.Dropdown>
            </Menu>
          )}

          {isStreaming ? (
            <Tooltip label={t('home.stopGeneration')} withArrow>
              <ActionIcon size="md" color="red" variant="light" radius="xl" onClick={onStop}>
                <IconPlayerStop size={15} />
              </ActionIcon>
            </Tooltip>
          ) : (
            <Tooltip
              label={
                canSend
                  ? t('home.sendEnter')
                  : !activeWorkspaceId
                  ? t('home.pleaseSelectWorkspace')
                  : t('home.sendMessagePlaceholder')
              }
              withArrow
            >
              <ActionIcon
                size="md"
                color="blue"
                variant={canSend ? 'filled' : 'subtle'}
                radius="xl"
                onClick={onSend}
                disabled={!canSend}
                style={{
                  background: canSend ? 'var(--flock-accent)' : undefined,
                  boxShadow: canSend ? '0 2px 10px rgba(21, 90, 239, 0.25)' : 'none',
                  transition: 'all 0.2s ease',
                }}
              >
                <IconSend size={15} />
              </ActionIcon>
            </Tooltip>
          )}
        </Group>
      </Group>
    </Box>
  );
}
