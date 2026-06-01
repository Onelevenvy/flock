import { useMemo } from 'react';
import { Handle, Position, type NodeProps } from 'reactflow';
import { Box, Text, ActionIcon, Tooltip } from '@mantine/core';
import { IconPlus, IconBug } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { nodeConfig, type NodeType } from '@/pages/Workflow/nodeConfig';
import { useWorkflowStore } from '@/store/workflowStore';
import { type BaseNodeData } from './types';
import { handleStyle } from './styles';
import { getNodeSummary } from './helpers';

import { ModelIcon, ToolsIcon } from '@/components/Common/Icons';
import { useAvailableModels } from '@/hooks/useAvailableModels';
import { useAvailableTools } from '@/hooks/useAvailableTools';

interface BaseWorkflowNodeProps extends NodeProps<BaseNodeData> {
  type: NodeType;
}

export function BaseWorkflowNode({ id, type, data, selected }: BaseWorkflowNodeProps) {
  const { t } = useTranslation();
  const setDebugTarget = useWorkflowStore((s) => s.setDebugTarget);
  const { providers, models } = useAvailableModels();

  const iconMapping = useMemo(() => {
    const mapping: Record<string, string> = {};
    providers.forEach((p) => {
      if (p.icon) {
        if (p.id) mapping[p.id] = p.icon;
        if (p.provider_type) {
          mapping[p.provider_type] = p.icon;
          mapping[p.provider_type.toLowerCase()] = p.icon;
        }
      }
    });
    models.forEach((m) => {
      const p = providers.find((prov) => prov.id === m.provider_id);
      if (p && p.icon) {
        mapping[m.model_name] = p.icon;
        mapping[m.model_name.toLowerCase()] = p.icon;
      }
    });
    return mapping;
  }, [providers, models]);

  const { tools: availableTools, providers: availableProviders } = useAvailableTools();

  const toolIcon = useMemo(() => {
    if (type === 'plugin') {
      const toolData = data.tool as { name?: string } | undefined;
      if (toolData?.name) {
        const tool = availableTools.find((t) => t.name === toolData.name);
        if (tool) {
          const provider = availableProviders.find((p) => p.id === tool.provider_id);
          return provider?.icon || '';
        }
      }
    }
    return '';
  }, [type, data.tool, availableTools, availableProviders]);

  const cfg = nodeConfig[type];
  if (!cfg) return null;
  const Icon = cfg.icon;
  const summary = getNodeSummary(type, data, t);
  const canDebug = type !== 'start' && type !== 'end';

  let providerIcon = '';
  if (data.model) {
    const modelName = String(data.model);
    const providerVal = data.provider ? String(data.provider) : '';
    if (providerVal.startsWith('data:')) {
      providerIcon = providerVal;
    } else {
      // 动态匹配：如果节点上的 provider 有值，从后端字典中查出对应的 Base64 图标；
      // 如果 provider 缺失为空，则直接使用节点的 data.model 从后端模型字典中匹配出正确的 Base64 图标！
      providerIcon =
        iconMapping[providerVal] ||
        iconMapping[providerVal.toLowerCase()] ||
        iconMapping[modelName] ||
        iconMapping[modelName.toLowerCase()] ||
        providerVal;
    }
  }

  return (
    <Box
      className={`flock-workflow-node ${selected ? 'selected' : ''}`}
    >
      <style dangerouslySetInnerHTML={{ __html: handleStyle }} />
      {/* Node Header */}
      <Box
        style={{
          padding: '10px 12px',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          borderBottom: summary ? '1px solid var(--flock-border-subtle)' : 'none',
        }}
      >
        <Box
          className="flock-node-icon-container"
          style={{
            background: `${cfg.colorHex}15`,
          }}
        >
          {toolIcon ? (
            <ToolsIcon name={toolIcon} size={14} />
          ) : (
            <Icon size={14} stroke={2.5} style={{ color: cfg.colorHex }} />
          )}
        </Box>
        <Text size="xs" fw={700} style={{ color: 'var(--flock-text-bright)', flex: 1, fontSize: 12, lineHeight: 1.2 }} lineClamp={1}>
          {data.label || t(cfg.displayKey, { defaultValue: cfg.display })}
        </Text>
        {canDebug && (
          <Tooltip label={t('workflow.debugNode', 'Debug')} position="top" withArrow>
            <ActionIcon
              size="xs"
              variant="subtle"
              color="teal"
              onClick={(e) => {
                e.stopPropagation();
                setDebugTarget({ nodeId: id });
              }}
              style={{ opacity: 0.6 }}
            >
              <IconBug size={10} />
            </ActionIcon>
          </Tooltip>
        )}
      </Box>

      {/* Node Content/Summary */}
      {summary && (
        <Box style={{ padding: '8px 12px', minHeight: 38, display: 'flex', alignItems: 'center' }}>
          {(type === 'llm' || type === 'agent') && data.model ? (
            <Box style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%' }}>
              <ModelIcon
                name={String(data.model)}
                provider={providerIcon}
                size={14}
                style={{ flexShrink: 0 }}
              />
              <Text size="xs" c="dimmed" lineClamp={1} style={{ fontSize: 10, flex: 1 }}>
                {summary}
              </Text>
            </Box>
          ) : (
            <Text size="xs" c="dimmed" lineClamp={2} style={{ fontSize: 10 }}>
              {summary}
            </Text>
          )}
        </Box>
      )}

      {/* Handles */}
      {cfg.allowedConnections.targets.includes('left') && (
        <Handle
          type="target"
          position={Position.Left}
          id="left"
          style={{
            background: 'var(--flock-bg-surface)',
            border: `2px solid var(--flock-accent)`, // 统一成主题色蓝色
            width: 8,
            height: 8,
          }}
        />
      )}
      {cfg.allowedConnections.sources.includes('right') && (
        <div 
          className="flock-handle-container"
          style={{
            position: 'absolute',
            top: '50%',
            right: -28,
            transform: 'translateY(-50%)',
            width: 32,
            height: 20,
            zIndex: 10,
          }}
        >
          <Handle
            type="source"
            position={Position.Right}
            id="right"
            style={{
              background: 'var(--flock-bg-surface)',
              border: `2px solid var(--flock-accent)`,
              width: 8,
              height: 8,
              top: '50%',
              left: 0,
              transform: 'translateY(-50%)',
            }}
          />
          <div className="flock-handle-plus">
            <ActionIcon
              size="16px"
              radius="xl"
              variant="filled"
              style={{
                boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
                cursor: 'pointer',
                background: 'var(--flock-accent, #155aef)',
              }}
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                if (data.onHandlePlusClick) {
                  data.onHandlePlusClick(id, 'right', e.clientX, e.clientY);
                }
              }}
            >
              <IconPlus size={10} stroke={3} />
            </ActionIcon>
          </div>
        </div>
      )}
    </Box>
  );
}
