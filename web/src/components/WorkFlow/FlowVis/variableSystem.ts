import { Node, Edge } from "reactflow";

import { nodeConfig, NodeType } from "../Nodes/nodeConfig";

export interface VariableReference {
  nodeId: string;
  variableName: string;
  variableType: string;
}

export function parseVariableReference(ref: string): VariableReference | null {
  const match = ref.match(/\$\{(\w+)\.(\w+)\}/);

  if (match) {
    return { nodeId: match[1], variableName: match[2] , variableType: 'unknown'};
  }

  return null;
}

function getUpstreamNodes(
  nodeId: string,
  nodes: Node[],
  edges: Edge[]
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

export function getAvailableVariables(
  currentNodeId: string,
  nodes: Node[],
  edges: Edge[],
): VariableReference[] {
  const upstreamNodes = getUpstreamNodes(currentNodeId, nodes, edges);

  return upstreamNodes.flatMap((node) => {
    const nodeType = node.type as NodeType;
    const config = nodeConfig[nodeType];
    
    let outputVars: { name: string; type: string }[] = [];

    if (typeof config.outputVariables === 'function') {
      outputVars = config.outputVariables(node.data);
    } 
   
    else if (Array.isArray(config.outputVariables)) {
      outputVars = config.outputVariables.map((variableName) => {
        const type = (config.outputSchema && config.outputSchema[variableName]) ? config.outputSchema[variableName] : 'any';
        return { name: variableName, type: type };
      });
    }

    return outputVars.map(({ name, type }) => ({
      nodeId: node.id,
      variableName: name,
      variableType: type,
    }));
  });
}
export function validateVariableReferences(
  nodeId: string,
  data: any,
  nodes: Node[],
  edges: Edge[]
): string[] {
  const availableVariables = getAvailableVariables(nodeId, nodes, edges);
  const errors: string[] = [];

  Object.entries(data).forEach(([key, value]) => {
    if (typeof value === "string") {
      const ref = parseVariableReference(value);

      if (
        ref &&
        !availableVariables.some(
          (v) => v.nodeId === ref.nodeId && v.variableName === ref.variableName
        )
      ) {
        errors.push(`Invalid variable reference: ${value} in field ${key}`);
      }
    }
  });

  return errors;
}
