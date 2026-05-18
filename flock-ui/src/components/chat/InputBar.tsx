import { useState, useRef, KeyboardEvent } from 'react';
import {
  Group,
  Textarea,
  ActionIcon,
  Tooltip,
  Box,
  Text,
  Menu,
} from '@mantine/core';
import {
  IconSend,
  IconPlayerStop,
  IconShieldCheck,
  IconBolt,
  IconFlame,
} from '@tabler/icons-react';
import { invoke } from '@tauri-apps/api/core';
import { useAgentStore } from '../../store/agentStore';
import { useWorkspaceStore } from '../../store/workspaceStore';
import { v4 as uuidv4 } from 'uuid';
import { ModelSelector } from '../Settings/ModelSelector';

const MODE_OPTIONS = [
  { value: 'default', label: '审批模式', icon: IconShieldCheck, color: 'indigo' },
  { value: 'auto_edit', label: 'AutoEdit', icon: IconBolt, color: 'teal' },
  { value: 'yolo', label: 'YOLO', icon: IconFlame, color: 'red' },
];

function ModeSelector() {
  const capabilities = useAgentStore((s) => s.capabilities);
  const status = useAgentStore((s) => s.status);
  const setCapabilities = useAgentStore((s) => s.setCapabilities);
  const currentMode = capabilities?.current_mode ?? 'default';

  const handleModeChange = async (mode: string) => {
    if (!mode) return;
    try {
      await invoke('set_mode', { mode });
      if (capabilities) {
        setCapabilities({ ...capabilities, current_mode: mode });
      }
    } catch (e) {
      console.error('set_mode error:', e);
    }
  };

  const activeOption = MODE_OPTIONS.find(o => o.value === currentMode) || MODE_OPTIONS[0];
  const ActiveIcon = activeOption.icon;

  if (status === 'disconnected' || status === 'error' || !capabilities) {
    return null;
  }

  return (
    <Menu shadow="md" width={140} position="top-end">
      <Menu.Target>
        <Tooltip label={`运行模式: ${activeOption.label}`} withArrow>
          <ActionIcon size="md" variant="subtle" color={activeOption.color} radius="md">
            <ActiveIcon size={18} />
          </ActionIcon>
        </Tooltip>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Label>运行模式</Menu.Label>
        {MODE_OPTIONS.map(opt => (
          <Menu.Item
            key={opt.value}
            leftSection={<opt.icon size={14} color={`var(--mantine-color-${opt.color}-5)`} />}
            onClick={() => handleModeChange(opt.value)}
            style={{ fontWeight: currentMode === opt.value ? 600 : 400 }}
          >
            {opt.label}
          </Menu.Item>
        ))}
      </Menu.Dropdown>
    </Menu>
  );
}

export function InputBar() {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const status = useAgentStore((s) => s.status);
  const addUserMessage = useAgentStore((s) => s.addUserMessage);
  const setError = useAgentStore((s) => s.setError);
  const { activeWorkspaceId, activeConversationId } = useWorkspaceStore();
  const isStreaming = status === 'thinking';
  const canSend = status === 'ready' && value.trim().length > 0 && !!activeWorkspaceId;

  const placeholder = !activeWorkspaceId
    ? '请先在左侧选择或新建工作空间...'
    : status === 'disconnected'
    ? 'Agent 未连接，正在启动...'
    : status === 'connecting'
    ? '正在连接 Agent...'
    : isStreaming
    ? 'Agent 思考中...'
    : '输入消息（Enter 发送，Shift+Enter 换行）';

  const handleSend = async () => {
    if (!canSend) return;
    const content = value.trim();
    const userUiId = `user-${uuidv4()}`;
    const streamMsgId = uuidv4();
    setValue('');
    addUserMessage(userUiId, content);
    try {
      await invoke('send_message', { 
        sessionId: activeConversationId || null, 
        msgId: streamMsgId, 
        content 
      });
    } catch (e: any) {
      console.error('send_message error:', e);
      setError(e.message || String(e));
    }
  };

  const handleStop = async () => {
    try {
      await invoke('stop_agent', { sessionId: activeConversationId || null });
    } catch (e: any) {
      console.error('stop_agent error:', e);
      setError(e.message || String(e));
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <Box
      style={{
        borderTop: '1px solid var(--flock-border-dim)',
        background: 'var(--flock-bg-surface)',
        padding: '12px 16px 14px',
        flexShrink: 0,
      }}
    >
      {/* 输入框主体 */}
      <Box
        className="input-bar-wrapper"
        style={{
          background: 'var(--flock-bg-raised)',
          border: '1px solid var(--flock-border-base)',
          borderRadius: 12,
          padding: '8px 12px',
          transition: 'border-color 0.15s, box-shadow 0.15s',
        }}
      >
        <Textarea
          ref={textareaRef}
          placeholder={placeholder}
          value={value}
          onChange={(e) => setValue(e.currentTarget.value)}
          onKeyDown={handleKeyDown}
          disabled={!activeWorkspaceId || status === 'disconnected' || status === 'connecting'}
          autosize
          minRows={1}
          maxRows={8}
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
            wrapper: {
              // 不使用伪选择器语法，交由全局 CSS 处理
            },
          }}
        />

        {/* 底部工具栏 */}
        <Group justify="space-between" mt={6}>
          <Group gap={8}>
            <ModelSelector />
            {value.length > 0 && (
              <Text size="xs" c="dimmed" style={{ opacity: 0.5, fontSize: 11 }}>
                {value.length} 字
              </Text>
            )}
          </Group>

          <Group gap={6}>
            <Text size="xs" c="dimmed" style={{ opacity: 0.4, fontSize: 11 }}>
              {canSend ? 'Enter 发送' : ''}
            </Text>

            <ModeSelector />

            {isStreaming ? (
              <Tooltip label="停止生成" withArrow>
                <ActionIcon
                  size="md"
                  color="red"
                  variant="light"
                  radius="md"
                  onClick={handleStop}
                >
                  <IconPlayerStop size={16} />
                </ActionIcon>
              </Tooltip>
            ) : (
              <Tooltip label={canSend ? '发送 (Enter)' : placeholder} withArrow>
                <ActionIcon
                  size="md"
                  color="indigo"
                  variant={canSend ? 'filled' : 'subtle'}
                  radius="md"
                  onClick={handleSend}
                  disabled={!canSend}
                  style={{
                    transition: 'all 0.15s ease',
                    boxShadow: canSend ? '0 2px 8px rgba(99,102,241,0.35)' : 'none',
                  }}
                >
                  <IconSend size={16} />
                </ActionIcon>
              </Tooltip>
            )}
          </Group>
        </Group>
      </Box>

      {/* 底部提示 */}
      <Text size="xs" c="dimmed" mt={6} style={{ textAlign: 'center', opacity: 0.4, fontSize: 11 }}>
        Flock Agent · AI 可能产生错误，请注意核实重要信息
      </Text>
    </Box>
  );
}
