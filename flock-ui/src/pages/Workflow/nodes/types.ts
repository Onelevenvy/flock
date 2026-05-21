export interface BaseNodeData {
  label: string;
  onHandlePlusClick?: (nodeId: string, handleId: string, clientX: number, clientY: number) => void;
  [key: string]: unknown;
}
