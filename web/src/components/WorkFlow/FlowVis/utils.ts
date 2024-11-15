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
  rankSpacing?: number; // 水平间距
  nodeSpacing?: number; // 垂直间距
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
    rankSpacing = 50, // 默认水平间距
    nodeSpacing = 50, // 默认垂直间距
  } = options;

  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));

  // 设置布局方向为 LR (left to right)
  dagreGraph.setGraph({
    rankdir: "LR",
    nodesep: nodeSpacing,
    ranksep: rankSpacing,
    align: "UL",
    marginx: 50,
    marginy: 50,
  });

  // 添加节点
  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, {
      width: nodeWidth,
      height: nodeHeight,
    });
  });

  // 添加边
  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  // 计算布局
  dagre.layout(dagreGraph);

  // 获取新的节点位置
  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);

    return {
      ...node,
      position: {
        x: nodeWithPosition.x - nodeWidth / 2,
        y: nodeWithPosition.y - nodeHeight / 2,
      },
      // 添加动画类
      className: "react-flow__node-animated",
    };
  });

  return layoutedNodes;
};
