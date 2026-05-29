import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import {
  Box,
  Text,
  Group,
  ActionIcon,
  Badge,
  TextInput,
  Button,
  ScrollArea,
  Stack,
} from '@mantine/core';
import {
  IconX,
  IconTerminal2,
  IconPlayerStop,
  IconSend,
  IconPlus,
} from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { MessageBubble } from '../../../../components/chat/components/MessageBubble';
import { useWorkflowStore } from '../../../../store/workflowStore';
import { useUiStore } from '../../../../store/uiStore';
import { ExecutionPanelProps, HumanAction, InterruptData } from './types';
import { HumanReviewCard } from './HumanReviewCard';
import { StartParametersForm } from './StartParametersForm';
import { useExecutionPanelMessages } from '../../../../hooks/useExecutionPanelMessages';

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

  const { chatMessages, resolvedInterrupts } = useExecutionPanelMessages({
    messages,
    status,
    isInterrupted,
    activeInterrupt,
    handleResume,
  });

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

                  <StartParametersForm
                    customVars={customVars}
                    formInputs={formInputs}
                    setFormInputs={setFormInputs}
                  />
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
