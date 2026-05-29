import { useState, useEffect, useCallback, useRef } from 'react';
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
  Collapse,
} from '@mantine/core';
import {
  IconX,
  IconTerminal2,
  IconPlayerStop,
  IconSend,
  IconPlus,
  IconChevronDown,
  IconChevronRight,
  IconCheck,
  IconUser,
  IconMessageCircle,
} from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';
import { useWorkflowStore } from '../../../../store/workflowStore';
import { useUiStore } from '../../../../store/uiStore';
import { ExecutionPanelProps } from './types';
import { WorkflowStepItem } from './WorkflowStepItem';
import { HumanReviewCard } from './HumanReviewCard';
import { StartParametersForm } from './StartParametersForm';
import { useExecutionPanelMessages } from '../../../../hooks/useExecutionPanelMessages';
import { nodeConfig } from '../../nodeConfig';

export function ExecutionPanel({
  status,
  messages,
  onClose,
  startWorkflow,
  stopWorkflow,
  resumeWorkflow,
  isEmbedded = false,
  externalNodes,
  externalStartVariables,
  initialQuery,
  workflowName,
  activeInterrupt: externalActiveInterrupt,
  onClearExecution,
}: ExecutionPanelProps) {
  const { t } = useTranslation();
  const theme = useUiStore((s) => s.theme);
  const isDark = theme === 'dark';
  const { clearExecution } = useWorkflowStore();
  const [inputVal, setInputVal] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  const storeNodes = useWorkflowStore((s) => s.nodes);
  const nodes = externalNodes ?? storeNodes;

  const startNode = nodes.find((n: any) => n.type === 'start');
  const startVariables = externalStartVariables ?? (startNode?.data?.variables as any[]) ?? [
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

  const storeActiveInterrupt = useWorkflowStore((s) => s.activeInterrupt);
  const activeInterrupt = externalActiveInterrupt !== undefined ? externalActiveInterrupt : storeActiveInterrupt;
  const isInterrupted = activeInterrupt !== null;

  const statusColor =
    status === 'running' ? 'blue'
    : status === 'done' ? 'teal'
    : status === 'error' ? 'red'
    : isInterrupted ? 'orange'
    : 'gray';

  const customVars = startVariables.filter((v: any) => v.name !== 'query');

  // 首页带来的初始 query：在组件挂载后立即执行（优先用 pendingStartQuery，再用 initialQuery prop）
  const pendingStartQuery = useWorkflowStore((s) => s.pendingStartQuery);
  const initialQueryFiredRef = useRef(false);

  useEffect(() => {
    const q = pendingStartQuery ?? initialQuery;
    if (q && !initialQueryFiredRef.current && status === 'idle' && messages.length === 0) {
      initialQueryFiredRef.current = true;
      useWorkflowStore.getState().setPendingStartQuery(null);

      const hasCustomVars = customVars.length > 0;
      if (hasCustomVars) {
        // 如果有自定义预置参数，不自动执行，而是把初始 query 填入 formInputs 中的 query 以及 inputVal
        setInputVal(q);
        setFormInputs((prev) => ({ ...prev, query: q }));
      } else {
        // 如果没有自定义预置参数，可以直接执行
        const payload: Record<string, any> = { ...formInputs };
        payload['query'] = q;
        startWorkflow(JSON.stringify(payload));
        setInputVal('');
      }
    }
  }, [pendingStartQuery, initialQuery, status, messages.length, customVars.length]);

  const handleResume = useCallback((choice: string, feedback?: string) => {
    const payload: Record<string, unknown> = { choice };
    if (feedback) payload.feedback = feedback;
    resumeWorkflow(payload);
  }, [resumeWorkflow]);

  const { steps, handleResume: resumeWithTracking } = useExecutionPanelMessages({
    messages,
    status,
    isInterrupted,
    activeInterrupt,
    handleResume,
    nodes,
  });
  // 用 hook 内部 wrapped 版本（会在调用前记录 action label）
  const trackedResume = resumeWithTracking;

  // 新步骤时自动滚到底
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [steps.length]);

  // 工作流大组默认折叠
  const [workflowExpanded, setWorkflowExpanded] = useState(false);

  const allDone = steps.length > 0 && steps.every((s) => s.status === 'done' || s.status === 'error');

  // answer 和 human 步骤：在折叠组外额外显示
  const prominentSteps = steps.filter((s) => s.nodeType === 'answer' || s.isInterrupt);

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
    // 每次新运行时展开工作流组
    setWorkflowExpanded(false);
  };

  const handleClear = () => {
    initialQueryFiredRef.current = false;
    if (onClearExecution) {
      onClearExecution();
    } else {
      clearExecution();
    }
  };

  return (
    <Box
      style={{
        borderLeft: isEmbedded ? 'none' : '1px solid var(--flock-border-subtle)',
        background: isEmbedded ? 'transparent' : 'var(--flock-bg-deepest)',
        width: isEmbedded ? '100%' : 380,
        height: '100%',
        flex: isEmbedded ? 1 : undefined,
        minHeight: isEmbedded ? 0 : undefined,
        flexShrink: isEmbedded ? undefined : 0,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        boxShadow: isEmbedded ? 'none' : '-2px 0 12px rgba(0, 0, 0, 0.08)',
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
          {isEmbedded ? (
            <Text size="xs" fw={600} style={{ color: 'var(--flock-text-dim)' }}>
              ⚡ {workflowName || t('workflow.execution.title', 'Execution Output')}
            </Text>
          ) : (
            <>
              <IconTerminal2 size={14} style={{ color: 'var(--flock-text-muted)' }} />
              <Text size="xs" fw={600} style={{ color: 'var(--flock-text-dim)', letterSpacing: '0.03em' }}>
                {t('workflow.execution.title', 'Execution Output')}
              </Text>
            </>
          )}
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
              onClick={handleClear}
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
          {!isEmbedded && onClose && (
            <ActionIcon variant="subtle" size="xs" color="gray" onClick={onClose}>
              <IconX size={14} />
            </ActionIcon>
          )}
        </Group>
      </Group>


      {/* Main content */}
      <Box
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--flock-bg-base)',
          minHeight: 0,
        }}
      >
        {steps.length === 0 ? (
          /* 无执行记录时 */
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
          /* 有执行记录时 */
          <ScrollArea style={{ flex: 1 }} px="sm" py="sm">
            <Stack gap={8}>

              {/* ── 工作流折叠组（默认折叠，包含所有步骤） ── */}
              <Box
                style={{
                  borderRadius: 10,
                  border: '1px solid var(--flock-border-subtle)',
                  overflow: 'hidden',
                  background: 'var(--flock-bg-surface)',
                }}
              >
                {/* 组标题行 */}
                <Box
                  onClick={() => setWorkflowExpanded((v) => !v)}
                  style={{
                    padding: '8px 12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    cursor: 'pointer',
                    userSelect: 'none',
                    borderBottom: workflowExpanded ? '1px solid var(--flock-border-subtle)' : 'none',
                  }}
                >
                  {/* 完成状态图标 */}
                  {allDone ? (
                    <Box
                      style={{
                        width: 16, height: 16, borderRadius: '50%',
                        background: '#10b981',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <IconCheck size={9} color="#fff" stroke={3} />
                    </Box>
                  ) : (
                    <Box
                      style={{
                        width: 16, height: 16, borderRadius: '50%',
                        border: `2px solid ${status === 'running' ? '#3b82f6' : '#6b7280'}`,
                        flexShrink: 0,
                        animation: status === 'running' ? 'pulse 1.5s ease-in-out infinite' : 'none',
                      }}
                    />
                  )}

                  <Text size="xs" fw={600} style={{ flex: 1, color: 'var(--flock-text-bright)' }}>
                    {t('workflow.execution.workflowGroup', '工作流')}
                  </Text>

                  {/* 步骤数量 */}
                  <Text size="xs" c="dimmed" style={{ fontSize: 10 }}>
                    {steps.length} {t('workflow.execution.steps', '步')}
                  </Text>

                  <ActionIcon size="xs" variant="transparent" color="gray">
                    {workflowExpanded ? <IconChevronDown size={13} /> : <IconChevronRight size={13} />}
                  </ActionIcon>
                </Box>

                {/* 步骤列表（折叠内容） */}
                <Collapse in={workflowExpanded}>
                  <Stack gap={3} p="xs">
                    {steps.map((step) => (
                      <WorkflowStepItem
                        key={step.id}
                        step={step}
                        isDark={isDark}
                      />
                    ))}
                  </Stack>
                </Collapse>
              </Box>

              {/* ── answer / human 步骤在外面额外显示 ── */}
              {prominentSteps.map((step) => {
                /* Human 审查卡片 */
                if (step.isInterrupt) {
                  return (
                  <HumanReviewCard
                      key={`prominent-${step.id}`}
                      interruptData={step.interruptData ?? {}}
                      onResume={trackedResume}
                      isDark={isDark}
                      isResolved={step.interruptResolved}
                      resolvedActionLabel={step.resolvedActionLabel}
                      resolvedFeedback={step.resolvedFeedback}
                      displayName={step.displayName}
                    />
                  );
                }

                /* Answer 输出卡片 */
                const answerCfg = nodeConfig['answer'];
                return (
                  <Box
                    key={`prominent-${step.id}`}
                    style={{
                      borderRadius: 10,
                      border: '1px solid var(--flock-border-subtle)',
                      overflow: 'hidden',
                      background: 'var(--flock-bg-surface)',
                    }}
                  >
                    {/* 标题行 */}
                    <Box
                      style={{
                        padding: '7px 12px',
                        background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                        borderBottom: '1px solid var(--flock-border-subtle)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 7,
                      }}
                    >
                      <Box
                        style={{
                          width: 20, height: 20, borderRadius: 5,
                          background: answerCfg.colorHex,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        <IconMessageCircle size={11} color="#fff" />
                      </Box>
                      <Text size="xs" fw={600} style={{ color: 'var(--flock-text-bright)', flex: 1, fontSize: 12 }}>
                        {step.displayName}
                      </Text>
                      {step.status === 'running' && (
                        <Box style={{ animation: 'spin 1s linear infinite', display: 'flex' }}>
                          <IconCheck size={13} style={{ color: '#3b82f6' }} />
                        </Box>
                      )}
                    </Box>

                    {/* 输出内容 */}
                    <Box style={{ padding: '10px 14px' }}>
                      {step.outputText ? (
                        <Box className="markdown-body">
                          <ReactMarkdown>{step.outputText}</ReactMarkdown>
                        </Box>
                      ) : (
                        <Text size="xs" c="dimmed" style={{ fontStyle: 'italic', fontSize: 11 }}>
                          {t('workflow.execution.generating', '生成中...')}
                        </Text>
                      )}
                    </Box>
                  </Box>
                );
              })}

            </Stack>
            <div ref={bottomRef as any} />
          </ScrollArea>
        )}

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
