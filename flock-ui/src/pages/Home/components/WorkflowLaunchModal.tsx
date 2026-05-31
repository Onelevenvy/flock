import { useEffect, useMemo, useState } from 'react';
import { Button, Divider, Group, Modal, Stack, Text, Textarea } from '@mantine/core';
import { IconPlayerPlay, IconRoute } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import type { WorkflowRecord } from '../../../hooks/useWorkflow';
import { WorkspacePicker } from '../WorkspacePicker';
import { StartParametersForm } from '../../../components/chat/workflow/ExecutionPanel/StartParametersForm';

interface WorkflowLaunchModalProps {
  workflow: WorkflowRecord | null;
  opened: boolean;
  activeWorkspaceName?: string;
  isLaunching: boolean;
  onClose: () => void;
  onSelectWorkspace: (wsId: string, wsPath: string, wsName: string) => void;
  onRun: (workflow: WorkflowRecord, inputs: Record<string, any>) => Promise<void>;
}

function getStartVariables(workflow: WorkflowRecord | null) {
  const startNode = workflow?.config?.nodes?.find((node: any) => node.type === 'start');
  const configured = (startNode?.data?.variables as any[]) ?? [];
  const hasQuery = configured.some((item) => item.name === 'query');
  const variables = hasQuery
    ? configured
    : [{ type: 'string', name: 'query', label: 'Query', required: true }, ...configured];

  return variables.length > 0
    ? variables
    : [{ type: 'string', name: 'query', label: 'Query', required: true }];
}

export function WorkflowLaunchModal({
  workflow,
  opened,
  activeWorkspaceName,
  isLaunching,
  onClose,
  onSelectWorkspace,
  onRun,
}: WorkflowLaunchModalProps) {
  const { t } = useTranslation();
  const startVariables = useMemo(() => getStartVariables(workflow), [workflow]);
  const customVars = startVariables.filter((item: any) => item.name !== 'query');
  const [formInputs, setFormInputs] = useState<Record<string, any>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!opened) return;
    const initial: Record<string, any> = {};
    startVariables.forEach((item: any) => {
      initial[item.name] = item.default_value ?? (item.type === 'boolean' ? false : '');
    });
    setFormInputs(initial);
    setError(null);
  }, [opened, startVariables]);

  const handleRun = async () => {
    if (!workflow) return;

    const missing = startVariables.filter((item: any) => {
      if (!item.required) return false;
      const value = formInputs[item.name];
      return value === undefined || value === null || value === '';
    });

    if (missing.length > 0) {
      setError(t('home.explorer.missingInputs', {
        names: missing.map((item: any) => item.label || item.name).join(', '),
      }));
      return;
    }

    await onRun(workflow, formInputs);
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Group gap="xs">
          <IconRoute size={18} color="var(--flock-accent)" />
          <Text fw={700}>{t('home.explorer.workflowLaunchTitle')}</Text>
        </Group>
      }
      centered
      size="lg"
      styles={{
        header: { backgroundColor: 'var(--flock-bg-surface)' },
        content: { backgroundColor: 'var(--flock-bg-surface)' },
        body: { paddingTop: 4 },
      }}
    >
      <Stack gap="md">
        <Stack gap={4}>
          <Text size="sm" fw={700} style={{ color: 'var(--flock-text-bright)' }}>
            {workflow?.name}
          </Text>
          <Text size="xs" c="dimmed">
            {workflow?.description || t('home.explorer.noDescription')}
          </Text>
        </Stack>

        <Group justify="space-between" align="center">
          <Stack gap={2}>
            <Text size="xs" fw={600} c="dimmed">
              {t('home.explorer.workspace')}
            </Text>
            <Text size="xs" style={{ color: activeWorkspaceName ? 'var(--flock-text-primary)' : 'var(--mantine-color-red-6)' }}>
              {activeWorkspaceName || t('home.pleaseSelectWorkspace')}
            </Text>
          </Stack>
          <WorkspacePicker onSelect={onSelectWorkspace} />
        </Group>

        <Divider color="var(--flock-border-subtle)" />

        <Stack gap="sm">
          <Text size="xs" fw={700} c="dimmed" tt="uppercase">
            {t('home.explorer.startInputs')}
          </Text>
          <Textarea
            label={`${t('workflow.execution.inputPlaceholder', 'Initial Query')} (query)`}
            placeholder={t('workflow.execution.inputPlaceholder', 'Enter initial query...')}
            value={formInputs.query ?? ''}
            onChange={(event) => setFormInputs({ ...formInputs, query: event.currentTarget.value })}
            autosize
            minRows={3}
            maxRows={8}
            required
            styles={{
              input: {
                background: 'var(--flock-bg-raised)',
                border: '1px solid var(--flock-border-dim)',
              },
            }}
          />
          {customVars.length > 0 && (
            <StartParametersForm
              customVars={customVars}
              formInputs={formInputs}
              setFormInputs={setFormInputs}
            />
          )}
        </Stack>

        {error && (
          <Text size="xs" c="red">
            {error}
          </Text>
        )}

        <Group justify="flex-end">
          <Button variant="subtle" color="gray" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button
            leftSection={<IconPlayerPlay size={15} />}
            onClick={handleRun}
            loading={isLaunching}
            disabled={!activeWorkspaceName}
            style={{ background: 'var(--flock-accent)' }}
          >
            {t('home.explorer.runWorkflow')}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
