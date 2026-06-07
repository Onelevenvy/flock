import type { Edge, Node } from 'reactflow';
import type { VariableType } from '@/types/workflowVariables';
import { SYSTEM_VARIABLES } from '@/types/workflowVariables';
import type { EnvVar } from '@/store/workflowStore';

export interface VariableOption {
  label: string;
  value: string;
  nodeId: string;
  nodeName: string;
  varType?: VariableType;
}

export function getAncestorNodeIds(currentNodeId: string, edges: Edge[]): Set<string> {
  const ancestors = new Set<string>();
  const queue = [currentNodeId];
  const visited = new Set<string>([currentNodeId]);

  while (queue.length > 0) {
    const curr = queue.shift()!;
    edges.forEach((e) => {
      if (e.target === curr && !visited.has(e.source)) {
        visited.add(e.source);
        ancestors.add(e.source);
        queue.push(e.source);
      }
    });
  }
  return ancestors;
}

export function getAvailableVariables(
  currentNodeId: string,
  nodes: Node[],
  edges: Edge[],
  environmentVariables?: Record<string, EnvVar>,
): VariableOption[] {
  const ancestors = getAncestorNodeIds(currentNodeId, edges);
  const vars: VariableOption[] = [];

  // System variables (available in all nodes)
  vars.push(...SYSTEM_VARIABLES);

  // Environment variables
  if (environmentVariables) {
    Object.entries(environmentVariables).forEach(([key, envVar]) => {
      vars.push({
        label: `env.${key}`,
        value: `\${env.${key}}`,
        nodeId: 'env',
        nodeName: 'Environment',
        varType: envVar.type,
      });
    });
  }

  // Node output variables (only from ancestor nodes)
  nodes.forEach((node) => {
    if (!ancestors.has(node.id)) return;

    const nodeLabel = String(node.data?.label || node.id);
    const nodeType = node.type;

    if (nodeType === 'start') {
      vars.push(
        {
          label: `${nodeLabel} (query)`,
          value: `\${${node.id}.query}`,
          nodeId: node.id,
          nodeName: nodeLabel,
          varType: 'string',
        },
        {
          label: `${nodeLabel} (attachments)`,
          value: `\${${node.id}.attachments}`,
          nodeId: node.id,
          nodeName: nodeLabel,
          varType: 'array',
        }
      );

      const startVars = (node.data?.variables as any[]) || [];
      startVars.forEach((v) => {
        if (v.name === 'query' || v.name === 'attachments') return;
        const mapFieldTypeToVariableType = (t: string): any => {
          if (t === 'number') return 'number';
          if (t === 'boolean') return 'boolean';
          if (t === 'file') return 'object';
          if (t === 'files') return 'array';
          return 'string';
        };
        vars.push({
          label: `${nodeLabel} (${v.name})`,
          value: `\${${node.id}.${v.name}}`,
          nodeId: node.id,
          nodeName: nodeLabel,
          varType: mapFieldTypeToVariableType(v.type),
        });
      });
    } else if (nodeType === 'classifier') {
      vars.push({
        label: `${nodeLabel} (category_id)`,
        value: `\${${node.id}.category_id}`,
        nodeId: node.id,
        nodeName: nodeLabel,
        varType: 'string',
      });
    } else if (nodeType === 'parameterExtractor') {
      const parameters = node.data?.parameters as Array<{ name: string }> | undefined;
      if (parameters && parameters.length > 0) {
        parameters.forEach((p) => {
          if (p.name) {
            vars.push({
              label: `${nodeLabel} (${p.name})`,
              value: `\${${node.id}.${p.name}}`,
              nodeId: node.id,
              nodeName: nodeLabel,
              varType: 'object',
            });
          }
        });
      } else {
        vars.push({
          label: `${nodeLabel} (response)`,
          value: `\${${node.id}.response}`,
          nodeId: node.id,
          nodeName: nodeLabel,
          varType: 'string',
        });
      }
    } else if (nodeType === 'httpRequest') {
      vars.push(
        {
          label: `${nodeLabel} (response)`,
          value: `\${${node.id}.response}`,
          nodeId: node.id,
          nodeName: nodeLabel,
          varType: 'string',
        },
        {
          label: `${nodeLabel} (status_code)`,
          value: `\${${node.id}.status_code}`,
          nodeId: node.id,
          nodeName: nodeLabel,
          varType: 'number',
        },
      );
    } else if (nodeType === 'human') {
      vars.push(
        {
          label: `${nodeLabel} (choice)`,
          value: `\${${node.id}.choice}`,
          nodeId: node.id,
          nodeName: nodeLabel,
          varType: 'string',
        },
        {
          label: `${nodeLabel} (choice_label)`,
          value: `\${${node.id}.choice_label}`,
          nodeId: node.id,
          nodeName: nodeLabel,
          varType: 'string',
        },
        {
          label: `${nodeLabel} (feedback)`,
          value: `\${${node.id}.feedback}`,
          nodeId: node.id,
          nodeName: nodeLabel,
          varType: 'string',
        },
        {
          label: `${nodeLabel} (content)`,
          value: `\${${node.id}.content}`,
          nodeId: node.id,
          nodeName: nodeLabel,
          varType: 'string',
        }
      );
    } else {
      vars.push({
        label: `${nodeLabel} (response)`,
        value: `\${${node.id}.response}`,
        nodeId: node.id,
        nodeName: nodeLabel,
        varType: 'string',
      });
    }
  });

  return vars;
}

