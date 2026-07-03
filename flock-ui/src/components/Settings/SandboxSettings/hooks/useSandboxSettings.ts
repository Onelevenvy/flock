import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { notifications } from '@mantine/notifications';
import { useTranslation } from 'react-i18next';
import { IconCheck, IconAlertCircle, IconPlugConnectedX } from '@tabler/icons-react';
import React from 'react';

interface SandboxConfig {
  enabled: boolean;
  provider: string | null;
  api_url: string | null;
  api_key: string | null;
  e2b_api_key: string | null;
  e2b_api_url: string | null;
  snapshot: string | null;
}

interface ToolProvider {
  id: string;
  is_available: boolean;
}

export function useSandboxSettings() {
  const { t } = useTranslation();
  const [provider, setProvider] = useState<'e2b' | 'daytona' | 'local'>('e2b');
  const [apiUrl, setApiUrl] = useState('https://app.daytona.io');
  const [apiKey, setApiKey] = useState('');
  const [e2bApiKey, setE2bApiKey] = useState('');
  const [e2bApiUrl, setE2bApiUrl] = useState('https://api.e2b.app');
  const [snapshot, setSnapshot] = useState('');
  const [testing, setTesting] = useState(false);
  const [disabling, setDisabling] = useState(false);
  const [creatingSnapshot, setCreatingSnapshot] = useState(false);
  const [isAvailable, setIsAvailable] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('config');
  const [snapshotsList, setSnapshotsList] = useState<{ id: string; name: string }[]>([]);
  const [buildingE2b, setBuildingE2b] = useState(false);
  const [e2bBuildLogs, setE2bBuildLogs] = useState<string[]>([]);

  const fetchSnapshotsList = async () => {
    try {
      const data = await invoke<any>('list_sandbox_templates', {
        provider,
        apiKey: provider === 'e2b' ? e2bApiKey : apiKey,
      });
      let list: any[] = [];
      if (Array.isArray(data)) {
        list = data;
      } else if (data && Array.isArray(data.items)) {
        list = data.items;
      } else if (data && Array.isArray(data.data)) {
        list = data.data;
      }
      setSnapshotsList(list.map((item: any) => ({ id: item.id || item.name, name: item.name || item.id })));
    } catch (e) {
      console.error('Failed to fetch snapshots:', e);
      setSnapshotsList([]);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const handleProviderChange = (newProvider: 'e2b' | 'daytona' | 'local') => {
    if (newProvider !== provider) {
      // 切换 provider 时清空 snapshot，避免将上一个 provider 的 snapshot ID 错误地
      // 传给新 provider（如把 Daytona workspace UUID 当 E2B template ID 使用）
      setSnapshot('');
      // 同时在后台销毁旧沙盒，清除内存中的 ACTIVE_SANDBOX_ID
      invoke('destroy_sandbox').catch(() => {});
    }
    setProvider(newProvider);
  };

  useEffect(() => {
    fetchSnapshotsList();
  }, [provider, e2bApiKey]);

  const loadAll = async () => {
    try {
      const [config, providers] = await Promise.all([
        invoke<SandboxConfig | null>('get_app_config', { key: 'sandbox' }),
        invoke<ToolProvider[]>('list_tool_providers'),
      ]);
      if (config) {
        if (config.provider) setProvider(config.provider as any);
        if (config.api_url) setApiUrl(config.api_url);
        if (config.api_key) setApiKey(config.api_key);
        if (config.e2b_api_key) setE2bApiKey(config.e2b_api_key);
        if (config.e2b_api_url) setE2bApiUrl(config.e2b_api_url);
        if (config.snapshot) setSnapshot(config.snapshot);
      }
      const sandboxProvider = providers.find((p) => p.id === 'sandbox');
      setIsAvailable(sandboxProvider?.is_available ?? false);
    } catch (e) {
      console.error('Failed to load sandbox config:', e);
    }
  };

  const saveConfig = async (overrides?: Partial<SandboxConfig>) => {
    await invoke('set_app_config', {
      key: 'sandbox',
      value: {
        enabled: isAvailable,
        provider,
        api_url: apiUrl.trim(),
        api_key: apiKey.trim(),
        e2b_api_key: e2bApiKey.trim(),
        e2b_api_url: e2bApiUrl.trim(),
        snapshot: snapshot.trim() || null,
        ...overrides,
      },
    });
  };

  const handleTestConnection = async () => {
    if (provider === 'e2b' && (!e2bApiKey.trim() || !e2bApiUrl.trim())) {
      notifications.show({
        title: t('common.failed'),
        message: t('settings.sandbox.testMissingFields'),
        color: 'yellow',
      });
      return;
    }
    if (provider === 'daytona' && (!apiUrl.trim() || !apiKey.trim())) {
      notifications.show({
        title: t('common.failed'),
        message: t('settings.sandbox.testMissingFields'),
        color: 'yellow',
      });
      return;
    }

    setTesting(true);
    try {
      await saveConfig({ enabled: true });
      await invoke<string>('test_sandbox_connection', {
        provider,
        apiUrl: provider === 'e2b' ? e2bApiUrl.trim() : apiUrl.trim(),
        apiKey: provider === 'e2b' ? e2bApiKey.trim() : (provider === 'daytona' ? apiKey.trim() : ''),
      });
      setIsAvailable(true);
      notifications.show({
        title: t('settings.sandbox.testOkAutoEnabled'),
        message: t('settings.sandbox.testOkMsg'),
        color: 'teal',
        icon: React.createElement(IconCheck, { size: 18 }),
      });
    } catch (e) {
      setIsAvailable(false);
      await saveConfig({ enabled: false }).catch(() => {});
      notifications.show({
        title: t('settings.sandbox.testFailed'),
        message: t('settings.sandbox.testFailedMsg', { error: String(e) }),
        color: 'red',
        icon: React.createElement(IconAlertCircle, { size: 18 }),
      });
    } finally {
      setTesting(false);
    }
  };

  const handleDisable = async () => {
    setDisabling(true);
    try {
      await saveConfig({ enabled: false });
      setIsAvailable(false);
      setActiveTab('config');
      notifications.show({
        title: t('settings.sandbox.disableSuccess'),
        message: t('settings.sandbox.disableSuccessMsg'),
        color: 'orange',
        icon: React.createElement(IconPlugConnectedX, { size: 18 }),
      });
    } catch (e) {
      notifications.show({
        title: t('settings.sandbox.saveFailed'),
        message: String(e),
        color: 'red',
        icon: React.createElement(IconAlertCircle, { size: 18 }),
      });
    } finally {
      setDisabling(false);
    }
  };

  const handleCreateSnapshot = async (snapName: string) => {
    setCreatingSnapshot(true);
    try {
      await saveConfig();
    } catch {
      /* ignore */
    }

    try {
      if (provider === 'e2b' || provider === 'local') {
        setSnapshot(snapName);
        await saveConfig({ snapshot: snapName });
        notifications.show({
          title: t('common.success'),
          message: t('settings.sandbox.saveDefaultSuccess'),
          color: 'teal',
          icon: React.createElement(IconCheck, { size: 18 }),
        });
      } else {
        await invoke<string>('create_playwright_snapshot', { snapshotName: snapName });
        setSnapshot(snapName);
        await saveConfig({ snapshot: snapName });
        notifications.show({
          title: t('settings.sandbox.snapshotDone'),
          message: t('settings.sandbox.snapshotDoneMsg', { name: snapName }),
          color: 'teal',
          icon: React.createElement(IconCheck, { size: 18 }),
          autoClose: 8000,
        });
      }
    } catch (e) {
      notifications.show({
        title: t('settings.sandbox.snapshotFailed'),
        message: String(e),
        color: 'red',
        icon: React.createElement(IconAlertCircle, { size: 18 }),
        autoClose: 10000,
      });
    } finally {
      setCreatingSnapshot(false);
    }
  };

  const handleSetDefaultSnapshot = async (name: string) => {
    setSnapshot(name);
    try {
      await saveConfig({ snapshot: name });
      notifications.show({
        title: t('common.success'),
        message: t('settings.sandbox.saveDefaultSuccess'),
        color: 'teal',
        icon: React.createElement(IconCheck, { size: 18 }),
      });
    } catch (e) {
      notifications.show({
        title: t('common.failed'),
        message: String(e),
        color: 'red',
      });
    }
  };

  const handleBuildE2bTemplate = async (name: string) => {
    setBuildingE2b(true);
    setE2bBuildLogs([]);
    let unlisten: (() => void) | undefined;
    try {
      await saveConfig(); // Save current API key
      
      unlisten = await listen<string>('e2b-build-log', (event) => {
        setE2bBuildLogs((prev) => [...prev, event.payload]);
      });

      const templateId = await invoke<string>('build_e2b_template', { name });
      
      notifications.show({
        title: t('common.success'),
        message: `E2B template ${templateId} built successfully!`,
        color: 'teal',
        icon: React.createElement(IconCheck, { size: 18 }),
      });

      setSnapshot(templateId);
      await saveConfig({ snapshot: templateId });
      fetchSnapshotsList();
    } catch (e) {
      notifications.show({
        title: t('common.failed'),
        message: String(e),
        color: 'red',
        icon: React.createElement(IconAlertCircle, { size: 18 }),
        autoClose: 10000,
      });
    } finally {
      if (unlisten) unlisten();
      setBuildingE2b(false);
    }
  };

  return {
    provider, setProvider: handleProviderChange,
    apiUrl, setApiUrl,
    apiKey, setApiKey,
    e2bApiKey, setE2bApiKey,
    e2bApiUrl, setE2bApiUrl,
    snapshot,
    testing,
    disabling,
    creatingSnapshot,
    isAvailable,
    activeTab, setActiveTab,
    snapshotsList,
    buildingE2b,
    e2bBuildLogs,
    handleTestConnection,
    handleDisable,
    handleCreateSnapshot,
    handleSetDefaultSnapshot,
    handleBuildE2bTemplate,
  };
}
