import type { Edge, Node } from 'reactflow';

export interface VariableOption {
  label: string;
  value: string;
  nodeId: string;
  nodeName: string;
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
  edges: Edge[]
): VariableOption[] {
  const ancestors = getAncestorNodeIds(currentNodeId, edges);
  const vars: VariableOption[] = [];

  nodes.forEach((node) => {
    // 只能使用前序节点的参数
    if (!ancestors.has(node.id)) return;

    const nodeLabel = String(node.data?.label || node.id);
    const nodeType = node.type;

    if (nodeType === 'start') {
      vars.push({
        label: `${nodeLabel} (query)`,
        value: `\${${node.id}.query}`,
        nodeId: node.id,
        nodeName: nodeLabel,
      });
    } else if (nodeType === 'classifier') {
      vars.push({
        label: `${nodeLabel} (category_id)`,
        value: `\${${node.id}.category_id}`,
        nodeId: node.id,
        nodeName: nodeLabel,
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
            });
          }
        });
      } else {
        vars.push({
          label: `${nodeLabel} (response)`,
          value: `\${${node.id}.response}`,
          nodeId: node.id,
          nodeName: nodeLabel,
        });
      }
    } else {
      vars.push({
        label: `${nodeLabel} (response)`,
        value: `\${${node.id}.response}`,
        nodeId: node.id,
        nodeName: nodeLabel,
      });
    }
  });

  return vars;
}
