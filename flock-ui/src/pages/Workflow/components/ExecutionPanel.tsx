import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import {
  Box,
  Text,
  Group,
  ActionIcon,
  Badge,
  TextInput,
  Button,
  NumberInput,
  Switch,
  Select,
  Stack,
  Textarea,
  ScrollArea,
} from '@mantine/core';
import {
  IconX,
  IconTerminal2,
  IconPlayerStop,
  IconSend,
  IconPlus,
  IconUser,
  IconCheck,
} from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { MessageBubble } from '../../../components/chat/components/MessageBubble';
import { ChatMessage } from '../../../types/protocol';
import { useWorkflowStore } from '../../../store/workflowStore';
import { useUiStore } from '../../../store/uiStore';

export interface ExecutionMessage {
  type: 'user' | 'text_delta' | 'thinking' | 'info' | 'error' | 'done';
  content: string;
  nodeId?: string;
  timestamp: number;
}

interface HumanAction {
  key: string;
  label: string;
  enable_feedback?: boolean;
}

interface InterruptData {
  node_id?: string;
  title?: string;
  actions?: HumanAction[];
  interaction_type?: string;
}

interface ExecutionPanelProps {
  status: 'idle' | 'running' | 'done' | 'error';
  messages: ExecutionMessage[];
  onClose: () => void;
  startWorkflow: (input: string) => Promise<void>;
  stopWorkflow: () => Promise<void>;
  resumeWorkflow: (choiceValue: unknown) => Promise<void>;
}

/** 内联 HITL 操作卡片（渲染在消息气泡下方） */
function HumanReviewCard({
  interruptData,
  onResume,
  isDark,
  isResolved,
}: {
  interruptData: InterruptData;
  onResume: (choice: string, feedback?: string) => void;
  isDark: boolean;
  isResolved: boolean;
}) {
  const { t } = useTranslation();
  const [pendingAction, setPendingAction] = useState<HumanAction | null>(null);
  const [feedback, setFeedback] = useState('');

  const actions = interruptData.actions ?? [
    { key: 'action_1', label: 'Approve', enable_feedback: false },
    { key: 'action_2', label: 'Reject', enable_feedback: true },
  ];

  const actionColors = ['blue', 'violet', 'teal', 'grape', 'pink', 'orange'];

  const handleActionClick = (act: HumanAction) => {
    if (isResolved) return;
    if (act.enable_feedback) {
      // 先展开 feedback 输入框
      setPendingAction(act);
      setFeedback('');
    } else {
      onResume(act.key);
    }
  };

  const handleConfirmWithFeedback = () => {
    if (!pendingAction) return;
    onResume(pendingAction.key, feedback.trim() || undefined);
    setPendingAction(null);
    setFeedback('');
  };

  const handleCancelFeedback = () => {
    setPendingAction(null);
    setFeedback('');
  };

  return (
    <Box
      style={{
        margin: '4px 0 8px 0',
        borderRadius: 10,
        background: isResolved
          ? 'var(--flock-bg-surface)'
          : 'var(--flock-bg-raised)',
        border: `1px solid ${isResolved ? 'var(--flock-border-subtle)' : 'var(--flock-border-dim)'}`,
        overflow: 'hidden',
        opacity: isResolved ? 0.7 : 1,
      }}
    >
      {/* 标题行 */}
      <Box
        style={{
          padding: '7px 12px',
          background: 'var(--flock-bg-surface)',
          borderBottom: '1px solid var(--flock-border-dim)',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}
      >
        <IconUser size={12} style={{ color: 'var(--flock-accent)', flexShrink: 0 }} />
        <Text size="xs" fw={600} c={isDark ? 'orange.3' : 'orange.8'} style={{ flex: 1 }}>
          {interruptData.title || t('workflow.execution.humanReview', 'Human Review Required')}
        </Text>
        {isResolved && (
          <Badge size="xs" color="teal" variant="light">
            {t('workflow.execution.resolved', 'Resolved')}
          </Badge>
        )}
      </Box>

      {/* 操作按钮 */}
      {!isResolved && !pendingAction && (
        <Box style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {actions.map((act, idx) => (
            <Button
              key={act.key}
              size="xs"
              variant={idx === 0 ? 'filled' : 'default'}
              color={idx === 0 ? actionColors[0] : undefined}
              onClick={() => handleActionClick(act)}
              style={{ justifyContent: 'flex-start', fontWeight: 600 }}
              leftSection={act.enable_feedback ? <IconUser size={11} /> : undefined}
            >
              {act.label || act.key}
            </Button>
          ))}
        </Box>
      )}

      {/* Feedback 输入区（点击某个 enable_feedback 的 action 后展示） */}
      {!isResolved && pendingAction && (
        <Box style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Text size="xs" c="dimmed">
            {pendingAction.label} — {t('workflow.execution.feedbackOptional', 'Add optional comment:')}
          </Text>
          <Textarea
            placeholder={t('workflow.execution.feedbackPlaceholder', 'Add optional comment...')}
            value={feedback}
            onChange={(e) => setFeedback(e.currentTarget.value)}
            size="xs"
            minRows={2}
            autoFocus
            styles={{
              input: {
                fontSize: '12px',
                backgroundColor: 'var(--flock-bg-deepest)',
                border: '1px solid var(--flock-border-dim)',
              },
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleConfirmWithFeedback();
              }
              if (e.key === 'Escape') {
                handleCancelFeedback();
              }
            }}
          />
          <Group gap="xs">
            <Button
              size="xs"
              color="blue"
              leftSection={<IconCheck size={11} />}
              onClick={handleConfirmWithFeedback}
              style={{ flex: 1 }}
            >
              {t('workflow.execution.confirmAction', 'Confirm')} — {pendingAction.label}
            </Button>
            <Button size="xs" variant="subtle" color="gray" onClick={handleCancelFeedback}>
              {t('common.cancel', 'Cancel')}
            </Button>
          </Group>
        </Box>
      )}
    </Box>
  );
}

