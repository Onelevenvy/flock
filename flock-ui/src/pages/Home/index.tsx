import { useCallback, useMemo, useState } from 'react';
import { Box, Button, Group, SimpleGrid, Stack, Text, Title } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconCompass, IconFolder, IconMessageCircle, IconRoute, IconSparkles } from '@tabler/icons-react';
import { invoke } from '@tauri-apps/api/core';
import { useTranslation } from 'react-i18next';
import { useAssistantsQuery } from '../../hooks/useAssistants';
import { useWorkflowsQuery, type WorkflowRecord } from '../../hooks/useWorkflow';
import { useCreateConversationMutation, useWorkspacesQuery } from '../../hooks/useWorkspaces';
import { useAgentStore } from '../../store/agentStore';
import { useWorkspaceStore } from '../../store/workspaceStore';
import { useWorkflowStore } from '../../store/workflowStore';
import type { Assistant } from '../../types/assistant';
import { ActiveModelPicker } from '../../components/Common/ActiveModelPicker';
import { XIAOF_AGENT } from './AssistantPicker';
import { WorkspacePicker } from './WorkspacePicker';
import { ExplorerAppCard } from './components/ExplorerAppCard';
import { WorkflowLaunchModal } from './components/WorkflowLaunchModal';

export function HomeView() {
  const { t } = useTranslation();
  const [launchingAssistantId, setLaunchingAssistantId] = useState<string | null>(null);
  const [selectedWorkflow, setSelectedWorkflow] = useState<WorkflowRecord | null>(null);
  const [isLaunchingWorkflow, setIsLaunchingWorkflow] = useState(false);

  const { data: assistants = [] } = useAssistantsQuery();
  const { data: workflows = [] } = useWorkflowsQuery();
  const { data: workspaces = [] } = useWorkspacesQuery();
  const { mutateAsync: createConversation } = useCreateConversationMutation();

  const status = useAgentStore((s) => s.status);
  const setStatus = useAgentStore((s) => s.setStatus);
  const setWorkdir = useAgentStore((s) => s.setWorkdir);
  const clearMessages = useAgentStore((s) => s.clearMessages);
  const setError = useAgentStore((s) => s.setError);

  const {
    activeWorkspaceId,
    setActiveWorkspace,
    setActiveConversation,
    setConversationAssistant,
  } = useWorkspaceStore();

  const activeWorkspace = useMemo(
    () => workspaces.find((workspace) => workspace.id === activeWorkspaceId),
    [activeWorkspaceId, workspaces]
  );

  const allAssistants = useMemo(() => [XIAOF_AGENT, ...assistants], [assistants]);
  const featuredAssistants = allAssistants.slice(0, 6);
  const featuredWorkflows = workflows.slice(0, 6);

  const handleSelectWorkspace = useCallback(async (wsId: string, wsPath: string) => {
    if (wsId !== activeWorkspaceId) {
      setActiveWorkspace(wsId);
    }
    setWorkdir(wsPath);
    setStatus('ready');
  }, [activeWorkspaceId, setActiveWorkspace, setStatus, setWorkdir]);

  const ensureWorkspace = useCallback(() => {
    if (activeWorkspace) return true;
    notifications.show({
      title: t('home.explorer.workspaceRequiredTitle'),
      message: t('home.pleaseSelectWorkspace'),
      color: 'orange',
    });
    return false;
  }, [activeWorkspace, t]);

  const handleStartAssistant = useCallback(async (assistant: Assistant) => {
    if (!ensureWorkspace() || !activeWorkspace) return;

    setLaunchingAssistantId(assistant.id);
    setStatus('connecting');
    try {
      const conversation = await createConversation({
        workspaceId: activeWorkspace.id,
        title: assistant.name,
      });
      clearMessages();
      setActiveConversation(conversation.id);
      setConversationAssistant(conversation.id, assistant.id);
      setWorkdir(activeWorkspace.path);

      await invoke('start_agent', {
        workdir: activeWorkspace.path,
        sessionId: conversation.id,
        assistantId: assistant.id === '__xiaof__' ? null : assistant.id,
        projectDir: null,
        apiKey: null,
        extraArgs: null,
      });

      setStatus('ready');
    } catch (error: any) {
      setStatus('error');
      setError(error.message || String(error));
    } finally {
      setLaunchingAssistantId(null);
    }
  }, [
    activeWorkspace,
    clearMessages,
    createConversation,
    ensureWorkspace,
    setActiveConversation,
    setConversationAssistant,
    setError,
    setStatus,
    setWorkdir,
  ]);

  const handleOpenWorkflow = useCallback((workflow: WorkflowRecord) => {
    if (!ensureWorkspace()) return;
    setSelectedWorkflow(workflow);
  }, [ensureWorkspace]);

  const handleRunWorkflow = useCallback(async (workflow: WorkflowRecord, inputs: Record<string, any>) => {
    if (!ensureWorkspace() || !activeWorkspace) return;

    setIsLaunchingWorkflow(true);
    try {
      const conversation = await createConversation({
        workspaceId: activeWorkspace.id,
        title: workflow.name,
      });

      clearMessages();
      setActiveConversation(conversation.id);
      setConversationAssistant(conversation.id, `workflow:${workflow.id}`);
      useWorkflowStore.getState().setPendingStartInput(inputs);
      useWorkflowStore.getState().setPendingStartQuery(null);
      useWorkflowStore.getState().setActiveExecutionThreadId(conversation.id);
      setWorkdir(activeWorkspace.path);
      setStatus('ready');
      setSelectedWorkflow(null);
    } catch (error: any) {
      setStatus('error');
      setError(error.message || String(error));
    } finally {
      setIsLaunchingWorkflow(false);
    }
  }, [
    activeWorkspace,
    clearMessages,
    createConversation,
    ensureWorkspace,
    setActiveConversation,
    setConversationAssistant,
    setError,
    setStatus,
    setWorkdir,
  ]);

  return (
    <Box
      style={{
        flex: 1,
        minWidth: 0,
        overflow: 'auto',
        padding: '36px 42px',
      }}
    >
      <Stack gap={28} style={{ maxWidth: 1120, margin: '0 auto' }}>
        <Group justify="space-between" align="flex-start" gap="xl">
          <Stack gap={10} style={{ maxWidth: 680 }}>
            <Group gap="xs">
              <IconCompass size={22} color="var(--flock-accent)" />
              <Text size="xs" fw={700} tt="uppercase" c="dimmed">
                {t('home.explorer.eyebrow')}
              </Text>
            </Group>
            <Title order={1} style={{ color: 'var(--flock-text-bright)', letterSpacing: '-0.04em' }}>
              {t('home.explorer.title')}
            </Title>
            <Text size="sm" c="dimmed" style={{ lineHeight: 1.7 }}>
              {t('home.explorer.subtitle')}
            </Text>
          </Stack>

          <Stack gap="xs" align="flex-end">
            <Group gap="xs">
              <WorkspacePicker onSelect={handleSelectWorkspace} />
              <ActiveModelPicker />
            </Group>
            <Group gap={6}>
              <IconFolder size={14} color="var(--flock-text-dim)" />
              <Text size="xs" c={activeWorkspace ? 'dimmed' : 'red'}>
                {activeWorkspace
                  ? t('home.explorer.activeWorkspace', { name: activeWorkspace.name })
                  : t('home.pleaseSelectWorkspace')}
              </Text>
            </Group>
          </Stack>
        </Group>

        <Box
          style={{
            padding: 18,
            borderRadius: 22,
            border: '1px solid var(--flock-border-subtle)',
            background: 'linear-gradient(135deg, var(--flock-bg-raised), var(--flock-bg-surface))',
          }}
        >
          <Group justify="space-between" align="center">
            <Group gap="sm">
              <Box
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 14,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--flock-accent)',
                  background: 'var(--flock-accent-soft)',
                }}
              >
                <IconMessageCircle size={20} />
              </Box>
              <Stack gap={2}>
                <Text size="sm" fw={700}>{t('home.explorer.quickStartTitle')}</Text>
                <Text size="xs" c="dimmed">{t('home.explorer.quickStartDesc')}</Text>
              </Stack>
            </Group>
            <Button
              variant="light"
              color="blue"
              leftSection={<IconSparkles size={15} />}
              loading={launchingAssistantId === '__xiaof__' || status === 'connecting'}
              onClick={() => handleStartAssistant(XIAOF_AGENT)}
            >
              {t('home.explorer.chatWithXiaof')}
            </Button>
          </Group>
        </Box>

        <Stack gap="md">
          <Group justify="space-between">
            <Group gap="xs">
              <IconSparkles size={18} color="var(--flock-accent)" />
              <Text size="md" fw={800}>{t('home.explorer.assistantsTitle')}</Text>
            </Group>
            <Text size="xs" c="dimmed">{t('home.explorer.assistantsHint')}</Text>
          </Group>

          <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
            {featuredAssistants.map((assistant) => (
              <ExplorerAppCard
                key={assistant.id}
                type="assistant"
                name={assistant.name}
                description={assistant.description}
                icon={assistant.icon || '🤖'}
                disabled={launchingAssistantId === assistant.id}
                onClick={() => handleStartAssistant(assistant)}
              />
            ))}
          </SimpleGrid>
        </Stack>

        <Stack gap="md">
          <Group justify="space-between">
            <Group gap="xs">
              <IconRoute size={18} color="var(--flock-accent)" />
              <Text size="md" fw={800}>{t('home.explorer.workflowsTitle')}</Text>
            </Group>
            <Text size="xs" c="dimmed">{t('home.explorer.workflowsHint')}</Text>
          </Group>

          {featuredWorkflows.length === 0 ? (
            <Box
              style={{
                padding: 28,
                borderRadius: 18,
                border: '1px dashed var(--flock-border-dim)',
                textAlign: 'center',
                color: 'var(--flock-text-dim)',
              }}
            >
              <Text size="sm" fw={600}>{t('home.explorer.emptyWorkflowsTitle')}</Text>
              <Text size="xs" mt={6}>{t('home.explorer.emptyWorkflowsDesc')}</Text>
            </Box>
          ) : (
            <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
              {featuredWorkflows.map((workflow) => (
                <ExplorerAppCard
                  key={workflow.id}
                  type="workflow"
                  name={workflow.name}
                  description={workflow.description}
                  icon="⚡"
                  onClick={() => handleOpenWorkflow(workflow)}
                />
              ))}
            </SimpleGrid>
          )}
        </Stack>
      </Stack>

      <WorkflowLaunchModal
        workflow={selectedWorkflow}
        opened={!!selectedWorkflow}
        activeWorkspaceName={activeWorkspace?.name}
        isLaunching={isLaunchingWorkflow}
        onClose={() => setSelectedWorkflow(null)}
        onSelectWorkspace={handleSelectWorkspace}
        onRun={handleRunWorkflow}
      />
    </Box>
  );
}
