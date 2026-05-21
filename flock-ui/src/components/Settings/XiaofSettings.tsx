import { useState, useEffect, useRef } from 'react';
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
import ToolManager from '../Common/ToolManager';

interface ToolsConfig {
  auto_approve: boolean;
  allow_list: string[];
  /** 白名单中暂时关闭的工具（界面显示但不参与自动审批） */
  disabled_allow_list?: string[];
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

export default function XiaofSettings() {
  const { t } = useTranslation();
  const [toolsConfig, setToolsConfig] = useState<ToolsConfig | null>(null);
  const [compactConfig, setCompactConfig] = useState<CompactConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // 自动保存 debounce 引用（工具配置和压缩配置各自独立）
  const toolsSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const compactSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 用于跟踪是否是初次加载（避免初次加载就触发保存）
  const isInitialLoad = useRef(true);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const [tools, compact] = await Promise.all([
        invoke<ToolsConfig | null>('get_app_config', { key: 'tools' }),
        invoke<CompactConfig | null>('get_app_config', { key: 'compact' }),
      ]);

      if (tools) setToolsConfig({ disabled_allow_list: [], ...tools });
      if (compact) setCompactConfig(compact);
      // 工具列表由 ToolList 内部的 useAvailableTools 自己加载
    } catch (e) {
      console.error('加载 XIAOF 配置失败:', e);
      notifications.show({
        title: t('settings.xiaof.loadFailed'),
        message: t('settings.xiaof.loadFailedMsg'),
        color: 'red',
      });
    } finally {
      setLoading(false);
      // 标记初始化完成，之后的 state 变更可以触发自动保存
      setTimeout(() => { isInitialLoad.current = false; }, 100);
    }
  };

  // ─── 自动保存：toolsConfig 变更 ────────────────────────────────
  useEffect(() => {
    if (isInitialLoad.current || !toolsConfig) return;

    if (toolsSaveTimerRef.current) clearTimeout(toolsSaveTimerRef.current);
    toolsSaveTimerRef.current = setTimeout(async () => {
      try {
        await invoke('set_app_config', { key: 'tools', value: toolsConfig });
        // notifications.show({
        //   id: 'xiaof-autosave-tools',
        //   title: t('common.success'),
        //   message: t('settings.xiaof.autoSaveSuccess', { defaultValue: '工具配置已自动保存' }),
        //   color: 'teal',
        //   icon: <IconCheck size={16} />,
        //   autoClose: 2000,
        // });
      } catch (e) {
        console.error('自动保存工具配置失败:', e);
      }
    }, 600);

    return () => {
      if (toolsSaveTimerRef.current) clearTimeout(toolsSaveTimerRef.current);
    };
  }, [toolsConfig]);

  // ─── 自动保存：compactConfig 变更 ─────────────────────────────
  useEffect(() => {
    if (isInitialLoad.current || !compactConfig) return;

    if (compactSaveTimerRef.current) clearTimeout(compactSaveTimerRef.current);
    compactSaveTimerRef.current = setTimeout(async () => {
      try {
        await invoke('set_app_config', { key: 'compact', value: compactConfig });
        notifications.show({
          id: 'xiaof-autosave-compact',
          title: t('common.success'),
          message: t('settings.xiaof.autoSaveCompactSuccess', { defaultValue: '压缩配置已自动保存' }),
          color: 'teal',
          icon: <IconCheck size={16} />,
          autoClose: 2000,
        });
      } catch (e) {
        console.error('自动保存压缩配置失败:', e);
      }
    }, 600);

    return () => {
      if (compactSaveTimerRef.current) clearTimeout(compactSaveTimerRef.current);
    };
  }, [compactConfig]);

  // 手动保存（保留按钮，作为可靠保障）
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

      {/* 底部操作栏 */}
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
