import React, { useState, useEffect } from 'react';
import { Handle, Position, type NodeProps } from 'reactflow';
import { Box, Text, ActionIcon, Tooltip } from '@mantine/core';
import { IconPlus, IconBug } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { nodeConfig, type NodeType } from '../nodeConfig';
import { useWorkflowStore } from '../../../store/workflowStore';
import { type BaseNodeData } from './types';
import { handleStyle } from './styles';
import { getNodeSummary } from './helpers';

import { invoke } from '@tauri-apps/api/core';
import { ModelIcon } from '../../../components/Common/Icons';

let cachedProvidersPromise: Promise<Record<string, string>> | null = null;
function getCachedProviderIcons(): Promise<Record<string, string>> {
  if (!cachedProvidersPromise) {
    cachedProvidersPromise = invoke<any[]>('list_providers')
      .then((provs) => {
        const mapping: Record<string, string> = {};
        provs.forEach((p) => {
          if (p.id && p.icon) {
            mapping[p.id] = p.icon;
          }
        });
        return mapping;
      })
      .catch((err) => {
        console.error('Failed to load providers:', err);
        cachedProvidersPromise = null;
        return {};
      });
  }
  return cachedProvidersPromise;
}

function getProviderFromModel(model: string): string {
  const m = model.toLowerCase();
  if (m.includes('gpt') || m.startsWith('o1') || m.startsWith('o3')) return 'openai';
  if (m.includes('claude')) return 'anthropic';
  if (m.includes('deepseek')) return 'deepseek';
  if (m.includes('gemini')) return 'google';
  if (m.includes('glm')) return 'zhipu';
  if (m.includes('qwen')) return 'qwen';
  if (m.includes('llama')) return 'meta';
  if (m.includes('mimo')) return 'mimo';
  return '';
}

interface BaseWorkflowNodeProps extends NodeProps<BaseNodeData> {
  type: NodeType;
}

export function BaseWorkflowNode({ id, type, data, selected }: BaseWorkflowNodeProps) {
  const { t } = useTranslation();
  const setDebugTarget = useWorkflowStore((s) => s.setDebugTarget);
  const cfg = nodeConfig[type];
  if (!cfg) return null;
  const Icon = cfg.icon;
  const summary = getNodeSummary(type, data, t);
  const canDebug = type !== 'start' && type !== 'end';

  const [providerIcons, setProviderIcons] = useState<Record<string, string>>({});
  useEffect(() => {
    getCachedProviderIcons().then(setProviderIcons);
  }, []);

  let providerIcon = '';
  if (data.model) {
    if (data.provider) {
      const pStr = String(data.provider);
      if (pStr.startsWith('data:')) {
        providerIcon = pStr;
      } else {
        providerIcon = providerIcons[pStr] || pStr;
      }
    } else {
      const inferred = getProviderFromModel(String(data.model));
      providerIcon = providerIcons[inferred] || inferred;
    }
  }

  return (
    <Box
      style={{
        width: 220,
        borderRadius: 12,
        border: selected 
          ? `2px solid var(--flock-accent)` 
          : `1px solid var(--flock-accent)`, // 统一使用主题色蓝色外圈
        background: 'var(--flock-bg-surface)',
        boxShadow: selected 
          ? `0 0 0 3px rgba(21, 90, 239, 0.25)` 
          : '0 4px 10px rgba(0,0,0,0.03)',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        cursor: 'pointer',
        transition: 'all 0.15s ease',
      }}
    >
      <style dangerouslySetInnerHTML={{ __html: handleStyle }} />
      {/* Node Header */}
      <Box
        style={{
          padding: '8px 12px',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          borderBottom: summary ? '1px solid var(--flock-border-subtle)' : 'none',
        }}
      >
        <Box
          style={{
            width: 22,
            height: 22,
            borderRadius: 6,
            background: 'var(--flock-accent-soft)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Icon size={12} stroke={2.5} style={{ color: cfg.colorHex }} />
        </Box>
        <Text size="xs" fw={700} style={{ color: 'var(--flock-text-bright)', flex: 1, fontSize: 11, lineHeight: 1.2 }} lineClamp={1}>
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
