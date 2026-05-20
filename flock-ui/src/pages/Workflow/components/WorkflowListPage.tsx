import { useState } from 'react';
import {
  Box,
  Text,
  Group,
  Button,
  SimpleGrid,
  ThemeIcon,
  ScrollArea,
  Divider,
  LoadingOverlay,
} from '@mantine/core';
import { IconPlus, IconRoute } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { useWorkflowsQuery } from '../../../hooks/useWorkflow';
import { WorkflowCard } from './WorkflowCard';
import { CreateWorkflowModal } from './CreateWorkflowModal';

interface WorkflowListPageProps {
  onOpenEditor: (id: string) => void;
}

export function WorkflowListPage({ onOpenEditor }: WorkflowListPageProps) {
  const { t } = useTranslation();
  const { data: workflows = [], isLoading } = useWorkflowsQuery();
  const [createOpened, setCreateOpened] = useState(false);

  return (
    <Box
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        minWidth: 0,
        background: 'var(--flock-bg-base)',
        borderRadius: 16,
        border: '1px solid var(--flock-border-subtle)',
        position: 'relative',
      }}
    >
      <LoadingOverlay visible={isLoading} />

      {/* Header */}
      <Group gap="sm" px="xl" pt="md" pb="sm" justify="space-between" style={{ flexShrink: 0 }}>
        <Group gap="sm">
          <ThemeIcon
            size={36}
            radius="md"
            style={{ background: 'var(--flock-accent)', boxShadow: '0 2px 8px rgba(21,90,239,0.2)' }}
          >
            <IconRoute size={20} />
          </ThemeIcon>
          <Box>
            <Text fw={700} size="lg" style={{ color: 'var(--flock-text-bright)' }}>
              {t('workflow.title')}
            </Text>
            <Text size="xs" c="dimmed">
              {t('workflow.subtitle')}
            </Text>
          </Box>
        </Group>
        <Button
          leftSection={<IconPlus size={15} />}
          color="blue"
          size="sm"
          onClick={() => setCreateOpened(true)}
          style={{
            background: 'var(--flock-accent)',
            boxShadow: '0 2px 8px rgba(21,90,239,0.2)',
          }}
        >
          {t('workflow.createBtn')}
        </Button>
      </Group>

      <Divider color="var(--flock-border-subtle)" />

      <ScrollArea style={{ flex: 1 }} px="xl" py="md">
        {workflows.length === 0 ? (
          <Box
            py={80}
            style={{
              textAlign: 'center',
              border: '2px dashed var(--flock-border-dim)',
              borderRadius: 16,
              marginTop: 24,
            }}
          >
            <ThemeIcon size={56} radius="xl" variant="light" color="blue" mx="auto" mb="md">
              <IconRoute size={28} />
            </ThemeIcon>
            <Text size="sm" c="dimmed" mb={4}>
              {t('workflow.emptyTitle')}
            </Text>
            <Text size="xs" c="dimmed" mb="lg">
              {t('workflow.emptyDesc')}
            </Text>
            <Button
              leftSection={<IconPlus size={15} />}
              variant="light"
              color="blue"
              size="sm"
              onClick={() => setCreateOpened(true)}
            >
              {t('workflow.createBtn')}
            </Button>
          </Box>
        ) : (
          <SimpleGrid cols={{ base: 1, sm: 2, md: 3, lg: 4 }} spacing="md">
            {workflows.map((wf) => (
              <WorkflowCard
                key={wf.id}
                workflow={wf}
                onOpen={() => onOpenEditor(wf.id)}
              />
            ))}
          </SimpleGrid>
        )}
      </ScrollArea>

      <CreateWorkflowModal
        opened={createOpened}
        onClose={() => setCreateOpened(false)}
        onCreated={onOpenEditor}
      />
    </Box>
  );
}
