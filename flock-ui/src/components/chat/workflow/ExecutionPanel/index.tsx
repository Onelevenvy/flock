import { useState, useEffect, useCallback, useRef } from 'react';
import { Box, Text, ScrollArea, Stack } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { useWorkflowStore } from '../../../../store/workflowStore';
import { useUiStore } from '../../../../store/uiStore';
import { useAgentStore } from '../../../../store/agentStore';
import { ToolApprovalInline } from '../../assistant/ToolApproval/ToolApprovalInline';
import { ExecutionPanelProps } from './types';
import { StartParametersForm } from './StartParametersForm';
import { useExecutionPanelMessages } from '../../../../hooks/useExecutionPanelMessages';
import { ExecutionPanelHeader } from './ExecutionPanelHeader';
import { ExecutionRoundItem } from './ExecutionRoundItem';
import { ExecutionBottomBar } from './ExecutionBottomBar';

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

  const pendingApprovals = useAgentStore((s) => s.pendingApprovals);
  const firstPending = pendingApprovals[0] ?? null;

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
    setFormInputs((prev) => {
      const keys = Object.keys(initial);
      const prevKeys = Object.keys(prev);
      const isDifferent =
        keys.length !== prevKeys.length ||
        keys.some((k) => prev[k] !== initial[k]);
      return isDifferent ? initial : prev;
    });
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

  const handleResume = useCallback((choice: string, feedback?: string, actionLabel?: string) => {
    const payload: Record<string, unknown> = { choice };
    if (feedback) payload.feedback = feedback;
    resumeWorkflow(payload, actionLabel, feedback);
  }, [resumeWorkflow]);

  const { steps, rounds, handleResume: resumeWithTracking } = useExecutionPanelMessages({
    messages,
    status,
    isInterrupted,
    activeInterrupt,
    handleResume,
    nodes,
  });
  const trackedResume = resumeWithTracking;

  // 新步骤时自动滚到底
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [steps.length]);

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
      <ExecutionPanelHeader
        isEmbedded={isEmbedded}
        workflowName={workflowName}
        status={status}
        statusColor={statusColor}
        isInterrupted={isInterrupted}
        hasMessages={messages.length > 0}
        onClear={handleClear}
        onStop={stopWorkflow}
        onClose={onClose}
      />

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
          /* 有执行记录时（按轮次渲染：用户气泡 + 工作流折叠组 + answer/human 卡片） */
          <ScrollArea style={{ flex: 1 }} px="sm" py="sm">
            <Stack gap={12}>
              {rounds.map((round) => (
                <ExecutionRoundItem
                  key={round.index}
                  round={round}
                  status={status}
                  isDark={isDark}
                  trackedResume={trackedResume}
                />
              ))}
            </Stack>
            <div ref={bottomRef as any} />
          </ScrollArea>
        )}

        {/* Tool approval card */}
        <ToolApprovalInline approval={firstPending} />

        {/* Bottom input area */}
        <ExecutionBottomBar
          isInterrupted={isInterrupted}
          status={status}
          inputVal={inputVal}
          setInputVal={setInputVal}
          handleStart={handleStart}
        />
      </Box>
    </Box>
  );
}
