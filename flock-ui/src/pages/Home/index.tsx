import { useCallback, useMemo, useState } from 'react';
import { Box, Button, Group, SegmentedControl, SimpleGrid, Stack, Text, Title } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconCompass, IconFolder, IconMessageCircle, IconRoute, IconSparkles } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { useAssistantsQuery } from '@/hooks/useAssistants';
import { useWorkflowsQuery } from '@/hooks/useWorkflow';
import { useWorkspacesQuery } from '@/hooks/useWorkspaces';
import { useAgentStore } from '@/store/agentStore';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { XIAOF_AGENT } from './AssistantPicker';
import { WorkspacePicker } from './WorkspacePicker';
import { ExplorerAppCard } from './components/ExplorerAppCard';
import { useStartAgent } from '@/hooks/useStartAgent';
import { XiaofCharacter } from '@/components/Settings/PetSettings/Pet/XiaofCharacter';
import { useXiaofState } from '@/hooks/useXiaofState';

export function HomeView() {
  const { t } = useTranslation();
  const [filter, setFilter] = useState<'all' | 'assistants' | 'workflows'>('all');
  const { mood } = useXiaofState();

  const { data: assistants = [] } = useAssistantsQuery();
  const { data: workflows = [] } = useWorkflowsQuery();
  const { data: workspaces = [] } = useWorkspacesQuery();

  const status = useAgentStore((s) => s.status);
  const setStatus = useAgentStore((s) => s.setStatus);
  const setWorkdir = useAgentStore((s) => s.setWorkdir);

  const {
    activeWorkspaceId,
    setActiveWorkspace,
  } = useWorkspaceStore();

  const { startAssistant, startWorkflow, loadingId } = useStartAgent();

  const featuredAssistants = assistants.filter((a) => a.id !== '__xiaof__').slice(0, 6);
  const featuredWorkflows = workflows.filter((w) => !!w.active_version).slice(0, 6);

  const handleSelectWorkspace = useCallback(async (wsId: string, wsPath: string) => {
    if (wsId !== activeWorkspaceId) {
      setActiveWorkspace(wsId);
    }
    setWorkdir(wsPath);
    setStatus('ready');
  }, [activeWorkspaceId, setActiveWorkspace, setStatus, setWorkdir]);



  return (
    <Box
      style={{
        flex: 1,
        minWidth: 0,
        overflow: 'auto',
        padding: '36px 42px',
      }}
    >
      <Stack gap={28} style={{ width: '100%' }}>
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
            <Group gap="xs" align="center">
              <Text size="xs" fw={600} c="dimmed">{t('home.explorer.workspace')}:</Text>
              <WorkspacePicker onSelect={handleSelectWorkspace} />
            </Group>
            <SegmentedControl
              value={filter}
              onChange={(val) => setFilter(val as any)}
              data={[
                { value: 'all', label: t('home.explorer.filterAll') },
                { value: 'assistants', label: t('home.explorer.filterAssistants') },
                { value: 'workflows', label: t('home.explorer.filterWorkflows') },
              ]}
              size="xs"
              styles={{
                root: {
                  background: 'var(--flock-bg-surface)',
                  border: '1px solid var(--flock-border-dim)',
                  padding: 2,
                  borderRadius: 8,
                },
                control: {
                  minWidth: 80,
                }
              }}
            />
          </Stack>
        </Group>

        {(filter === 'all' || filter === 'assistants') && (
          <Box
            style={{
              padding: 18,
              borderRadius: 22,
              border: '1px solid var(--flock-border-subtle)',
              background: 'linear-gradient(135deg, var(--flock-bg-raised), var(--flock-bg-surface))',
            }}
          >
            <Group justify="space-between" align="center">
              <Group gap="md">
                <Box
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: 16,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'var(--flock-accent-soft)',
                    overflow: 'visible',
                  }}
                >
                  <XiaofCharacter mood={mood} size={48} />
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
                loading={loadingId === '__xiaof__' || status === 'connecting'}
                onClick={() => startAssistant(XIAOF_AGENT)}
              >
                {t('home.explorer.chatWithXiaof')}
              </Button>
            </Group>
          </Box>
        )}

        {(filter === 'all' || filter === 'assistants') && (
          <Stack gap="md">
            <Group justify="space-between">
              <Group gap="xs">
                <IconSparkles size={18} color="var(--flock-accent)" />
                <Text size="md" fw={800}>{t('home.explorer.assistantsTitle')}</Text>
              </Group>
              <Text size="xs" c="dimmed">{t('home.explorer.assistantsHint')}</Text>
            </Group>

            <SimpleGrid cols={{ base: 1, sm: 2, md: 3, lg: 4, xl: 5 }} spacing="md">
              {featuredAssistants.map((assistant) => (
                <ExplorerAppCard
                  key={assistant.id}
                  type="assistant"
                  name={assistant.name}
                  description={assistant.description}
                  icon={assistant.icon || '🤖'}
                  disabled={loadingId === assistant.id}
                  onClick={() => startAssistant(assistant)}
                />
              ))}
            </SimpleGrid>
          </Stack>
        )}

        {(filter === 'all' || filter === 'workflows') && (
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
              <SimpleGrid cols={{ base: 1, sm: 2, md: 3, lg: 4, xl: 5 }} spacing="md">
                {featuredWorkflows.map((workflow) => (
                  <ExplorerAppCard
                    key={workflow.id}
                    type="workflow"
                    name={workflow.name}
                    description={workflow.description}
                    icon="⚡"
                    disabled={loadingId === workflow.id}
                    onClick={() => startWorkflow(workflow)}
                  />
                ))}
              </SimpleGrid>
            )}
          </Stack>
        )}
      </Stack>
    </Box>
  );
}
