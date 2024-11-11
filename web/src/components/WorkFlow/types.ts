import {
  type DefaultEdgeOptions,
  type Node,
  type NodeTypes,
} from "reactflow";

import type { GraphsOut } from "@/client";

export interface NodeData {
  label: string;
  customName?: string;
  onChange?: (key: string, value: any) => void;
  model?: string;
  temperature?: number;
  tool?: string[];
  [key: string]: any;
}

export interface AgentConfig {
  id: string;
  role: string;
  goal: string;
  backstory: string;
  use_search?: boolean;
  use_scraper?: boolean;
  allow_delegation?: boolean;
  model?: string;
  base_url?: string;
  api_key?: string;
}

export interface TaskConfig {
  description: string;
  agent_id: string;
  expected_output?: string;
  output_json?: any;
  context?: string[];
}

export interface CrewAINodeData extends NodeData {
  agents: AgentConfig[];
  tasks: TaskConfig[];
  process_type: "sequential" | "hierarchical";
  llm_config: {
    model: string;
  };
  manager_config: {
    agent?: AgentConfig;
  };
}

export interface CustomNode extends Node {
  data: NodeData | CrewAINodeData;
}

export interface FlowVisualizerProps {
  graphData: GraphsOut;
  nodeTypes: NodeTypes;
  defaultEdgeOptions?: DefaultEdgeOptions;
  teamId: number;
}
