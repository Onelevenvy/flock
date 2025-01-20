import { type Edge } from "reactflow";
import { v4 } from "uuid";
import {
  type NodeType,
  nodeConfig,
} from "@/components/WorkFlow/Nodes/nodeConfig";
import type { CustomNode } from "@/components/WorkFlow/types";

export interface GraphConfig {
  id: string;
  name: string;
  nodes: any[];
  edges: any[];
  metadata: {
    entry_point: string | null;
    start_connections: any[];
    end_connections: any[];
  };
}

export function generateGraphConfig(
  nodes: CustomNode[],
  edges: Edge[],
  configName: string = "Flow Visualization"
): GraphConfig {
  const startEdge = edges.find((edge) => {
    const sourceNode = nodes.find(
      (node) => node.id === edge.source && node.type === "start"
    );
    return sourceNode !== undefined;
  });

  const entryPointId = startEdge ? startEdge.target : null;

  return {
    id: v4(),
    name: configName,
    nodes: nodes.map((node) => {
      const nodeType = node.type as NodeType;
      const initialData = nodeConfig[nodeType].initialData || {};
      const nodeData: Record<string, any> = {
        ...node.data,
        label: node.data.label,
      };

      Object.keys(initialData).forEach((key) => {
        if (node.data[key] !== undefined) {
          nodeData[key] = node.data[key];
        }
      });

      return {
        id: node.id,
        type: node.type,
        position: node.position,
        data: nodeData,
      };
    }),
    edges: edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      sourceHandle: edge.sourceHandle || "bottom",
      targetHandle: edge.targetHandle || "top",
      type: edge.type,
    })),
    metadata: {
      entry_point: entryPointId,
      start_connections: edges
        .filter((edge) =>
          nodes.find((node) => node.id === edge.source && node.type === "start")
        )
        .map((edge) => ({
          target: edge.target,
          type: edge.type,
        })),
      end_connections: edges
        .filter((edge) =>
          nodes.find((node) => node.id === edge.target && node.type === "end")
        )
        .map((edge) => ({
          source: edge.source,
          type: edge.type,
        })),
    },
  };
}