export function ExecutionPanel({
  status,
  messages,
  onClose,
  startWorkflow,
  stopWorkflow,
  resumeWorkflow,
}: ExecutionPanelProps) {
  const { t } = useTranslation();
  const theme = useUiStore((s) => s.theme);
  const isDark = theme === 'dark';
  const { clearExecution } = useWorkflowStore();
  const [inputVal, setInputVal] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  // 自动滚到底的 effect 会在 chatMessages 的 useMemo 之后定义

  const startNode = useWorkflowStore((s) => s.nodes.find((n) => n.type === 'start'));
  const startVariables = (startNode?.data?.variables as any[]) ?? [
    { type: 'string', name: 'query', label: 'Query', required: true }
  ];

  const [formInputs, setFormInputs] = useState<Record<string, any>>({});

  useEffect(() => {
    const initial: Record<string, any> = {};
    startVariables.forEach((v) => {
      initial[v.name] = v.default_value ?? '';
    });
    setFormInputs(initial);
  }, [startVariables]);

  const activeInterrupt = useWorkflowStore((s) => s.activeInterrupt);
  const isInterrupted = activeInterrupt !== null;

  const statusColor =
    status === 'running' ? 'blue'
    : status === 'done' ? 'teal'
    : status === 'error' ? 'red'
    : isInterrupted ? 'orange'
    : 'gray';

  const customVars = startVariables.filter((v: any) => v.name !== 'query');

  const handleResume = useCallback((choice: string, feedback?: string) => {
    const payload: Record<string, unknown> = { choice };
    if (feedback) payload.feedback = feedback;
    resumeWorkflow(payload);
  }, [resumeWorkflow]);

  // 键盘数字键快速选择 action（仅无 feedback pending 时生效）
  useEffect(() => {
    if (!isInterrupted || !activeInterrupt?.actions) return;
    const actions = activeInterrupt.actions as HumanAction[];
    const handleKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea') return;
      const idx = parseInt(e.key) - 1;
      if (!isNaN(idx) && idx >= 0 && idx < actions.length) {
        const act = actions[idx];
        if (!act.enable_feedback) {
          e.preventDefault();
          handleResume(act.key);
        }
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isInterrupted, activeInterrupt, handleResume]);

  // 1. 把 raw messages 转换成 ChatPanel 可识别的 ChatMessage[]
  //    遇到 type==='interrupt' 时，在 chatMessages 里记录一个带 interruptData 的特殊消息
  const { chatMessages, interruptIndices } = useMemo(() => {
    const result: ChatMessage[] = [];
    const interruptMap: Record<number, { data: InterruptData; resolved: boolean }> = {};
    let currentAssistantMsg: ChatMessage | null = null;

    for (const msg of messages) {
      if ((msg as any).type === 'interrupt') {
        // Flush previous assistant msg
        if (currentAssistantMsg) {
          currentAssistantMsg.streaming = false;
          result.push(currentAssistantMsg);
          currentAssistantMsg = null;
        }
        // Parse interrupt data from content
        let interruptData: InterruptData = {};
        try { interruptData = JSON.parse(msg.content); } catch (_) {}
        // Insert a placeholder assistant message at this index
        const msgIdx = result.length;
        result.push({
          id: `interrupt-${msg.timestamp}`,
          role: 'assistant',
          chunks: [{ kind: 'text', text: '' }],
          streaming: false,
          timestamp: msg.timestamp,
        });
        // Mark resolved if activeInterrupt is now null (already answered)
        interruptMap[msgIdx] = { data: interruptData, resolved: false };
        continue;
      }

      if (msg.type === 'user') {
        if (currentAssistantMsg) {
          result.push(currentAssistantMsg);
          currentAssistantMsg = null;
        }
        // Mark all previous interrupts as resolved when user resumes
        Object.keys(interruptMap).forEach((k) => {
          const ki = Number(k);
          interruptMap[ki] = { ...interruptMap[ki], resolved: true };
        });
        result.push({
          id: `user-${msg.timestamp}`,
          role: 'user',
          chunks: [{ kind: 'text', text: msg.content }],
          streaming: false,
          timestamp: msg.timestamp,
        });
      } else if (msg.type === 'text_delta' || msg.type === 'thinking') {
        const nodeId = msg.nodeId || 'assistant';
        const displayNodeName = `**[${nodeId}]**\n`;

        if (!currentAssistantMsg || currentAssistantMsg.id !== `assistant-${nodeId}`) {
          if (currentAssistantMsg) {
            currentAssistantMsg.streaming = false;
            result.push(currentAssistantMsg);
          }
          currentAssistantMsg = {
            id: `assistant-${nodeId}`,
            role: 'assistant',
            chunks: [],
            streaming: status === 'running',
            timestamp: msg.timestamp,
          };
        }

        if (msg.type === 'thinking') {
          let lastChunk = currentAssistantMsg.chunks[currentAssistantMsg.chunks.length - 1];
          if (!lastChunk || lastChunk.kind !== 'thinking') {
            lastChunk = { kind: 'thinking', text: msg.content, collapsed: false };
            currentAssistantMsg.chunks.push(lastChunk);
          } else {
            lastChunk.text += msg.content;
          }
        } else {
          let lastChunk = currentAssistantMsg.chunks[currentAssistantMsg.chunks.length - 1];
          if (!lastChunk || lastChunk.kind !== 'text') {
            const prefix = currentAssistantMsg.chunks.length === 0 ? displayNodeName : '';
            lastChunk = { kind: 'text', text: prefix + msg.content };
            currentAssistantMsg.chunks.push(lastChunk);
          } else {
            lastChunk.text += msg.content;
          }
        }
      }
    }

    if (currentAssistantMsg) {
      if (status !== 'running') currentAssistantMsg.streaming = false;
      result.push(currentAssistantMsg);
    }

    return { chatMessages: result, interruptIndices: interruptMap };
  }, [messages, status]);

  // 当 activeInterrupt 变为 null，说明中断已解决，标记最后一个 interrupt 为 resolved
  const resolvedInterrupts = useMemo(() => {
    const copy = { ...interruptIndices };
    if (!isInterrupted) {
      Object.keys(copy).forEach((k) => {
        copy[Number(k)] = { ...copy[Number(k)], resolved: true };
      });
    }
    return copy;
  }, [interruptIndices, isInterrupted]);

  // 新消息时自动滚到底
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages.length]);

  const handleStart = () => {
    const missing = customVars.filter((v: any) => v.required && (formInputs[v.name] === undefined || formInputs[v.name] === ''));
    if (missing.length > 0) {
      alert(t('workflow.execution.missingParams', {
        defaultValue: `Missing required parameter(s): ${missing.map((m: any) => m.label || m.name).join(', ')}`,
        names: missing.map((m: any) => m.label || m.name).join(', ')
      }));
      return;
    }
    const payload: Record<string, any> = { ...formInputs };
    payload['query'] = inputVal;
    startWorkflow(JSON.stringify(payload));
    setInputVal('');
  };

  return (
    <Box
      style={{
        borderLeft: '1px solid var(--flock-border-subtle)',
        background: 'var(--flock-bg-deepest)',
        width: 380,
        height: '100%',
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        boxShadow: '-2px 0 12px rgba(0, 0, 0, 0.08)',
      }}
    >
      {/* Panel header */}
      <Group
        px="sm"
        justify="space-between"
        style={{
          height: 48,
          flexShrink: 0,
          borderBottom: '1px solid var(--flock-border-subtle)',
          background: 'var(--flock-bg-surface)',
        }}
      >
        <Group gap="xs">
          <IconTerminal2 size={14} style={{ color: 'var(--flock-text-muted)' }} />
          <Text size="xs" fw={600} style={{ color: 'var(--flock-text-dim)', letterSpacing: '0.03em' }}>
            {t('workflow.execution.title', 'Execution Output')}
          </Text>
          <Badge size="xs" color={statusColor} variant="light" style={{ fontSize: 9 }}>
            {isInterrupted
              ? t('workflow.execution.waiting', 'WAITING')
              : t(`workflow.execution.${status}`, status.toUpperCase())}
          </Badge>
        </Group>

        <Group gap="xs">
          {status !== 'running' && !isInterrupted && messages.length > 0 && (
            <Button
              size="xs"
              variant="subtle"
              color="blue"
              leftSection={<IconPlus size={12} />}
              onClick={clearExecution}
              style={{ height: 24, fontSize: 10, padding: '0 8px' }}
            >
              {t('workflow.execution.newChat', 'New Chat')}
            </Button>
          )}
          {status === 'running' && (
            <Button
              size="xs"
              variant="subtle"
              color="red"
              leftSection={<IconPlayerStop size={12} />}
              onClick={stopWorkflow}
              style={{ height: 24, fontSize: 10, padding: '0 8px' }}
            >
              {t('common.stop', 'Stop')}
            </Button>
          )}
          <ActionIcon variant="subtle" size="xs" color="gray" onClick={onClose}>
            <IconX size={14} />
          </ActionIcon>
        </Group>
      </Group>

      {/* Main chat layout */}
      <Box
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--flock-bg-base)',
          minHeight: 0,
        }}
      >
        <Box style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {chatMessages.length === 0 ? (
            customVars.length > 0 ? (
              <ScrollArea style={{ flex: 1 }} p="md">
                <Stack gap="md" style={{ padding: 12 }}>
                  <Box>
                    <Text size="xs" fw={700} style={{ color: 'var(--flock-text-bright)' }}>
                      ✨ {t('workflow.execution.inputsTitle', 'Start Parameters')}
                    </Text>
                    <Text size="xs" c="dimmed" style={{ fontSize: 10 }}>
                      {t('workflow.execution.inputsDesc', 'Please configure initial parameters for the workflow before running.')}
                    </Text>
                  </Box>

                  <Stack gap="sm" style={{ background: 'var(--flock-bg-surface)', padding: 12, borderRadius: 12, border: '1px solid var(--flock-border-subtle)' }}>
                    {customVars.map((v: any) => {
                      const label = `${v.label || v.name} (${v.name})`;
                      const required = v.required;
                      if (v.type === 'boolean') {
                        return (
                          <Switch
                            key={v.name}
                            label={label}
                            checked={!!formInputs[v.name]}
                            onChange={(e) => setFormInputs({ ...formInputs, [v.name]: e.currentTarget.checked })}
                            size="xs"
                          />
                        );
                      }
                      if (v.type === 'paragraph') {
                        return (
                          <Textarea
                            key={v.name}
                            label={label}
                            placeholder={v.default_value ?? ''}
                            value={formInputs[v.name] ?? ''}
                            onChange={(e) => setFormInputs({ ...formInputs, [v.name]: e.target.value })}
                            size="xs"
                            minRows={2}
                            required={required}
                          />
                        );
                      }
                      if (v.type === 'select') {
                        const selectOptions = (v.options as string[]) ?? [];
                        return (
                          <Select
                            key={v.name}
                            label={label}
                            placeholder={v.default_value ?? ''}
                            data={selectOptions.map((o) => ({ value: o, label: o }))}
                            value={formInputs[v.name] ?? ''}
                            onChange={(val) => setFormInputs({ ...formInputs, [v.name]: val })}
                            size="xs"
                            required={required}
                            clearable
                          />
                        );
                      }
                      if (v.type === 'number') {
                        return (
                          <NumberInput
                            key={v.name}
                            label={label}
                            placeholder={String(v.default_value ?? '')}
                            value={formInputs[v.name]}
                            onChange={(val) => setFormInputs({ ...formInputs, [v.name]: val !== '' && val !== undefined ? Number(val) : undefined })}
                            size="xs"
                            required={required}
                          />
                        );
                      }
                      return (
                        <TextInput
                          key={v.name}
                          label={label}
                          placeholder={v.default_value ?? ''}
                          value={formInputs[v.name] ?? ''}
                          onChange={(e) => setFormInputs({ ...formInputs, [v.name]: e.target.value })}
                          size="xs"
                          required={required}
                        />
                      );
                    })}
                  </Stack>
                </Stack>
              </ScrollArea>
            ) : (
              <Box
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: 0.6,
                  padding: 20,
                }}
              >
                <Text size="xs" c="dimmed" ta="center">
                  🤖 {t('workflow.execution.noOutput', 'No active execution. Enter initial query below to run.')}
                </Text>
              </Box>
            )
          ) : (
            // 自定义渲染：所有消息 + HumanReviewCard 在同一 ScrollArea 里
            <ScrollArea style={{ flex: 1 }} px="md" py="md">
              <Stack gap="lg" pb="lg" style={{ width: '100%' }}>
                {chatMessages.map((msg, idx) => {
                  const interruptInfo = resolvedInterrupts[idx];
                  if (interruptInfo) {
                    return (
                      <Box key={msg.id}>
                        <HumanReviewCard
                          interruptData={interruptInfo.data}
                          onResume={handleResume}
                          isDark={isDark}
                          isResolved={interruptInfo.resolved}
                        />
                      </Box>
                    );
                  }
                  // 空内容的消息（如 interrupt 占位消息）不渲染
                  const hasContent = msg.chunks.some(c => c.kind !== 'text' || c.text.trim().length > 0);
                  if (!hasContent) return null;
                  return <MessageBubble key={msg.id} message={msg} />;
                })}
                <div ref={bottomRef as any} />
              </Stack>
            </ScrollArea>
          )}
        </Box>

        {/* Bottom input area */}
        <Box p="xs" style={{ borderTop: '1px solid var(--flock-border-subtle)', background: 'var(--flock-bg-surface)' }}>
          {isInterrupted ? (
            <Text size="xs" c="dimmed" ta="center" style={{ padding: '4px 0' }}>
              ⏳ {t('workflow.execution.waitingHint', 'Waiting for your selection above...')}
            </Text>
          ) : (
            <Group gap="xs">
              <TextInput
                placeholder={t('workflow.execution.inputPlaceholder', 'Enter initial query...')}
                size="xs"
                value={inputVal}
                onChange={(e) => setInputVal(e.currentTarget.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleStart();
                }}
                disabled={status === 'running'}
                style={{ flex: 1 }}
                styles={{
                  input: {
                    background: 'var(--flock-bg-base)',
                    borderColor: 'var(--flock-border-dim)',
                  }
                }}
              />
              <Button
                size="xs"
                color="blue"
                onClick={handleStart}
                disabled={!inputVal.trim() || status === 'running'}
                leftSection={<IconSend size={12} />}
              >
                {t('workflow.execution.run', 'Send')}
              </Button>
            </Group>
          )}
        </Box>
      </Box>
    </Box>
  );
}
