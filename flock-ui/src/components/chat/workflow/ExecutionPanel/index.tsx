import { useState, useEffect, useCallback, useRef } from 'react';
import { Box, Text, ScrollArea, Stack, Button, Divider, Group } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { IconCheck, IconPlayerPlay, IconPlayerStop } from '@tabler/icons-react';
import { useWorkflowStore } from '@/store/workflowStore';
import { useUiStore } from '@/store/uiStore';
import { useAgentStore } from '@/store/agentStore';
import { ToolApprovalInline } from '@/components/chat/assistant/ToolApproval/ToolApprovalInline';
import { ExecutionPanelProps } from './types';
import { StartParametersForm } from './StartParametersForm';
import { useExecutionPanelMessages } from '@/hooks/useExecutionPanelMessages';
import { ExecutionPanelHeader } from './ExecutionPanelHeader';
import { ExecutionRoundItem } from './ExecutionRoundItem';
import { WorkflowChatInput } from './WorkflowChatInput';

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
  showDebugWorkspace,
  onToggleDebugWorkspace,
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

  // 首页带来的初始 query：在组件挂载后立即执行（优先用 pendingStartQuery，再用 initialQuery prop）
  const pendingStartQuery = useWorkflowStore((s) => s.pendingStartQuery);
  const pendingStartInput = useWorkflowStore((s) => s.pendingStartInput);
  const initialQueryFiredRef = useRef(false);

  const [formInputs, setFormInputs] = useState<Record<string, any>>({});
  const [startParamsConfirmed, setStartParamsConfirmed] = useState(false);

  useEffect(() => {
    const initial: Record<string, any> = {};
    startVariables.forEach((v) => {
      initial[v.name] = v.default_value ?? '';
    });
    
    // 方案 B：在计算初始值时，立刻将首页带来的 query 融入，这样哪怕 startVariables 加载更新，query 也绝不会被重置为空
    const q = pendingStartQuery ?? initialQuery ?? '';
    if (q) {
      initial['query'] = q;
    }
    if (pendingStartInput) {
      Object.assign(initial, pendingStartInput);
    }

    setFormInputs((prev) => {
      const merged = { ...initial, ...prev };
      if (q && !merged['query']) {
        merged['query'] = q;
      }
      return merged;
    });
  }, [startVariables, pendingStartQuery, pendingStartInput, initialQuery]);

  useEffect(() => {
    setStartParamsConfirmed(false);
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

  useEffect(() => {
    if (pendingStartInput && !initialQueryFiredRef.current && status === 'idle' && messages.length === 0) {
      initialQueryFiredRef.current = true;
      useWorkflowStore.getState().setPendingStartInput(null);
      useWorkflowStore.getState().setPendingStartQuery(null);
      if (typeof pendingStartInput.query === 'string' && pendingStartInput.query.trim()) {
        startWorkflow(JSON.stringify(pendingStartInput));
      } else {
        setFormInputs((prev) => ({ ...prev, ...pendingStartInput }));
        setStartParamsConfirmed(true);
      }
      setInputVal('');
      return;
    }

    const q = pendingStartQuery ?? initialQuery;
    if (q && !initialQueryFiredRef.current && status === 'idle' && messages.length === 0) {
      initialQueryFiredRef.current = true;
      useWorkflowStore.getState().setPendingStartQuery(null);

      const hasCustomVars = customVars.length > 0;
      if (hasCustomVars) {
        setFormInputs((prev) => ({ ...prev, query: q }));
        setStartParamsConfirmed(true);
        setInputVal('');
      } else {
        // 如果没有自定义预置参数，可以直接执行
        const payload: Record<string, any> = { ...formInputs };
        payload['query'] = q;
        startWorkflow(JSON.stringify(payload));
        setInputVal('');
      }
    }
  }, [pendingStartInput, pendingStartQuery, initialQuery, status, messages.length, customVars.length, startWorkflow]);

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

  const showInitialForm = steps.length === 0 && customVars.length > 0 && !startParamsConfirmed;
  const showEmptyState = steps.length === 0 && messages.length === 0 && status === 'idle' && !showInitialForm;

  // 新步骤时自动滚到底
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [steps.length]);

  // 从配置表单中直接启动工作流的逻辑
  const handleStartFromForm = () => {
    const missing = customVars.filter((v: any) => v.required && (formInputs[v.name] === undefined || formInputs[v.name] === ''));
    if (missing.length > 0) {
      alert(t('workflow.execution.missingParams', {
        defaultValue: `Missing required parameter(s): ${missing.map((m: any) => m.label || m.name).join(', ')}`,
        names: missing.map((m: any) => m.label || m.name).join(', ')
      }));
      return;
    }
    setStartParamsConfirmed(true);
    setInputVal('');
  };

  const handleStart = (text: string, attachmentsList?: any[]) => {
    const missing = customVars.filter((v: any) => v.required && (formInputs[v.name] === undefined || formInputs[v.name] === ''));
    if (missing.length > 0) {
      alert(t('workflow.execution.missingParams', {
        defaultValue: `Missing required parameter(s): ${missing.map((m: any) => m.label || m.name).join(', ')}`,
        names: missing.map((m: any) => m.label || m.name).join(', ')
      }));
      return;
    }
    const payload: Record<string, any> = { ...formInputs };
    payload['query'] = text;
    if (attachmentsList && attachmentsList.length > 0) {
      payload['attachments'] = attachmentsList;
    }
    startWorkflow(JSON.stringify(payload));
    setInputVal('');
  };

  const handleClear = () => {
    initialQueryFiredRef.current = false;
    setStartParamsConfirmed(false);
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
      {!isEmbedded && (
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
          showDebugWorkspace={showDebugWorkspace}
          onToggleDebugWorkspace={onToggleDebugWorkspace}
        />
      )}

      {/* Main content */}
      <Box
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--flock-bg-surface)',
          minHeight: 0,
        }}
      >
        {showInitialForm ? (
          /* 初始前置参数配置卡片 */
          <ScrollArea style={{ flex: 1 }} p="md">
            <Box
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '24px 16px',
                minHeight: '100%',
              }}
            >
              {/* 方案 B：极致高档的悬浮毛玻璃启动卡片 */}
              <Box
                style={{
                  width: '100%',
                  maxWidth: 420,
                  background: isDark ? 'rgba(28, 28, 30, 0.75)' : 'rgba(255, 255, 255, 0.85)',
                  backdropFilter: 'blur(16px)',
                  border: '1px solid var(--flock-border-subtle)',
                  boxShadow: isDark 
                    ? '0 12px 36px rgba(0, 0, 0, 0.4), 0 0 1px rgba(255, 255, 255, 0.15) inset' 
                    : '0 12px 36px rgba(0, 0, 0, 0.08)',
                  borderRadius: '20px',
                  padding: '28px 24px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 20,
                }}
              >
                {/* 头部：工作流运行徽章 */}
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <div
                    style={{
                      width: 42,
                      height: 42,
                      borderRadius: '12px',
                      background: 'var(--flock-accent-light, rgba(0, 102, 255, 0.1))',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--flock-accent, #0066ff)',
                      boxShadow: '0 0 12px var(--flock-accent-glow, rgba(0, 102, 255, 0.15))',
                    }}
                  >
                    <IconPlayerPlay size={20} style={{ transform: 'translateX(1px)' }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <Text size="sm" fw={700} style={{ color: 'var(--flock-text-bright)' }}>
                      {t('workflow.execution.inputsTitle', 'Start Parameters')}
                    </Text>
                    <Text size="xs" c="dimmed" style={{ fontSize: 10, lineHeight: 1.3, marginTop: 2 }}>
                      {t('workflow.execution.inputsDesc', 'Please configure initial parameters, then continue in the chat input.')}
                    </Text>
                  </div>
                </div>

                <Divider color="var(--flock-border-subtle)" style={{ margin: '0 -24px' }} />

                {/* 变量输入表单区域 */}
                <Stack gap="md">
                  <StartParametersForm
                    customVars={customVars}
                    formInputs={formInputs}
                    setFormInputs={setFormInputs}
                  />
                </Stack>

                {/* 启动按钮 */}
                <Button
                  color="blue"
                  fullWidth
                  size="md"
                  onClick={handleStartFromForm}
                  leftSection={<IconCheck size={16} />}
                  style={{
                    background: 'var(--flock-accent)',
                    borderRadius: '10px',
                    fontWeight: 600,
                    boxShadow: '0 4px 12px var(--flock-accent-glow, rgba(0, 102, 255, 0.2))',
                    transition: 'transform 0.2s, box-shadow 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-1px)';
                    e.currentTarget.style.boxShadow = '0 6px 16px var(--flock-accent-glow, rgba(0, 102, 255, 0.3))';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 4px 12px var(--flock-accent-glow, rgba(0, 102, 255, 0.2))';
                  }}
                >
                  {t('workflow.execution.confirmParams', 'Confirm Parameters')}
                </Button>
              </Box>
            </Box>
          </ScrollArea>
        ) : showEmptyState ? (
          /* 真正的初始闲置空状态 */
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
          /* 有执行记录时或正在启动运行中（按轮次渲染：用户气泡 + 工作流折叠组 + answer/human 卡片） */
          <ScrollArea style={{ flex: 1 }} px="md" py="md">
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
        {!showInitialForm && (() => {
          const startNode = nodes.find((n: any) => n.type === 'start');
          const fileInputEnabled = startNode?.data?.file_input_enabled as boolean ?? false;
          const imageInputEnabled = startNode?.data?.image_input_enabled as boolean ?? false;
          const maxFileCount = startNode?.data?.max_file_count as number ?? 5;
          return (
            <WorkflowChatInput
              isInterrupted={isInterrupted}
              status={status}
              inputVal={inputVal}
              setInputVal={setInputVal}
              handleStart={handleStart}
              stopWorkflow={stopWorkflow}
              fileInputEnabled={fileInputEnabled}
              imageInputEnabled={imageInputEnabled}
              maxFileCount={maxFileCount}
            />
          );
        })()}
      </Box>
    </Box>
  );
}
