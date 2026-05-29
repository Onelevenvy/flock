import { useState, useCallback, useRef, useEffect } from 'react';
import type { Node } from 'reactflow';
import {
  Box,
  Button,
  Group,
  ScrollArea,
  Stack,
  Text,
  Badge,
  TextInput,
  Avatar,
  Paper,
  ActionIcon,
  Collapse,
} from '@mantine/core';
import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';
import {
  IconPlus,
  IconPlayerStop,
  IconSend,
  IconUser,
  IconCheck,
  IconChevronDown,
  IconChevronRight,
  IconMessageCircle,
} from '@tabler/icons-react';
import { useWorkflowChatExecution } from '../../../../hooks/useWorkflowChatExecution';
import { useExecutionPanelMessages } from '../../../../hooks/useExecutionPanelMessages';
import { StartParametersForm } from '../../../Workflow/components/ExecutionPanel/StartParametersForm';
import { HumanReviewCard } from '../../../Workflow/components/ExecutionPanel/HumanReviewCard';
import { WorkflowStepItem } from '../../../Workflow/components/ExecutionPanel/WorkflowStepItem';
import { nodeConfig } from '../../../Workflow/nodeConfig';
import { useUiStore } from '../../../../store/uiStore';
import { useWorkflowStore } from '../../../../store/workflowStore';
import type { WorkflowExecutionMessage } from '../../../../store/workflowStore';

interface WorkflowChatPanelProps {
  workflowId: string;
  workflowName: string;
  threadId: string;
  initialQuery?: string;
  startVariables?: any[];
  nodes?: Node[];
}

