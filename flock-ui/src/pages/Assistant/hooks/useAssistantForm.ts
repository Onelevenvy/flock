import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { notifications } from '@mantine/notifications';
import { useTranslation } from 'react-i18next';
import { type Assistant, type UpsertAssistant } from '@/types/assistant';
import { parseMultiLang } from '@/utils/i18n';

interface ModelProvider {
  id: string;
  provider_name: any;
}

interface Model {
  id: string;
  provider_id: string;
  model_name: string;
  categories: string[];
  is_online: boolean;
}

import { useAvailableModels } from '@/hooks/useAvailableModels';
import { useSkillsQuery } from '@/hooks/useToolQueries';

interface SkillInfo {
  name: string;
  display_name?: string;
}

export function useAssistantForm(
  initial: Assistant | null,
  opened: boolean,
  onSave: (data: Omit<UpsertAssistant, 'is_builtin' | 'sort_order'>) => Promise<void>,
  onClose: () => void,
) {
  const { t } = useTranslation();
  const { providers, models, loading: loadingModels, reload: reloadModels } = useAvailableModels();
  const { data: skills = [], isLoading: loadingSkills } = useSkillsQuery();

  const [name, setName] = useState('');
  const [icon, setIcon] = useState('🤖');
  const [description, setDescription] = useState('');
  const [model, setModel] = useState<string | null>(null);
  const [systemPrompt, setSystemPrompt] = useState('');
  const [selectedTools, setSelectedTools] = useState<string[]>([]);
  const [disabledTools, setDisabledTools] = useState<string[]>([]);
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<string | null>('edit');
  const [modelSelectData, setModelSelectData] = useState<{ group: string; items: { value: string; label: string }[] }[]>([]);
  const [skillSelectData, setSkillSelectData] = useState<{ value: string; label: string }[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(false);

  const isEditing = !!initial;
  const isBuiltin = initial?.is_builtin ?? false;

  useEffect(() => {
    if (!opened) return;
    setActiveTab('edit');
    if (initial) {
      setName(initial.name);
      setIcon(initial.icon);
      setDescription(initial.description);
      setModel(initial.model || null);
      setSystemPrompt(initial.system_prompt);
      setSelectedTools(initial.tools);
      setDisabledTools(initial.disabled_tools || []);
      setSelectedSkills(initial.skills);
    } else {
      setName('');
      setIcon('🤖');
      setDescription('');
      setModel(null);
      setSystemPrompt('');
      setSelectedTools([]);
      setDisabledTools([]);
      setSelectedSkills([]);
    }
  }, [opened, initial]);

  const loadOptions = useCallback(async () => {
    setLoadingOptions(true);
    try {
      // Group models from cached hook
      const grouped: Record<string, { value: string; label: string }[]> = {};
      models.forEach((m) => {
        const p = providers.find((prov) => prov.id === m.provider_id);
        const groupName = p ? parseMultiLang(p.provider_name) : m.provider_id;
        if (!grouped[groupName]) {
          grouped[groupName] = [];
        }
        grouped[groupName].push({
          value: `${m.provider_id}:${m.model_name}`,
          label: m.model_name,
        });
      });

      setModelSelectData(Object.entries(grouped).map(([group, items]) => ({ group, items })));
      setSkillSelectData(
        skills.map((s) => ({
          value: s.name,
          label: parseMultiLang(s.display_name) || s.name,
        })),
      );
    } catch (e) {
      console.error('Failed to load options:', e);
    } finally {
      setLoadingOptions(false);
    }
  }, [providers, models, skills]);

  useEffect(() => {
    if (opened) {
      loadOptions();
    }
  }, [opened, loadOptions]);

  const handleSave = async () => {
    if (!name.trim()) {
      notifications.show({
        title: t('assistant.form.nameRequired'),
        message: '',
        color: 'orange',
        autoClose: 3000,
      });
      return;
    }
    if (!model) {
      notifications.show({
        title: t('assistant.form.modelRequired'),
        message: '',
        color: 'orange',
        autoClose: 3000,
      });
      return;
    }
    setSaving(true);
    try {
      await onSave({
        name: name.trim(),
        icon,
        description: description.trim(),
        model: model || '',
        system_prompt: systemPrompt.trim(),
        tools: selectedTools,
        disabled_tools: disabledTools,
        skills: selectedSkills,
      });
      onClose();
    } catch {
      /* ignore */
    } finally {
      setSaving(false);
    }
  };

  return {
    name, setName,
    icon, setIcon,
    description, setDescription,
    model, setModel,
    systemPrompt, setSystemPrompt,
    selectedTools, setSelectedTools,
    disabledTools, setDisabledTools,
    selectedSkills, setSelectedSkills,
    saving,
    activeTab, setActiveTab,
    modelSelectData,
    skillSelectData,
    loadingOptions,
    isEditing,
    isBuiltin,
    handleSave,
  };
}
