import { Node, Edge } from "reactflow";

import { nodeConfig, NodeType } from "../Nodes/nodeConfig";

export interface VariableReference {
  nodeId: string;
  variableName: string;
}

export function parseVariableReference(ref: string): VariableReference | null {
  const match = ref.match(/\$\{(\w+)\.(\w+)\}/);

  if (match) {
    return { nodeId: match[1], variableName: match[2] };
  }

  return null;
}

function getUpstreamNodes(
  nodeId: string,
  nodes: Node[],
  edges: Edge[],
): Node[] {
  const upstreamNodeIds = new Set<string>();
  const queue = [nodeId];

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    const incomingEdges = edges.filter((edge) => edge.target === currentId);

    for (const edge of incomingEdges) {
      if (!upstreamNodeIds.has(edge.source)) {
        upstreamNodeIds.add(edge.source);
        queue.push(edge.source);
      }
    }
  }

  return nodes.filter((node) => upstreamNodeIds.has(node.id));
}
// 搜索并找到 getAvailableVariables 函数

export function getAvailableVariables(
  currentNodeId: string,
  nodes: Node[],
  edges: Edge[],
): VariableReference[] {
  const upstreamNodes = getUpstreamNodes(currentNodeId, nodes, edges);

  return upstreamNodes.flatMap((node) => {
    const nodeType = node.type as NodeType;
    const config = nodeConfig[nodeType];
    
    let outputVars: string[] = [];

    // 【关键】检查 outputVariables 是函数还是数组
    if (typeof config.outputVariables === 'function') {
      // 如果是函数, 用节点当前的数据去调用它，获取动态的变量列表
      outputVars = config.outputVariables(node.data);
    } else if (Array.isArray(config.outputVariables)) {
      // 如果是数组 (适用于其他普通节点), 直接使用
      outputVars = config.outputVariables;
    }

    return outputVars.map((variableName) => ({
      nodeId: node.id,
      variableName,
    }));
  });
}

export function validateVariableReferences(
  nodeId: string,
  data: any,
  nodes: Node[],
  edges: Edge[],
): string[] {
  const availableVariables = getAvailableVariables(nodeId, nodes, edges);
  const errors: string[] = [];

  Object.entries(data).forEach(([key, value]) => {
    if (typeof value === "string") {
      const ref = parseVariableReference(value);

      if (
        ref &&
        !availableVariables.some(
          (v) => v.nodeId === ref.nodeId && v.variableName === ref.variableName,
        )
      ) {
        errors.push(`Invalid variable reference: ${value} in field ${key}`);
      }
    }
  });

  return errors;
}