export function WorkflowChatPanel({
  workflowId,
  workflowName,
  threadId,
  initialQuery,
  startVariables,
  nodes = [],
}: WorkflowChatPanelProps) {
  const { t } = useTranslation();
  const theme = useUiStore((s) => s.theme);
  const isDark = theme === 'dark';

  // ── 本地执行消息（与 agentStore 完全隔离） ──
  const [execMessages, setExecMessages] = useState<WorkflowExecutionMessage[]>([]);
  const [status, setStatus] = useState<'idle' | 'running' | 'done' | 'error'>('idle');
  const [activeInterrupt, setActiveInterrupt] = useState<any>(null);
  const [inputVal, setInputVal] = useState('');

  // 每轮折叠状态
  const [expandedRounds, setExpandedRounds] = useState<Record<number, boolean>>({});
  const toggleRound = (idx: number) =>
    setExpandedRounds((prev) => ({ ...prev, [idx]: !prev[idx] }));

  const bottomRef = useRef<HTMLDivElement>(null);

  const startNode = nodes.find((n: any) => n.type === 'start');
  const vars = startVariables ?? (startNode?.data?.variables as any[]) ?? [
    { type: 'string', name: 'query', label: 'Query', required: true },
  ];
  const customVars = vars.filter((v: any) => v.name !== 'query');

  const [formInputs, setFormInputs] = useState<Record<string, any>>({});
  useEffect(() => {
    const initial: Record<string, any> = {};
    vars.forEach((v) => { initial[v.name] = v.default_value ?? ''; });
    setFormInputs(initial);
  }, []);

  // appendMessage：直接追加到本地 execMessages
  const appendMessage = useCallback((msg: any) => {
    setExecMessages((prev) => [...prev, msg as WorkflowExecutionMessage]);
  }, []);

  // handleResume：resume 工作流并清除 interrupt 状态
  const handleResume = useCallback(
    (choice: string, feedback?: string) => {
      resumeWorkflow({ choice, feedback });
      setActiveInterrupt(null);
    },
    // resumeWorkflow 在下方定义，用 ref 避免循环依赖
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const { startWorkflow, resumeWorkflow, stopWorkflow } = useWorkflowChatExecution({
    workflowId,
    threadId,
    onMessage: appendMessage,
    onStatusChange: setStatus,
    onInterrupt: setActiveInterrupt,
  });

  // 用 ref 让 handleResume 拿到最新的 resumeWorkflow
  const resumeWorkflowRef = useRef(resumeWorkflow);
  useEffect(() => { resumeWorkflowRef.current = resumeWorkflow; }, [resumeWorkflow]);

  const handleResumeStable = useCallback((choice: string, feedback?: string) => {
    resumeWorkflowRef.current({ choice, feedback });
    setActiveInterrupt(null);
  }, []);

  // ── useExecutionPanelMessages 转换为 rounds ──
  const { rounds, handleResume: trackedResume } = useExecutionPanelMessages({
    messages: execMessages,
    status,
    isInterrupted: activeInterrupt !== null,
    activeInterrupt,
    handleResume: handleResumeStable,
    nodes,
  });

  // 新轮次时自动滚到底
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [rounds.length]);

  // 清除执行状态
  const handleClearExecution = useCallback(() => {
    setExecMessages([]);
    setStatus('idle');
    setActiveInterrupt(null);
    setExpandedRounds({});
  }, []);

  // 首页带来的初始 query
  const pendingStartQuery = useWorkflowStore((s) => s.pendingStartQuery);
  const initialQueryFiredRef = useRef(false);

  useEffect(() => {
    const q = pendingStartQuery ?? initialQuery;
    if (q && !initialQueryFiredRef.current && status === 'idle' && execMessages.length === 0) {
      initialQueryFiredRef.current = true;
      useWorkflowStore.getState().setPendingStartQuery(null);
      if (customVars.length > 0) {
        setInputVal(q);
        setFormInputs((prev) => ({ ...prev, query: q }));
      } else {
        const payload: Record<string, any> = { ...formInputs };
        payload['query'] = q;
        startWorkflow(JSON.stringify(payload));
        setInputVal('');
      }
    }
  }, [pendingStartQuery, initialQuery, status, execMessages.length, customVars.length, formInputs, startWorkflow]);

  const handleStart = () => {
    const missing = customVars.filter(
      (v: any) => v.required && (formInputs[v.name] === undefined || formInputs[v.name] === '')
    );
    if (missing.length > 0) {
      alert(
        t('workflow.execution.missingParams', {
          defaultValue: `Missing required parameter(s): ${missing.map((m: any) => m.label || m.name).join(', ')}`,
          names: missing.map((m: any) => m.label || m.name).join(', '),
        })
      );
      return;
    }
    const payload: Record<string, any> = { ...formInputs };
    payload['query'] = inputVal;
    startWorkflow(JSON.stringify(payload));
    setInputVal('');
    setExpandedRounds({});
  };

  const statusColor =
    status === 'running' ? 'blue'
    : status === 'done' ? 'teal'
    : status === 'error' ? 'red'
    : activeInterrupt !== null ? 'orange'
    : 'gray';

  const hasMessages = execMessages.length > 0;

  return (
    <Box
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        background: 'var(--flock-bg-base)',
      }}
    >
      {/* ── Panel header ── */}
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
          <Text size="xs" fw={600} style={{ color: 'var(--flock-text-dim)' }}>
            ⚡ {workflowName || t('workflow.execution.title', 'Execution Output')}
          </Text>
          <Badge size="xs" color={statusColor} variant="light" style={{ fontSize: 9 }}>
            {activeInterrupt !== null
              ? t('workflow.execution.waiting', 'WAITING')
              : t(`workflow.execution.${status}`, status.toUpperCase())}
          </Badge>
        </Group>

        <Group gap="xs">
          {status !== 'running' && activeInterrupt === null && hasMessages && (
            <Button
              size="xs"
              variant="subtle"
              color="blue"
              leftSection={<IconPlus size={12} />}
              onClick={handleClearExecution}
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
        </Group>
      </Group>

      {/* ── Main content ── */}
      <Box style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, background: 'var(--flock-bg-base)' }}>

        {!hasMessages && customVars.length > 0 ? (
          /* 无消息且有自定义变量：显示参数表单 */
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

        ) : !hasMessages ? (
          /* 无消息且无自定义变量：空状态提示 */
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

        ) : (
          /* 有执行记录：按轮次渲染（与调试面板完全一致） */
          <ScrollArea style={{ flex: 1 }} px="sm" py="sm">
            <Stack gap={12}>

              {rounds.map((round) => {
                const isExpanded = !!expandedRounds[round.index];
                const roundAllDone =
                  round.steps.length > 0 &&
                  round.steps.every((s) => s.status === 'done' || s.status === 'error');
                const roundProminentSteps = round.steps.filter(
                  (s) => s.nodeType === 'answer' || s.isInterrupt
                );

                return (
                  <Stack key={round.index} gap={8}>

                    {/* 用户输入气泡 */}
                    {round.userText && (
                      <Box
                        style={{
                          display: 'flex',
                          flexDirection: 'row-reverse',
                          alignItems: 'flex-start',
                          gap: 8,
                        }}
                      >
                        <Avatar
                          size={28}
                          radius="xl"
                          style={{
                            background: 'var(--flock-bg-surface)',
                            border: '1px solid var(--flock-border-dim)',
                            flexShrink: 0,
                          }}
                        >
                          <IconUser size={14} color="var(--flock-text-dim)" />
                        </Avatar>
                        <Paper
                          p="xs"
                          radius="lg"
                          style={{
                            maxWidth: '80%',
                            background: 'var(--flock-accent-soft)',
                            border: '1px solid var(--flock-border-base)',
                            borderRadius: '18px 4px 18px 18px',
                          }}
                        >
                          <Text
                            size="sm"
                            style={{
                              color: 'var(--flock-text-primary)',
                              lineHeight: 1.6,
                              whiteSpace: 'pre-wrap',
                              wordBreak: 'break-word',
                            }}
                          >
                            {round.userText}
                          </Text>
                        </Paper>
                      </Box>
                    )}

                    {/* 工作流折叠组 */}
                    {round.steps.length > 0 && (
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
                          onClick={() => toggleRound(round.index)}
                          style={{
                            padding: '8px 12px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            cursor: 'pointer',
                            userSelect: 'none',
                            borderBottom: isExpanded ? '1px solid var(--flock-border-subtle)' : 'none',
                          }}
                        >
                          {roundAllDone ? (
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

                          <Text size="xs" c="dimmed" style={{ fontSize: 10 }}>
                            {round.steps.length} {t('workflow.execution.steps', '步')}
                          </Text>

                          <ActionIcon size="xs" variant="transparent" color="gray">
                            {isExpanded ? <IconChevronDown size={13} /> : <IconChevronRight size={13} />}
                          </ActionIcon>
                        </Box>

                        {/* 步骤列表（折叠内容） */}
                        <Collapse in={isExpanded}>
                          <Stack gap={3} p="xs">
                            {round.steps.map((step) => (
                              <WorkflowStepItem key={step.id} step={step} isDark={isDark} />
                            ))}
                          </Stack>
                        </Collapse>
                      </Box>
                    )}

                    {/* answer / human 步骤在折叠组外显示 */}
                    {roundProminentSteps.map((step) => {
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
                );
              })}

            </Stack>
            <div ref={bottomRef} />
          </ScrollArea>
        )}

        {/* ── 底部输入区 ── */}
        <Box
          p="xs"
          style={{ borderTop: '1px solid var(--flock-border-subtle)', background: 'var(--flock-bg-surface)' }}
        >
          {activeInterrupt !== null ? (
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
                onKeyDown={(e) => { if (e.key === 'Enter') handleStart(); }}
                disabled={status === 'running'}
                style={{ flex: 1 }}
                styles={{
                  input: {
                    background: 'var(--flock-bg-base)',
                    borderColor: 'var(--flock-border-dim)',
                  },
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
