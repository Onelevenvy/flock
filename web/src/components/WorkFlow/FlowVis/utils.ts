import dagre from "dagre";
import { Node, Edge } from "reactflow";

// 计算边的中心点
export const calculateEdgeCenter = (
  sourceNode: Node,
  targetNode: Node
): { x: number; y: number } => {
  const sourceX = sourceNode.position.x + (sourceNode.width ?? 0) / 2;
  const sourceY = sourceNode.position.y + (sourceNode.height ?? 0) / 2;
  const targetX = targetNode.position.x + (targetNode.width ?? 0) / 2;
  const targetY = targetNode.position.y + (targetNode.height ?? 0) / 2;

  return {
    x: (sourceX + targetX) / 2,
    y: (sourceY + targetY) / 2,
  };
};

interface LayoutOptions {
  nodeWidth?: number;
  nodeHeight?: number;
  rankSpacing?: number;
  nodeSpacing?: number;
}

interface DagreNodeConfig {
  width: number;
  height: number;
  rank?: number;
}

// 使用 dagre 进行自动布局
export const getLayoutedElements = (
  nodes: Node[],
  edges: Edge[],
  options: LayoutOptions = {}
) => {
  const {
    nodeWidth = 200,
    nodeHeight = 100,
    rankSpacing = 80,
    nodeSpacing = 80,
  } = options;

  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));

  dagreGraph.setGraph({
    rankdir: "LR",
    nodesep: nodeSpacing,
    ranksep: rankSpacing,
    align: "UL",
    marginx: 50,
    marginy: 50,
  });

  // 找出所有 LLM 节点和与之相连的节点
  const llmNodes = nodes.filter((node) => node.type === "llm");
  const connectedToolNodes = new Set<string>();
  const connectedAnswerNodes = new Map<string, string>(); // Map<AnswerNodeId, LLMNodeId>

  edges.forEach((edge) => {
    const sourceLLM = llmNodes.find((n) => n.id === edge.source);
    const targetLLM = llmNodes.find((n) => n.id === edge.target);
    const sourceNode = nodes.find((n) => n.id === edge.source);
    const targetNode = nodes.find((n) => n.id === edge.target);

    // 处理工具节点
    if (
      sourceLLM &&
      (targetNode?.type === "tool" || targetNode?.type === "toolretrieval")
    ) {
      connectedToolNodes.add(targetNode.id);
    }
    if (
      targetLLM &&
      (sourceNode?.type === "tool" || sourceNode?.type === "toolretrieval")
    ) {
      connectedToolNodes.add(sourceNode.id);
    }

    // 处理 answer 节点，记录它对应的 LLM 节点
    if (sourceLLM && targetNode?.type === "answer") {
      connectedAnswerNodes.set(targetNode.id, sourceLLM.id);
    }
    if (targetLLM && sourceNode?.type === "answer") {
      connectedAnswerNodes.set(sourceNode.id, targetLLM.id);
    }
  });

  // 为每个 LLM 节点分配一个唯一的 rank
  const llmRanks = new Map<string, number>();
  llmNodes.forEach((node, index) => {
    llmRanks.set(node.id, index);
  });

  // 添加节点
  nodes.forEach((node) => {
    const isConnectedTool = connectedToolNodes.has(node.id);
    const connectedLLMId = connectedAnswerNodes.get(node.id);
    const isLLM = node.type === "llm";

    const nodeConfig: DagreNodeConfig = {
      width: nodeWidth,
      height: nodeHeight,
    };

    // 如果是 LLM 节点或与之相连的 Answer 节点，使用相同的 rank
    if (isLLM) {
      nodeConfig.rank = llmRanks.get(node.id);
    } else if (node.type === "answer" && connectedLLMId) {
      nodeConfig.rank = llmRanks.get(connectedLLMId);
    }

    dagreGraph.setNode(node.id, nodeConfig);
  });

  // 添加边
  edges.forEach((edge) => {
    const weight = edge.source === edge.target ? 0 : 1;
    dagreGraph.setEdge(edge.source, edge.target, { weight });
  });

  // 计算布局
  dagre.layout(dagreGraph);

  // 获取新的节点位置
  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    const isConnectedTool = connectedToolNodes.has(node.id);
    const connectedLLMId = connectedAnswerNodes.get(node.id);

    const position = {
      x: nodeWithPosition.x - nodeWidth / 2,
      y: nodeWithPosition.y - nodeHeight / 2,
    };

    // 工具节点向下偏移
    if (isConnectedTool) {
      position.y += nodeHeight * 1.5;
    }

    // Answer 节点与对应的 LLM 节点对齐
    if (node.type === "answer" && connectedLLMId) {
      const llmNode = nodes.find((n) => n.id === connectedLLMId);
      if (llmNode) {
        position.y = llmNode.position.y;
      }
    }

    return {
      ...node,
      position,
      className: "react-flow__node-animated",
    };
  });

  return layoutedNodes;
};
