import React, { memo, useMemo } from 'react';
import { type NodeProps } from 'reactflow';
import { Box, Text } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { BaseWorkflowNode } from '../BaseWorkflowNode';
import { type BaseNodeData } from '../types';
import { ModelIcon } from '@/components/Common/Icons';
import { useAvailableModels } from '@/hooks/useAvailableModels';
import { getNodeSummary } from '../helpers';

export const AgentNode = memo((props: NodeProps<BaseNodeData>) => {
  const { data } = props;
  const { t } = useTranslation();
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

  const providerIcon = useMemo(() => {
    if (!data.model) return '';
    const modelName = String(data.model);
    const providerVal = data.provider ? String(data.provider) : '';
    if (providerVal.startsWith('data:')) {
      return providerVal;
    }
    return (
      iconMapping[providerVal] ||
      iconMapping[providerVal.toLowerCase()] ||
      iconMapping[modelName] ||
      iconMapping[modelName.toLowerCase()] ||
      providerVal
    );
  }, [data.model, data.provider, iconMapping]);

  const summary = getNodeSummary('agent', data, t);

  const customSummary = useMemo(() => {
    if (!data.model) return null;
    return (
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
    );
  }, [data.model, providerIcon, summary]);

  return <BaseWorkflowNode {...props} type="agent" customSummary={customSummary} />;
});
AgentNode.displayName = 'AgentNode';
