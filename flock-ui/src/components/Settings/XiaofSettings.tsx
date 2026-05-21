import { useState, useEffect } from 'react';
import {
  Stack,
  Text,
  Switch,
  NumberInput,
  Button,
  Group,
  Card,
  Divider,
  Loader,
  Badge,
  SegmentedControl,
} from '@mantine/core';
import { invoke } from '@tauri-apps/api/core';
import { notifications } from '@mantine/notifications';
import { IconCheck, IconSettings, IconShieldCheck, IconCpu } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import ToolList from '../Common/ToolList';

interface ToolsConfig {
  auto_approve: boolean;
  allow_list: string[];
  skills?: {
    deny: string[];
    allow: string[];
  };
}

interface CompactConfig {
  context_window: number;
  output_reserve?: number;
  autocompact_buffer?: number;
  emergency_buffer?: number;
  max_failures?: number;
  micro_keep_recent?: number;
  micro_gap_seconds?: number;
  compactable_tools?: string[];
  enabled: boolean;
  cache_diagnostics?: boolean;
  compaction: 'safe' | 'full' | 'off' | string;
  toon: boolean;
}

interface Tool {
  id: string;
  name: string;
  description: string;
  category: string;
  provider_id?: string;
}

export default function XiaofSettings() {
  const { t } = useTranslation();
  const [toolsConfig, setToolsConfig] = useState<ToolsConfig | null>(null);
  const [compactConfig, setCompactConfig] = useState<CompactConfig | null>(null);
  const [allTools, setAllTools] = useState<Tool[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const [tools, compact, toolsList] = await Promise.all([
        invoke<ToolsConfig | null>('get_app_config', { key: 'tools' }),
        invoke<CompactConfig | null>('get_app_config', { key: 'compact' }),
        invoke<Tool[]>('list_tools'),
      ]);

      if (tools) setToolsConfig(tools);
      if (compact) setCompactConfig(compact);
      if (toolsList) {
        const builtinTools = toolsList.filter((t) => t.provider_id === 'builtin');
        setAllTools(builtinTools);
      }
    } catch (e) {
      console.error('加载 XIAOF 配置失败:', e);
      notifications.show({
        title: t('settings.xiaof.loadFailed'),
        message: t('settings.xiaof.loadFailedMsg'),
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!toolsConfig || !compactConfig) return;
    setSaving(true);
    try {
      await Promise.all([
        invoke('set_app_config', { key: 'tools', value: toolsConfig }),
        invoke('set_app_config', { key: 'compact', value: compactConfig }),
      ]);

      notifications.show({
        title: t('common.success'),
        message: t('settings.xiaof.saveSuccess'),
        color: 'teal',
        icon: <IconCheck size={18} />,
      });
    } catch (e) {
      console.error('保存 XIAOF 配置失败:', e);
      notifications.show({
        title: t('common.failed'),
        message: t('systemSettings.saveConfigFailed'),
        color: 'red',
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Group justify="center" p={50}>
        <Loader size="md" color="blue" />
        <Text size="sm" c="dimmed">
          {t('settings.xiaof.loading')}
        </Text>
      </Group>
    );
  }

  return (
    <Stack gap="xl">
      {/* 自动审批配置 */}
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

              <Stack gap="xs">
                <ToolList
                  value={toolsConfig?.allow_list || []}
                  onChange={(values) =>
                    setToolsConfig(
                      toolsConfig ? { ...toolsConfig, allow_list: values } : null
                    )
                  }
                  label={t('settings.xiaof.allowListLabel')}
                  selectorPosition="bottom-end"
                />
              </Stack>
            </>
          )}
        </Stack>
      </Card>

      {/* 上下文压缩与优化 */}
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
            <IconCpu size={22} color="var(--flock-accent)" />
            <Text fw={700} size="md">
              {t('settings.xiaof.contextCompaction')}
            </Text>
          </Group>
          <Badge color="blue" variant="light">
            {t('settings.xiaof.performanceOptimization')}
          </Badge>
        </Group>

        <Stack gap="lg">
          <Switch
            label={t('settings.xiaof.autoCompactLabel')}
            checked={compactConfig?.enabled || false}
            onChange={(e) =>
              setCompactConfig(
                compactConfig ? { ...compactConfig, enabled: e.currentTarget.checked } : null
              )
            }
            styles={{
              label: { cursor: 'pointer' },
            }}
          />

          {compactConfig?.enabled && (
            <>
              <Divider color="var(--flock-border-subtle)" />

              <Group grow>
                <NumberInput
                  label={t('settings.xiaof.contextWindowLabel')}
                  min={1000}
                  max={1000000}
                  step={10000}
                  value={compactConfig?.context_window || 200000}
                  onChange={(val) =>
                    setCompactConfig(
                      compactConfig
                        ? { ...compactConfig, context_window: typeof val === 'number' ? val : Number(val) }
                        : null
                    )
                  }
                  styles={{
                    input: { background: 'var(--flock-bg-surface)' },
                  }}
                />

                <Stack gap={4}>
                  <Text size="sm" fw={500}>
                    {t('settings.xiaof.compactionModeLabel')}
                  </Text>
                  <SegmentedControl
                    data={[
                      { label: t('settings.xiaof.compactionModeSafe'), value: 'safe' },
                      { label: t('settings.xiaof.compactionModeFull'), value: 'full' },
                    ]}
                    value={compactConfig?.compaction === 'full' ? 'full' : 'safe'}
                    onChange={(val) =>
                      setCompactConfig(
                        compactConfig ? { ...compactConfig, compaction: val } : null
                      )
                    }
                    styles={{
                      root: { background: 'var(--flock-bg-surface)' },
                    }}
                  />
                </Stack>
              </Group>

              {compactConfig?.compaction === 'full' && (
                <>
                  <Divider color="var(--flock-border-subtle)" />

                  <Switch
                    label={t('settings.xiaof.toonLabel')}
                    checked={compactConfig?.toon || false}
                    onChange={(e) =>
                      setCompactConfig(
                        compactConfig ? { ...compactConfig, toon: e.currentTarget.checked } : null
                      )
                    }
                    styles={{
                      label: { cursor: 'pointer' },
                    }}
                  />
                </>
              )}
            </>
          )}
        </Stack>
      </Card>

      {/* 底部保存条 */}
      <Group justify="flex-end" gap="md">
        <Button variant="subtle" color="gray" onClick={loadSettings} disabled={saving}>
          {t('common.reset')}
        </Button>
        <Button
          variant="filled"
          color="blue"
          leftSection={<IconSettings size={16} />}
          onClick={handleSave}
          loading={saving}
          styles={{
            root: {
              boxShadow: '0 4px 12px rgba(21, 90, 239, 0.25)',
            },
          }}
        >
          {t('settings.xiaof.saveButton')}
        </Button>
      </Group>
    </Stack>
  );
}
