import React, { useState } from 'react';
import {
  ActionIcon,
  Group,
  Stack,
  Text,
  Badge,
  Card,
  Tooltip,
} from '@mantine/core';
import { ModelSelect } from '@/components/Common/ModelSelect';
import {
  IconTrash,
  IconPlus,
  IconEdit,
  IconCheck,
  IconBraces,
  IconCopy,
  IconMaximize,
} from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { VariableTextInput, VariableTextarea } from '@/pages/Workflow/PropertiesPanel/VariableInput';
import { useAvailableTools } from '@/hooks/useAvailableTools';
import { notifications } from '@mantine/notifications';
import { ToolPickerPopover } from '@/components/Common/ToolManager/ToolPickerPopover';
import { ParameterModal, type ExtractorParameter } from './ParameterModal';

export interface ParameterExtractorNodePropertiesProps {
  node: any;
  onDataChange: (nodeId: string, key: string, value: unknown) => void;
  modelOptions: any[];
  modelsLoading: boolean;
}

export function ParameterExtractorNodeProperties({
  node,
  onDataChange,
  modelOptions,
  modelsLoading,
}: ParameterExtractorNodePropertiesProps) {
  const { t } = useTranslation();
  const { tools } = useAvailableTools();

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

  // 复制 Instruction 文本到剪切板
  const handleCopyInstruction = () => {
    navigator.clipboard.writeText(node.data.instruction || '');
    notifications.show({
      title: t('workflow.properties.extractor.copied', 'Copied'),
      message: t('workflow.properties.extractor.copySuccess', 'Instruction copied to clipboard'),
      color: 'teal',
      icon: <IconCheck size={16} />,
    });
  };

  const instructionLength = (node.data.instruction || '').length;

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
          {/* 从工具一键导入 */}
          <ToolPickerPopover
            value={[]}
            onChange={handleImportFromToolPicker}
            triggerLabel={t('workflow.properties.extractor.importFromTools', 'Import from tools')}
          />

          {/* 新增自定义参数 */}
          <ActionIcon
            size="26px"
            radius="md"
            variant="filled"
            color="red"
            onClick={handleOpenAdd}
            styles={{
              root: {
                background: '#e02424',
                '&:hover': {
                  background: '#c81e1e',
                }
              }
            }}
          >
            <IconPlus size={13} />
          </ActionIcon>
        </Group>
      </Group>

      {/* 参数列表渲染 (像素级还原 Dify 极简奢华卡片) */}
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
                border: '1px solid var(--flock-border-subtle)',
                background: 'var(--flock-bg-surface)',
                boxShadow: 'none',
              }}
            >
              <Group justify="space-between" align="center" gap="xs">
                {/* 扁平淡蓝色 (x) name String 标签组 */}
                <Group gap={6}>
                  <Text size="xs" fw={600} style={{ color: 'var(--flock-accent)', fontFamily: 'var(--mantine-font-family-monospace)' }}>
                    (x)
                  </Text>
                  <Text size="xs" fw={700} style={{ color: 'var(--flock-text-bright)' }}>
                    {p.name}
                  </Text>
                  <Text size="10px" c="dimmed" style={{ textTransform: 'capitalize', fontSize: 10 }}>
                    {p.type}
                  </Text>
                  {p.required ? (
                    <Badge size="xs" color="red" variant="light" style={{ fontSize: 8, height: 16, borderRadius: 4, fontWeight: 700 }}>
                      REQUIRED
                    </Badge>
                  ) : (
                    <Badge size="xs" color="gray" variant="outline" style={{ fontSize: 8, height: 16, borderRadius: 4, fontWeight: 500 }}>
                      OPTIONAL
                    </Badge>
                  )}
                </Group>

                <Group gap={4}>
                  <ActionIcon
                    size="xs"
                    variant="subtle"
                    color="gray"
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
                <Text size="11px" c="dimmed" mt={3} style={{ fontFamily: 'var(--mantine-font-family-monospace)', fontStyle: 'italic', paddingLeft: 18 }}>
                  {p.description}
                </Text>
              )}
            </Card>
          ))
        )}
      </Stack>

      {/* 提取指令指示 (带右上角极客微型工具栏) */}
      <Stack gap={4}>
        <Group justify="space-between" align="center">
          <Text size="xs" fw={700} style={{ color: 'var(--flock-text-bright)' }}>
            {t('workflow.properties.extractor.instruction', 'INSTRUCTION')}
          </Text>

          {/* 右上角极客工具栏 */}
          <Group gap={4} align="center">
            <Text size="10px" c="dimmed" style={{ marginRight: 4, fontFamily: 'monospace' }}>
              {instructionLength}
            </Text>
            
            <Tooltip label={t('workflow.properties.extractor.insertVar', 'Insert Variable')} position="top">
              <ActionIcon size="xs" variant="subtle" color="gray">
                <IconBraces size={12} />
              </ActionIcon>
            </Tooltip>

            <Tooltip label={t('workflow.properties.extractor.copy', 'Copy')} position="top">
              <ActionIcon size="xs" variant="subtle" color="gray" onClick={handleCopyInstruction}>
                <IconCopy size={12} />
              </ActionIcon>
            </Tooltip>

            <Tooltip label={t('workflow.properties.extractor.maximize', 'Maximize')} position="top">
              <ActionIcon size="xs" variant="subtle" color="gray">
                <IconMaximize size={12} />
              </ActionIcon>
            </Tooltip>
          </Group>
        </Group>

        <VariableTextarea
          placeholder={t('workflow.properties.extractor.instructionPlaceholder', 'Write your prompt word here, enter \'{\' to insert a var...')}
          value={String(node.data.instruction ?? '')}
          currentNodeId={node.id}
          onChange={(val) => onDataChange(node.id, 'instruction', val)}
          minRows={3}
          size="xs"
        />
      </Stack>

      <ParameterModal
        opened={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        activeParamIndex={activeParamIndex}
        paramForm={paramForm}
        setParamForm={setParamForm}
        onSave={handleSaveParam}
      />
    </>
  );
}
