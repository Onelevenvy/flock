import { Card, Group, ThemeIcon, Text, Badge, Stack, Switch, Divider } from '@mantine/core';
import { IconShieldCheck } from '@tabler/icons-react';
import ToolManager from '../../Common/ToolManager';

interface ToolsConfig {
  auto_approve: boolean;
  allow_list: string[];
  disabled_allow_list?: string[];
  skills?: {
    deny: string[];
    allow: string[];
  };
}

interface ToolApprovalCardProps {
  t: any;
  toolsConfig: ToolsConfig | null;
  setToolsConfig: React.Dispatch<React.SetStateAction<ToolsConfig | null>>;
}

export function ToolApprovalCard({ t, toolsConfig, setToolsConfig }: ToolApprovalCardProps) {
  return (
    <Card
      style={{
        background: 'var(--flock-bg-raised)',
        border: '1px solid var(--flock-border-dim)',
        borderRadius: 16,
      }}
      padding="xl"
    >
      <Group justify="space-between" mb="md">
        <Group gap="xs">
          <IconShieldCheck size={22} color="var(--flock-accent)" />
          <Text fw={700} size="md">
            {t('settings.xiaof.toolApproval')}
          </Text>
        </Group>
        <Badge color="blue" variant="light">
          {t('settings.xiaof.securityPolicy')}
        </Badge>
      </Group>

      <Stack gap="lg">
        <Switch
          label={t('settings.xiaof.autoApproveLabel')}
          checked={toolsConfig?.auto_approve || false}
          onChange={(e) =>
            setToolsConfig(
              toolsConfig ? { ...toolsConfig, auto_approve: e.currentTarget.checked } : null
            )
          }
          styles={{
            label: { cursor: 'pointer' },
          }}
        />

        {!toolsConfig?.auto_approve && (
          <>
            <Divider color="var(--flock-border-subtle)" />

            <ToolManager
              value={toolsConfig?.allow_list || []}
              onChange={(values) =>
                setToolsConfig((prev) =>
                  prev ? { ...prev, allow_list: values } : null
                )
              }
              disabledValue={toolsConfig?.disabled_allow_list || []}
              onDisabledChange={(values) =>
                setToolsConfig((prev) =>
                  prev ? { ...prev, disabled_allow_list: values } : null
                )
              }
              label={t('settings.xiaof.allowListLabel')}
              selectorPosition="bottom-end"
            />
          </>
        )}
      </Stack>
    </Card>
  );
}
