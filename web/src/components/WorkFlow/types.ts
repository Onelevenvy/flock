import { type DefaultEdgeOptions, type Node, type NodeTypes } from "reactflow";

import type { GraphsOut, InterruptType } from "@/client";

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
  name: string;
  role: string;
  goal: string;
  backstory: string;
  tools: string[];
  allow_delegation?: boolean;
}

export interface TaskConfig {
  name: string;
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

export interface ClassifierCategory {
  category_id: string;
  category_name: string;
}

export interface ClassifierNodeData extends NodeData {
  categories: ClassifierCategory[];
  model?: string;
}

export enum LogicalOperator {
  and = "and",
  or = "or",
}

export enum ComparisonOperator {
  contains = "contains",
  notContains = "notContains",
  startWith = "startWith",
  endWith = "endWith",
  equal = "equal",
  notEqual = "notEqual",
  empty = "empty",
  notEmpty = "notEmpty",
}

export interface Condition {
  id: string;
  field: string;
  comparison_operator: ComparisonOperator;
  value: string;
  compareType: "constant" | "variable";
}

export interface IfElseCase {
  case_id: string;
  logical_operator: LogicalOperator;
  conditions: Condition[];
}

export interface IfElseNodeData extends NodeData {
  cases: IfElseCase[];
}

export interface HumanNodeData extends NodeData {
  interaction_type: InterruptType;
  routes?: {
    [key: string]: string;
  };
  title?: string;
}