export interface TextSegment {
  type: 'text' | 'variable';
  content: string;
  variable?: VariableOption;
}

export function parseVariableTemplate(text: string, variablesList: VariableOption[]): TextSegment[] {
  if (!text) return [];
  const regex = /(\$\{[^}]+\})/g;
  const parts = text.split(regex);
  return parts.map((part) => {
    if (part.match(/^\$\{[^}]+\}$/)) {
      const matchedVar = variablesList.find((v) => v.value === part);
      return {
        type: 'variable',
        content: part,
        variable: matchedVar,
      };
    }
    return {
      type: 'text',
      content: part,
    };
  });
}

export interface VariableDetails {
  varName: string;
  groupName: string;
  isInvalid: boolean;
  bgColor: string;
  borderColor: string;
  textColor: string;
  icon: string;
}

export function resolveVariableDetails(match: string, matchedVar?: VariableOption): VariableDetails {
  const varPath = match.substring(2, match.length - 1);
  const varName = varPath.split('.')[1] || varPath;
  
  let groupName = 'Start';
  if (match.startsWith('${sys.')) {
    groupName = 'SYSTEM';
  } else if (matchedVar) {
    groupName = matchedVar.nodeName;
  }
  
  const isInvalid = !matchedVar && !match.startsWith('${sys.');
  const bgColor = isInvalid ? 'var(--mantine-color-red-light, #fff0f0)' : 'var(--mantine-color-blue-light, #e8f4fd)';
  const borderColor = isInvalid ? 'var(--mantine-color-red-outline, #ffa8a8)' : 'var(--mantine-color-blue-outline, #cbe4fb)';
  const textColor = isInvalid ? 'var(--mantine-color-red-filled, #fa5252)' : 'var(--mantine-color-blue-filled, #155aef)';
  const icon = isInvalid ? '⚠️' : '🏠';

  return {
    varName,
    groupName,
    isInvalid,
    bgColor,
    borderColor,
    textColor,
    icon,
  };
}

export interface DebugVariable {
  fullPath: string;
  nodeId: string;
  field: string;
  value: string;
}

export function extractVariables(data: unknown): DebugVariable[] {
  if (!data) return [];
  const serialized = JSON.stringify(data);
  const regex = /\$\{([^}]+)\}/g;
  const matches = new Set<string>();
  let match;
  while ((match = regex.exec(serialized)) !== null) {
    matches.add(match[1].trim());
  }

  const vars: DebugVariable[] = [];
  matches.forEach((p) => {
    if (p.startsWith('sys.')) {
      return;
    }
    const parts = p.split('.').map((s) => s.trim());
    if (parts.length >= 2) {
      const nodeId = parts[0];
      const field = parts[parts.length - 1];
      if (!vars.some((v) => v.nodeId === nodeId && v.field === field)) {
        vars.push({ fullPath: p, nodeId, field, value: '' });
      }
    }
  });
  return vars;
}



