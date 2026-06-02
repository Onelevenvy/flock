import React, { useState, useCallback } from 'react';
import {
  TextInput,
  ActionIcon,
  Button,
  Group,
  Divider,
  Stack,
  Text,
  Badge,
  Modal,
  Select,
  Switch,
  Card,
  Tooltip,
} from '@mantine/core';
import { ModelSelect } from '@/components/Common/ModelSelect';
import { IconTrash, IconPlus, IconFileImport, IconEdit, IconCheck } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { VariableTextInput, VariableTextarea } from '@/pages/Workflow/components/PropertiesPanel/VariableInput';
import { useAvailableTools } from '@/hooks/useAvailableTools';
import { notifications } from '@mantine/notifications';
import { ToolPickerPopover } from '@/components/Common/ToolManager/ToolPickerPopover';

export interface ParameterExtractorFieldsProps {
  node: any;
  onDataChange: (nodeId: string, key: string, value: unknown) => void;
  modelOptions: any[];
  modelsLoading: boolean;
}

interface ExtractorParameter {
  name: string;
  type: string;
  description: string;
  required: boolean;
}

export function ParameterExtractorFields({
  node,
  onDataChange,
  modelOptions,
  modelsLoading,
}: ParameterExtractorFieldsProps) {
  const { t } = useTranslation();
  const { tools, groupedOptions: toolOptions, loading: toolsLoading } = useAvailableTools();

  const parameters = (node.data.parameters as ExtractorParameter[]) ?? [];

  // 弹窗状态
  const [editModalOpen, setEditModalOpen] = useState(false);
  
  // 当前正在编辑的参数 (新增时为 null)
  const [activeParamIndex, setActiveParamIndex] = useState<number | null>(null);
  const [paramForm, setParamForm] = useState<ExtractorParameter>({
    name: '',
    type: 'string',
    description: '',
    required: false,
  });

  // 打开新增参数 Modal
  const handleOpenAdd = () => {
    setActiveParamIndex(null);
    setParamForm({
      name: '',
      type: 'string',
      description: '',
      required: false,
    });
    setEditModalOpen(true);
  };

  // 打开编辑参数 Modal
  const handleOpenEdit = (index: number) => {
    setActiveParamIndex(index);
    setParamForm({ ...parameters[index] });
    setEditModalOpen(true);
  };

  // 保存自定义参数 (新增/编辑)
  const handleSaveParam = () => {
    if (!paramForm.name.trim()) {
      notifications.show({
        title: t('workflow.properties.extractor.error', 'Validation Error'),
        message: t('workflow.properties.extractor.nameRequired', 'Parameter name is required'),
        color: 'red',
      });
      return;
    }

    const next = [...parameters];
    if (activeParamIndex !== null) {
      // 编辑
      next[activeParamIndex] = paramForm;
    } else {
      // 新建，查重
      if (parameters.some((p) => p.name === paramForm.name)) {
        notifications.show({
          title: t('workflow.properties.extractor.error', 'Validation Error'),
          message: t('workflow.properties.extractor.duplicateName', 'Parameter name already exists'),
          color: 'red',
        });
        return;
      }
      next.push(paramForm);
    }

    onDataChange(node.id, 'parameters', next);
    setEditModalOpen(false);
  };

  // 删除参数
  const handleRemoveParam = (index: number) => {
    const next = parameters.filter((_, i) => i !== index);
    onDataChange(node.id, 'parameters', next);
  };

  // 从选择的 Tool 自动导入参数解析
  const handleImportFromToolPicker = (selectedNames: string[]) => {
    if (selectedNames.length === 0) return;
    const toolName = selectedNames[0];

    const tool = tools.find((t) => t.name === toolName);
    if (!tool) return;

    try {
      const schema = JSON.parse(tool.input_schema || '{}');
      const properties = schema.properties || {};
      const requiredList = Array.isArray(schema.required) ? schema.required : [];

      const importedParams: ExtractorParameter[] = [];

      Object.entries(properties).forEach(([key, val]: [string, any]) => {
        // 映射 JSON Schema 的数据类型
        let mappedType = 'string';
        if (val.type === 'integer' || val.type === 'number') {
          mappedType = 'number';
        } else if (val.type === 'boolean') {
          mappedType = 'boolean';
        } else if (val.type === 'array') {
          mappedType = 'array';
        } else if (val.type === 'object') {
          mappedType = 'object';
        }

        importedParams.push({
          name: key,
          type: mappedType,
          description: val.description || '',
          required: requiredList.includes(key),
        });
      });

      if (importedParams.length === 0) {
        notifications.show({
          title: t('workflow.properties.extractor.import', 'Import Parameters'),
          message: t('workflow.properties.extractor.noParamsFound', 'No parameters found in the tool schema'),
          color: 'orange',
        });
        return;
      }

      // 合并旧参数与新导入参数（参数名排重）
      const existingNames = parameters.map((p) => p.name);
      const uniqueNewParams = importedParams.filter((p) => !existingNames.includes(p.name));

      if (uniqueNewParams.length === 0) {
        notifications.show({
          title: t('workflow.properties.extractor.import', 'Import Parameters'),
          message: t('workflow.properties.extractor.alreadyExists', 'All tool parameters already exist in the extractor'),
          color: 'blue',
        });
      } else {
        const next = [...parameters, ...uniqueNewParams];
        onDataChange(node.id, 'parameters', next);
        notifications.show({
          title: t('workflow.properties.extractor.importSuccess', 'Import Success'),
          message: t('workflow.properties.extractor.importedCount', 'Successfully imported {{count}} parameters', { count: uniqueNewParams.length }),
          color: 'green',
          icon: <IconCheck size={16} />,
        });
      }
    } catch (e) {
      console.error(e);
      notifications.show({
        title: t('workflow.properties.extractor.importError', 'Import Error'),
        message: t('workflow.properties.extractor.parseFailed', 'Failed to parse tool input schema'),
        color: 'red',
      });
    }
  };

  return (
    <>
      {/* 基础模型配置 */}
      <ModelSelect
        label={t('workflow.properties.llm.model')}
        placeholder={t('workflow.properties.llm.modelPlaceholder')}
        data={modelOptions}
        disabled={modelsLoading}
        value={String(node.data.model ?? '')}
        onChange={(v) => onDataChange(node.id, 'model', v)}
        searchable
        clearable
        size="xs"
      />

      {/* 提取输入文本 */}
      <VariableTextInput
        label={t('workflow.properties.extractor.input', 'INPUT VARIABLE')}
        placeholder={t('workflow.properties.extractor.inputPlaceholder', 'Choose variable to extract from')}
        value={String(node.data.input ?? '')}
        currentNodeId={node.id}
        onChange={(val) => onDataChange(node.id, 'input', val)}
        size="xs"
      />

      {/* 参数管理区头部 */}
      <Group justify="space-between" mt="md" mb="xs" align="center">
        <Text size="xs" fw={700} style={{ color: 'var(--flock-text-bright)' }}>
          {t('workflow.properties.extractor.parameters', 'EXTRACT PARAMETERS')}
        </Text>
        
        <Group gap={6}>
          {/* 从工具导入 */}
          <ToolPickerPopover
            value={[]}
            onChange={handleImportFromToolPicker}
            triggerLabel={t('workflow.properties.extractor.importFromTools', 'Import from tools')}
          />

          {/* 新增自定义参数 */}
          <ActionIcon
            size="26px"
            variant="filled"
            color="blue"
            onClick={handleOpenAdd}
          >
            <IconPlus size={14} />
          </ActionIcon>
        </Group>
      </Group>

      {/* 参数列表渲染 (卡片设计，符合 Dify 风格) */}
      <Stack gap="xs" mb="md">
        {parameters.length === 0 ? (
          <Text size="xs" c="dimmed" ta="center" py="md" style={{ border: '1px dashed var(--flock-border-dim)', borderRadius: 8 }}>
            {t('workflow.properties.extractor.noParams', 'Please add parameters or import from tools')}
          </Text>
        ) : (
          parameters.map((p, i) => (
            <Card
              key={i}
              padding="xs"
              radius="md"
              style={{
                border: '1px solid var(--flock-border-dim)',
                background: 'var(--flock-bg-surface)',
                boxShadow: '0 1px 3px rgba(0,0,0,0.01)',
              }}
            >
              <Group justify="space-between" align="center" gap="xs">
                <Group gap={6}>
                  <span style={{ color: 'var(--flock-accent)', fontWeight: 600, fontSize: 11, fontFamily: 'monospace' }}>
                    (x)
                  </span>
                  <Text size="xs" fw={700} style={{ color: 'var(--flock-text-bright)' }}>
                    {p.name}
                  </Text>
                  <Badge size="xs" color="gray" variant="outline" style={{ textTransform: 'lowercase', fontSize: 9 }}>
                    {p.type}
                  </Badge>
                  {p.required && (
                    <Badge size="xs" color="red" variant="light" style={{ fontSize: 9 }}>
                      REQUIRED
                    </Badge>
                  )}
                </Group>

                <Group gap={4}>
                  <ActionIcon
                    size="xs"
                    variant="subtle"
                    color="blue"
                    onClick={() => handleOpenEdit(i)}
                  >
                    <IconEdit size={12} />
                  </ActionIcon>
                  <ActionIcon
                    size="xs"
                    variant="subtle"
                    color="red"
                    onClick={() => handleRemoveParam(i)}
                  >
                    <IconTrash size={12} />
                  </ActionIcon>
                </Group>
              </Group>

              {p.description && (
                <Text size="xs" c="dimmed" mt={4} style={{ fontSize: 11, paddingLeft: 18 }}>
                  {p.description}
                </Text>
              )}
            </Card>
          ))
        )}
      </Stack>

      {/* 提取指令指示 */}
      <VariableTextarea
        label={t('workflow.properties.extractor.instruction', 'INSTRUCTION')}
        placeholder={t('workflow.properties.extractor.instructionPlaceholder', 'Describe the rules or context for LLM structured extraction...')}
        value={String(node.data.instruction ?? '')}
        currentNodeId={node.id}
        onChange={(val) => onDataChange(node.id, 'instruction', val)}
        minRows={3}
        size="xs"
      />

      {/* -------------------- 弹窗：自定义参数创建/编辑 -------------------- */}
      <Modal
        opened={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        title={
          activeParamIndex !== null
            ? t('workflow.properties.extractor.editParam', 'Edit Parameter')
            : t('workflow.properties.extractor.addParam', 'Add Parameter')
        }
        size="sm"
        centered
        styles={{
          header: { borderBottom: '1px solid var(--flock-border-subtle)', minHeight: 48 },
          body: { paddingTop: 16 }
        }}
      >
        <Stack gap="sm">
          <TextInput
            label={t('workflow.properties.extractor.pName', 'Parameter Name')}
            placeholder="e.g. city"
            value={paramForm.name}
            disabled={activeParamIndex !== null} // 编辑模式下不能改参数名以防止引擎错误
            onChange={(e) => setParamForm({ ...paramForm, name: e.target.value })}
            size="xs"
            required
          />

          <Select
            label={t('workflow.properties.extractor.pType', 'Type')}
            data={[
              { value: 'string', label: 'string' },
              { value: 'number', label: 'number' },
              { value: 'boolean', label: 'boolean' },
              { value: 'array', label: 'array' },
              { value: 'object', label: 'object' },
            ]}
            value={paramForm.type}
            onChange={(v) => setParamForm({ ...paramForm, type: v || 'string' })}
            size="xs"
          />

          <TextInput
            label={t('workflow.properties.extractor.pDesc', 'Description')}
            placeholder="Describe the parameter for the extraction assistant..."
            value={paramForm.description}
            onChange={(e) => setParamForm({ ...paramForm, description: e.target.value })}
            size="xs"
          />

          <Group justify="space-between" mt="xs">
            <Text size="xs" fw={500}>
              {t('workflow.properties.extractor.pRequired', 'Required')}
            </Text>
            <Switch
              checked={paramForm.required}
              onChange={(e) => setParamForm({ ...paramForm, required: e.currentTarget.checked })}
              size="sm"
            />
          </Group>

          <Group justify="flex-end" mt="md">
            <Button size="xs" variant="subtle" color="gray" onClick={() => setEditModalOpen(false)}>
              {t('workflow.common.cancel', 'Cancel')}
            </Button>
            <Button size="xs" color="blue" onClick={handleSaveParam}>
              {t('workflow.common.save', 'Save')}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}
