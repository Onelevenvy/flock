import { Divider, Stack } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { LLMFields } from '@/pages/Workflow/components/PropertiesPanel/LLM';
import ToolManager from '@/components/Common/ToolManager';
import { SkillsSelector } from './SkillsSelector';

export interface AgentFieldsProps {
  node: any;
  onDataChange: (nodeId: string, key: string, value: unknown) => void;
  modelOptions: any[];
  modelsLoading: boolean;
  toolOptions: any[];
  toolsLoading: boolean;
}

export function AgentFields({
  node,
  onDataChange,
  modelOptions,
  modelsLoading,
  toolOptions,
  toolsLoading,
}: AgentFieldsProps) {
  const { t } = useTranslation();
  const tools = (node.data.tools as string[]) ?? [];
  const disabledTools = (node.data.disabled_tools as string[]) ?? [];
  const sensitiveTools = (node.data.sensitive_tools as string[]) ?? [];
  const selectedSkills = (node.data.skills as string[]) ?? [];

  return (
    <Stack gap="md">
      <LLMFields
        node={node}
        onDataChange={onDataChange}
        modelOptions={modelOptions}
        modelsLoading={modelsLoading}
      />
      <Divider label={t('workflow.properties.agent.tools')} labelPosition="center" />
      <ToolManager
        value={tools}
        onChange={(v) => onDataChange(node.id, 'tools', v)}
        disabledValue={disabledTools}
        onDisabledChange={(v) => onDataChange(node.id, 'disabled_tools', v)}
        sensitiveValue={sensitiveTools}
        onSensitiveChange={(v) => onDataChange(node.id, 'sensitive_tools', v)}
        disabled={toolsLoading}
        selectorPosition="bottom-end"
      />

      <Divider label={t('assistant.form.skillsLabel', '技能')} labelPosition="center" />
      <SkillsSelector
        value={selectedSkills}
        onChange={(v) => onDataChange(node.id, 'skills', v)}
      />
    </Stack>
  );
}
