/** Variable types for the typed variable system */
export type VariableType = 'string' | 'number' | 'boolean' | 'object' | 'array';

/** A typed variable with metadata */
export interface TypedVariable {
  name: string;
  varType: VariableType;
  value: unknown;
}

/** Variable option for the variable picker */
export interface VariableOption {
  label: string;
  value: string;
  nodeId: string;
  nodeName: string;
  varType: VariableType;
  group?: string;
}

/** System variables available in all workflow nodes */
export const SYSTEM_VARIABLES: VariableOption[] = [
  {
    label: 'User Query',
    value: '${sys.query}',
    nodeId: 'sys',
    nodeName: 'System',
    varType: 'string',
    group: 'system',
  },
  {
    label: 'Workflow ID',
    value: '${sys.workflow_id}',
    nodeId: 'sys',
    nodeName: 'System',
    varType: 'string',
    group: 'system',
  },
  {
    label: 'Current Node',
    value: '${sys.current_node}',
    nodeId: 'sys',
    nodeName: 'System',
    varType: 'string',
    group: 'system',
  },
  {
    label: 'Timestamp',
    value: '${sys.timestamp}',
    nodeId: 'sys',
    nodeName: 'System',
    varType: 'number',
    group: 'system',
  },
];

/** Infer VariableType from a JS value */
export function inferVariableType(value: unknown): VariableType {
  if (value === null || value === undefined) return 'string';
  if (typeof value === 'string') return 'string';
  if (typeof value === 'number') return 'number';
  if (typeof value === 'boolean') return 'boolean';
  if (Array.isArray(value)) return 'array';
  if (typeof value === 'object') return 'object';
  return 'string';
}

/** Short label for type badges */
export const TYPE_BADGES: Record<VariableType, string> = {
  string: 'S',
  number: 'N',
  boolean: 'B',
  object: 'O',
  array: 'A',
};

/** Color for type badges */
export const TYPE_COLORS: Record<VariableType, string> = {
  string: 'blue',
  number: 'teal',
  boolean: 'orange',
  object: 'purple',
  array: 'pink',
};
