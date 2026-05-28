import type { Edge, Node } from 'reactflow';
import type { VariableType } from '../../../../types/workflowVariables';
import { SYSTEM_VARIABLES } from '../../../../types/workflowVariables';
import type { EnvVar } from '../../../../store/workflowStore';

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
      vars.push({
        label: `${nodeLabel} (query)`,
        value: `\${${node.id}.query}`,
        nodeId: node.id,
        nodeName: nodeLabel,
        varType: 'string',
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
