"use client";
import {
  Box,
  Button,
  CloseButton,
  Kbd,
  useToast,
  Menu,
  MenuButton,
  MenuItem,
  MenuList,
  IconButton,
  Text,
  HStack,
  Tooltip,
} from "@chakra-ui/react";
import type React from "react";
import { type KeyboardEvent, useCallback, useMemo, useState } from "react";
import { FaGripHorizontal, FaPlus } from "react-icons/fa";
import { MdBuild, MdOutlineHelp } from "react-icons/md";
import { VscDebugAlt } from "react-icons/vsc";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  type Node,
  type Edge,
  ConnectionLineType,
  type Connection,
  useReactFlow,
  MarkerType,
  Panel,
  useViewport,
  EdgeLabelRenderer,
} from "reactflow";

import { useContextMenu } from "@/hooks/graphs/useContextMenu";
import { useFlowState } from "@/hooks/graphs/useFlowState";
import { useGraphConfig } from "@/hooks/graphs/useUpdateGraphConfig";

import NodePalette from "./NodePalette";
import { getAvailableVariables } from "./variableSystem";

import "reactflow/dist/style.css";
import DebugPreview from "../../Teams/DebugPreview";
import BaseProperties from "../Nodes/Base/BaseNodeProperties";
import { type NodeType, nodeConfig } from "../Nodes/nodeConfig";
import type {
  ClassifierNodeData,
  CustomNode,
  FlowVisualizerProps,
  IfElseNodeData,
} from "../types";
import { calculateEdgeCenter, getLayoutedElements } from "./utils";
import SharedNodeMenu from "./SharedNodeMenu";

import useWorkflowStore from "@/stores/workflowStore";
import CustomButton from "@/components/Common/CustomButton";
import ApiKeyButton from "@/components/Teams/Apikey/ApiKeyManageButton";
import { useTranslation } from "react-i18next";
import { FiEye, FiEyeOff } from "react-icons/fi";

const FlowVisualizer: React.FC<FlowVisualizerProps> = ({
  nodeTypes,
  defaultEdgeOptions,
  teamId,
  graphData,
}) => {
  const { t } = useTranslation();
  const {
    nodes,
    setNodes,
    edges,
    setEdges,
    selectedNodeId,
    setSelectedNodeId,
    onNodesChange,
    onEdgesChange,
    onConnect,
    onNodeDataChange,
    nameError,
  } = useFlowState(
    graphData?.data[0]?.config?.nodes,
    graphData?.data[0]?.config?.edges
  );

  const { contextMenu, onNodeContextMenu, closeContextMenu } = useContextMenu();

  const reactFlowInstance = useReactFlow();
  const toast = useToast();
  const [selectedEdge, setSelectedEdge] = useState<Edge | null>(null);
  const onNodeClick = useCallback(
    (event: React.MouseEvent, node: Node) => {
      setSelectedNodeId(node.id);
      setSelectedEdge(null); // 取消选中的边
    },
    [setSelectedNodeId]
  );

  const { activeNodeName } = useWorkflowStore();

  const selectedNode = useMemo(
    () => nodes?.find((n) => n.id === selectedNodeId) || null,
    [nodes, selectedNodeId]
  );

  const nodesWithSelection = useMemo(() => {
    if (!nodes) return [];

    return nodes.map((node) => {
      let isActive = node.id === activeNodeName;

      if (
        node.type === "tool" &&
        node.data.tools &&
        Array.isArray(node.data.tools)
      ) {
        isActive = isActive || node.data.tools.includes(activeNodeName);
      }

      return {
        ...node,
        style: {
          ...node.style,
          border:
            node.id === selectedNodeId
              ? "3px solid #2970ff"
              : isActive
                ? "4px solid #38a169"
                : "none",
          borderRadius: "8px",
          backgroundColor: isActive ? "#e6fffa" : "white",
          boxShadow: isActive ? "0 0 10px rgba(56, 161, 105, 0.5)" : "none",
          transition: "all 0.3s ease",
        },
      };
    });
  }, [nodes, selectedNodeId, activeNodeName]);

  const getNodePropertiesComponent = (node: Node | null) => {
    if (!node) return null;

    const nodeType = node.type as NodeType;
    const PropertiesComponent = nodeConfig[nodeType]?.properties;
    const { icon: Icon, colorScheme } = nodeConfig[nodeType];
    const availableVariables = getAvailableVariables(node.id, nodes, edges);

    return (
      <BaseProperties
        icon={<Icon />}
        colorScheme={colorScheme}
        nodeName={node.data.label}
        onNameChange={(newName: string) =>
          onNodeDataChange(node.id, "label", newName)
        }
        nameError={nameError}
        node={node}
        onNodeDataChange={onNodeDataChange}
        availableVariables={availableVariables}
      >
        {PropertiesComponent && (
          <PropertiesComponent
            node={node}
            onNodeDataChange={onNodeDataChange}
            availableVariables={availableVariables}
          />
        )}
      </BaseProperties>
    );
  };

  const isValidConnection = useCallback(
    (connection: Connection) => {
      const sourceNode = nodes.find((node) => node.id === connection.source);
      const targetNode = nodes.find((node) => node.id === connection.target);

      if (!sourceNode || !targetNode) return false;

      const sourceType = sourceNode.type as NodeType;
      const targetType = targetNode.type as NodeType;

      // 防止自连接
      if (connection.source === connection.target) return false;

      // 防止重复连接
      const existingEdge = edges.find(
        (edge) =>
          edge.source === connection.source &&
          edge.target === connection.target &&
          edge.sourceHandle === connection.sourceHandle
      );
      if (existingEdge) return false;

      // 分类器节点的特殊处理
      if (sourceType === "classifier") {
        // 分类器节点的输出连接必须使用分类ID作为handleId
        if (!connection.sourceHandle) return false;

        // 验证sourceHandle是否是有效的分类ID
        const categories = (sourceNode.data as ClassifierNodeData).categories;
        if (!categories.find((c) => c.category_id === connection.sourceHandle))
          return false;

        // 验证目标节点的连接点
        if (
          connection.targetHandle &&
          !nodeConfig[targetType].allowedConnections.targets.includes(
            connection.targetHandle
          )
        ) {
          return false;
        }
        return true;
      }

      // ifelse 节点的特殊处理
      if (sourceType === "ifelse") {
        // 验证源连接点是否是有效的 case_id
        const sourceCase = (sourceNode.data as IfElseNodeData).cases.find(
          (c: { case_id: string }) => c.case_id === connection.sourceHandle
        );
        if (!sourceCase) return false;

        // 验证目标节点的连接点
        if (
          connection.targetHandle &&
          !nodeConfig[targetType].allowedConnections.targets.includes(
            connection.targetHandle
          )
        ) {
          return false;
        }
        return true;
      }

      // 目标节点是分类器的情况
      if (targetType === "classifier") {
        // 分类器只允许从左侧连入
        if (connection.targetHandle !== "input") return false;

        // 验证源节点的连接点
        if (
          connection.sourceHandle &&
          !nodeConfig[sourceType].allowedConnections.sources.includes(
            connection.sourceHandle
          )
        ) {
          return false;
        }
        return true;
      }

      // 目标节点是 ifelse 的情况
      if (targetType === "ifelse") {
        // ifelse 只允许从左侧连入
        if (connection.targetHandle !== "left") return false;

        // 验证源节点的连接点
        if (
          connection.sourceHandle &&
          !nodeConfig[sourceType].allowedConnections.sources.includes(
            connection.sourceHandle
          )
        ) {
          return false;
        }
        return true;
      }

      // 其他节点类型的常规验证
      const sourceAllowedConnections =
        nodeConfig[sourceType].allowedConnections;
      const targetAllowedConnections =
        nodeConfig[targetType].allowedConnections;

      // 检查源节点是否允许从指定的 handle 连出
      if (
        connection.sourceHandle &&
        !sourceAllowedConnections.sources.includes(connection.sourceHandle)
      ) {
        return false;
      }

      // 检查目标节点是否允许从指定的 handle 连入
      if (
        connection.targetHandle &&
        !targetAllowedConnections.targets.includes(connection.targetHandle)
      ) {
        return false;
      }

      return true;
    },
    [nodes, edges]
  );

  const toggleEdgeType = useCallback(
    (edge: Edge) => {
      setEdges((eds) =>
        eds.map((e) => {
          if (e.id === edge.id) {
            const newType = e.type === "default" ? "smoothstep" : "default";
            return {
              ...e,
              type: newType,
            };
          }
          return e;
        })
      );
    },
    [setEdges]
  );

  const onEdgeContextMenu = useCallback(
    (event: React.MouseEvent, edge: Edge) => {
      event.preventDefault();
      toggleEdgeType(edge);
    },
    [toggleEdgeType]
  );

  const onKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === "e" || event.key === "E") {
        const selectedEdges = edges.filter((e) => e.selected);
        selectedEdges.forEach(toggleEdgeType);
      }
    },
    [edges, toggleEdgeType]
  );

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const generateUniqueName = useCallback(
    (baseLabel: string) => {
      const existingNames = nodes.map((node) => node.data.label);
      let counter = 1;
      let newName = baseLabel;

      while (existingNames.includes(newName)) {
        counter++;
        newName = `${baseLabel}${counter}`;
      }

      return newName;
    },
    [nodes]
  );

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const data = event.dataTransfer.getData("application/reactflow");

      if (!data) return;

      const { tool, type } = JSON.parse(data); // 解析工具数据和类型
      const position = reactFlowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      let newNode: CustomNode;

      if (type !== "plugin") {
        const baseLabel = `${nodeConfig[type].display}`;
        const uniqueName = generateUniqueName(baseLabel);

        newNode = {
          id: `${type}-${nodes.length + 1}`,
          type: type,
          position,
          data: {
            label: uniqueName, // 使用生成的唯一名称
            customName: uniqueName,
            onChange: (key: string, value: any) =>
              onNodeDataChange(`${type}-${nodes.length + 1}`, key, value),
            ...nodeConfig[type].initialData,
          },
        };
      } else {
        // 处理其他类型的节点（如 tools）
        newNode = {
          id: `${tool.display_name}-${nodes.length + 1}`, // 确保每个插件节点唯一
          type: "plugin",
          position,
          data: {
            label: tool.display_name,
            toolName: tool.display_name,
            args: {},
            ...tool.initialData,
          },
        };
      }

      setNodes((nds) => nds.concat(newNode));
    },
    [nodes, reactFlowInstance, setNodes, generateUniqueName, onNodeDataChange]
  );
  const closePropertiesPanel = useCallback(() => {
    setSelectedNodeId(null);
  }, [setSelectedNodeId]);

  const deleteNode = useCallback(() => {
    if (contextMenu.nodeId) {
      const nodeToDelete = nodes.find((node) => node.id === contextMenu.nodeId);

      if (
        nodeToDelete &&
        (nodeToDelete.type === "start" || nodeToDelete.type === "end")
      ) {
        toast({
          title: t("workflow.flowVisualizer.contextMenu.error.title"),
          description: t(
            "workflow.flowVisualizer.contextMenu.error.description",
            {
              type:
                nodeToDelete.type.charAt(0).toUpperCase() +
                nodeToDelete.type.slice(1),
            }
          ),
          status: "warning",
          duration: 3000,
          isClosable: true,
        });
        closeContextMenu();
        return;
      }
      setNodes((nds) => nds.filter((node) => node.id !== contextMenu.nodeId));
      setEdges((eds) =>
        eds.filter(
          (edge) =>
            edge.source !== contextMenu.nodeId &&
            edge.target !== contextMenu.nodeId
        )
      );
    }
    closeContextMenu();
    closePropertiesPanel();
  }, [
    contextMenu.nodeId,
    nodes,
    setNodes,
    setEdges,
    closeContextMenu,
    closePropertiesPanel,
    toast,
    t,
  ]);

  const {
    id: graphId,
    name: graphName,
    description: graphDescription,
  } = graphData?.data[0] || {};

  const { onSave, isLoading: isSaving } = useGraphConfig(
    teamId,
    graphId,
    graphName,
    graphDescription,
    nodes,
    edges
  );

  const memoizedNodeTypes = useMemo(
    () => ({
      ...nodeTypes,
    }),
    [nodeTypes]
  );
  const memoizedDefaultEdgeOptions = useMemo(
    () => defaultEdgeOptions,
    [defaultEdgeOptions]
  );
  const { zoom } = useViewport();

  const [isShortcutPanelVisible, setShortcutPanelVisible] = useState(false);

  const toggleShortcutPanel = () => {
    setShortcutPanelVisible((prev) => !prev);
  };

  const hideShortcutPanel = () => {
    setShortcutPanelVisible(false);
  };

  const [showDebugPreview, setShowDebugPreview] = useState(false);

  const [showNodeMenu, setShowNodeMenu] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });

  const onEdgeClick = useCallback(
    (event: React.MouseEvent, edge: Edge) => {
      event.stopPropagation();
      setSelectedEdge(edge);

      const sourceNode = nodes.find((node) => node.id === edge.source);
      const targetNode = nodes.find((node) => node.id === edge.target);

      if (sourceNode && targetNode) {
        const centerPoint = calculateEdgeCenter(sourceNode, targetNode);

        // 调整菜单位置，确保不会超出视口
        const viewportHeight = window.innerHeight;
        const menuHeight = 400; // SharedNodeMenu 的最大高度
        const yPosition = Math.min(
          centerPoint.y,
          viewportHeight - menuHeight - 20
        ); // 20px 作为底部边距

        setMenuPosition({ x: centerPoint.x, y: yPosition });
      }
    },
    [nodes]
  );

  const handleAddNodeClick = useCallback((event: React.MouseEvent) => {
    event.stopPropagation();
    setShowNodeMenu(true);
  }, []);

  const addNodeToEdge = useCallback(
    (nodeType: NodeType | string, tool?: any) => {
      if (!selectedEdge) return;

      const sourceNode = nodes.find((node) => node.id === selectedEdge.source);
      const targetNode = nodes.find((node) => node.id === selectedEdge.target);

      if (!sourceNode || !targetNode) return;

      const nodeSpacing = 300; // 节点之间的固定距离

      // 计新节点的位置（在源节点和目标节点之间）
      const newNodeX = (sourceNode.position.x + targetNode.position.x) / 2;
      const newNodeY = (sourceNode.position.y + targetNode.position.y) / 2;

      let newNode: CustomNode;

      if (nodeType === "plugin") {
        newNode = {
          id: `${tool.display_name}-${nodes.length + 1}`,
          type: "plugin",
          position: { x: newNodeX, y: newNodeY },
          data: {
            label: tool.display_name,
            toolName: tool.display_name,
            args: {},
            ...tool.initialData,
          },
        };
      } else {
        const newNodeId = `${nodeType}-${nodes.length + 1}`;

        newNode = {
          id: newNodeId,
          type: nodeType as NodeType,
          position: { x: newNodeX, y: newNodeY },
          data: {
            label: generateUniqueName(nodeConfig[nodeType as NodeType].display),
            customName: generateUniqueName(
              nodeConfig[nodeType as NodeType].display
            ),
            onChange: (key: string, value: any) =>
              onNodeDataChange(newNodeId, key, value),
            ...nodeConfig[nodeType as NodeType].initialData,
          },
        };
      }

      // 更新节点
      setNodes((nds) => {
        // 对节点按 x 坐标排序
        const sortedNodes = [...nds].sort(
          (a, b) => a.position.x - b.position.x
        );

        // 找到节点应该插入的位置
        const insertIndex = sortedNodes.findIndex(
          (node) => node.position.x > newNodeX
        );

        // 插入新节点
        sortedNodes.splice(insertIndex, 0, newNode);

        // 重新计算所有节点的位置
        return sortedNodes.map((node, index) => ({
          ...node,
          position: {
            x: index * nodeSpacing,
            y: node.position.y,
          },
        }));
      });

      // 更新边
      const newEdge1: Edge = {
        id: `e${selectedEdge.source}-${newNode.id}`,
        source: selectedEdge.source,
        target: newNode.id,
        sourceHandle: "right",
        targetHandle: "left",
        type: selectedEdge.type,
      };

      const newEdge2: Edge = {
        id: `e${newNode.id}-${selectedEdge.target}`,
        source: newNode.id,
        target: selectedEdge.target,
        sourceHandle: "right",
        targetHandle: "left",
        type: selectedEdge.type,
      };

      setEdges((eds) =>
        eds.filter((e) => e.id !== selectedEdge.id).concat(newEdge1, newEdge2)
      );
      setSelectedEdge(null);
      setShowNodeMenu(false);
    },
    [
      selectedEdge,
      nodes,
      setNodes,
      setEdges,
      onNodeDataChange,
      generateUniqueName,
    ]
  );

  const onPaneClick = useCallback(() => {
    setSelectedEdge(null);
    setShowNodeMenu(false);
    setSelectedNodeId(null); // 取消选中的节点
  }, [setSelectedNodeId]);

  const edgesWithStyles = useMemo(() => {
    return edges?.map((edge) => {
      const sourceNode = nodes.find((n) => n.id === edge.source);
      const isClassifierEdge = sourceNode?.type === "classifier";

      // 分类器节点的边默认为虚线类型
      if (isClassifierEdge && edge.type === undefined) {
        edge.type = "smoothstep";
      }

      return {
        ...edge,
        style: {
          ...edge.style,
          strokeWidth: 2,
          strokeDasharray: edge.type === "smoothstep" ? "5,5" : undefined,
          stroke:
            edge.source === activeNodeName || edge.target === activeNodeName
              ? "#38a169"
              : edge.type === "default"
                ? "#5e5a6a"
                : "#517359",
        },
      };
    });
  }, [edges, activeNodeName, nodes]);

  const [showMiniMap, setShowMiniMap] = useState(false);

  const handleAutoLayout = useCallback(() => {
    const layoutedNodes = getLayoutedElements(nodes, edges, {
      nodeWidth: 200,
      nodeHeight: 100,
      rankSpacing: 80,
      nodeSpacing: 20,
    });

    // 添加节点移动的 CSS 动画
    const style = document.createElement("style");
    style.textContent = `
      .react-flow__node-animated {
        transition: all 0.5s ease-in-out;
      }
    `;
    document.head.appendChild(style);

    // 更新节点位置
    setNodes(layoutedNodes);

    // 重置视图以适应新布局
    setTimeout(() => {
      reactFlowInstance.fitView({ padding: 0.2 });
      // 清除动画类
      document.head.removeChild(style);
      setNodes((nodes) =>
        nodes.map((node) => ({
          ...node,
          className: node.className?.replace("react-flow__node-animated", ""),
        }))
      );
    }, 500);
  }, [nodes, edges, reactFlowInstance, setNodes]);

  return (
    <Box
      display="flex"
      h="100%"
      maxH="full"
      bg="ui.bgMain"
      border="1px solid"
      borderColor="gray.100"
      borderRadius="xl"
      boxShadow="lg"
      onKeyDown={onKeyDown}
      tabIndex={0}
      overflow="hidden"
      position="relative"
    >
      {/* 节点面板 */}
      <Box
        h="full"
        maxH="full"
        borderRight="1px solid"
        borderColor="gray.100"
        bg="white"
        transition="all 0.2s"
      >
        <NodePalette />
      </Box>

      {/* Flow 区域 */}
      <Box flex={1} position="relative" bg="gray.50" transition="all 0.2s">
        <ReactFlow
          onNodeClick={onNodeClick}
          nodes={nodesWithSelection}
          edges={edgesWithStyles}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          isValidConnection={isValidConnection}
          onEdgeContextMenu={onEdgeContextMenu}
          onNodeContextMenu={onNodeContextMenu}
          nodeTypes={memoizedNodeTypes}
          defaultEdgeOptions={{
            ...memoizedDefaultEdgeOptions,
            markerEnd: {
              type: MarkerType.ArrowClosed,
              width: 20,
              height: 20,
              color: "ui.main",
            },
            style: {
              strokeWidth: 2,
              transition: "all 0.2s",
            },
          }}
          connectionLineType={ConnectionLineType.SmoothStep}
          onDragOver={onDragOver}
          onDrop={onDrop}
          deleteKeyCode={["Backspace", "Delete"]}
          onEdgeClick={onEdgeClick}
          onPaneClick={onPaneClick}
        >
          <Controls
            className="react-flow__controls-custom"
            style={{
              backgroundColor: "white",
              borderRadius: "12px",
              padding: "4px",
              boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
            }}
          />
          <Background gap={16} style={{ background: "ui.bgMain" }} />

          {showMiniMap && (
            <MiniMap
              style={{
                backgroundColor: "white",
                borderRadius: "12px",
                boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
              }}
            />
          )}
          {/* 迷你地图按钮 */}
          <Panel
            position="bottom-left"
            style={{
              background: "white",
              borderRadius: "12px",
              padding: "2px",
              boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
              marginLeft: "7rem",
              marginBottom: "1rem",
            }}
          >
            <Tooltip
              label={
                showMiniMap
                  ? t("workflow.flowVisualizer.tooltips.hideMinimap")
                  : t("workflow.flowVisualizer.tooltips.showMinimap")
              }
              placement="top"
              hasArrow
            >
              <IconButton
                aria-label="Toggle minimap"
                icon={showMiniMap ? <FiEyeOff /> : <FiEye />}
                size="sm"
                variant="ghost"
                colorScheme="gray"
                onClick={() => setShowMiniMap(!showMiniMap)}
                transition="all 0.2s"
                _hover={{
                  bg: "gray.100",
                  transform: "scale(1.1)",
                }}
                _active={{
                  transform: "scale(0.95)",
                }}
              />
            </Tooltip>
          </Panel>

          <EdgeLabelRenderer>
            {selectedEdge && (
              <div
                style={{
                  position: "absolute",
                  transform: `translate(-50%, -50%) translate(${menuPosition.x}px, ${menuPosition.y}px)`,
                  pointerEvents: "all",
                  zIndex: 1000,
                }}
              >
                <IconButton
                  aria-label="Add node"
                  icon={<FaPlus />}
                  size="sm"
                  colorScheme="blue"
                  onClick={handleAddNodeClick}
                  isRound
                  bg="ui.main"
                  color="white"
                  _hover={{
                    transform: "scale(1.1)",
                    bg: "blue.500",
                  }}
                  _active={{
                    transform: "scale(0.95)",
                    bg: "blue.600",
                  }}
                  transition="all 0.2s"
                />
              </div>
            )}
          </EdgeLabelRenderer>

          {/* 帮助面板 */}
          <Panel
            position="top-left"
            style={{
              background: "white",
              borderRadius: "12px",
              padding: "2px",
              boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
              marginLeft: "1rem",
              marginTop: "0.5rem",
            }}
          >
            <Tooltip
              label={t("workflow.flowVisualizer.tooltips.help")}
              placement="right"
              hasArrow
            >
              <IconButton
                aria-label="Help"
                icon={<MdOutlineHelp />}
                size="sm"
                onMouseEnter={toggleShortcutPanel}
                onMouseLeave={hideShortcutPanel}
                cursor="pointer"
                color="gray.600"
                colorScheme="gray"
                fontSize="24px"
                transition="all 0.2s"
                _hover={{
                  color: "ui.main",
                  transform: "scale(1.1)",
                }}
              />
            </Tooltip>
            {isShortcutPanelVisible && (
              <Box
                position="absolute"
                top="100%"
                left="0"
                mt={2}
                bg="white"
                p={4}
                borderRadius="xl"
                boxShadow="lg"
                border="1px solid"
                borderColor="gray.100"
                fontSize="sm"
                color="gray.700"
                zIndex={1000}
                backdropFilter="blur(8px)"
                transition="all 0.2s"
              >
                <Text fontWeight="600" mb={2}>
                  {t("workflow.flowVisualizer.shortcuts.title")}:
                </Text>
                <HStack mb={2}>
                  <Text>
                    {t("workflow.flowVisualizer.shortcuts.edgeType")}:
                  </Text>
                  <Kbd bg="gray.100" color="gray.700">
                    {t("E")}
                  </Kbd>
                </HStack>
                <HStack mb={3}>
                  <Text>{t("workflow.flowVisualizer.shortcuts.delete")}:</Text>
                  <Kbd bg="gray.100" color="gray.700">
                    Backspace
                  </Kbd>
                  <Kbd bg="gray.100" color="gray.700">
                    Delete
                  </Kbd>
                </HStack>
                <Text fontWeight="600" mb={2}>
                  {t("workflow.flowVisualizer.shortcuts.info.title")}:
                </Text>
                <Text mb={1}>
                  {t("workflow.flowVisualizer.shortcuts.info.solidLine")}
                </Text>
                <Text>
                  {t("workflow.flowVisualizer.shortcuts.info.dashedLine")}
                </Text>
              </Box>
            )}
          </Panel>

          {/* Zoom 显示 */}
          <Panel
            position="bottom-left"
            style={{
              background: "white",
              borderRadius: "12px",
              padding: "8px 12px",
              boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
              fontSize: "14px",
              color: "gray.600",
              marginLeft: "10rem",
              marginBottom: "1rem",
            }}
          >
            {t("workflow.flowVisualizer.zoom")}: {Math.round(zoom * 100)}%
          </Panel>

          {/* 自动布局按钮 */}
          <Panel
            position="bottom-left"
            style={{
              background: "white",
              borderRadius: "12px",
              padding: "2px",
              boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
              marginLeft: "4rem",
              marginBottom: "1rem",
            }}
          >
            <Tooltip
              label={t("workflow.flowVisualizer.tooltips.autoLayout")}
              placement="top"
              hasArrow
            >
              <IconButton
                aria-label="Auto layout"
                icon={<FaGripHorizontal />}
                size="sm"
                variant="ghost"
                colorScheme="gray"
                onClick={handleAutoLayout}
                transition="all 0.2s"
                _hover={{
                  bg: "gray.100",
                  transform: "scale(1.1)",
                }}
                _active={{
                  transform: "scale(0.95)",
                }}
              />
            </Tooltip>
          </Panel>
        </ReactFlow>

        {/* 顶部按钮组 */}
        <Box
          position="absolute"
          right={6}
          top={4}
          display="flex"
          alignItems="center"
          gap={3}
          backdropFilter="blur(8px)"
          bg="white"
          p={2}
          borderRadius="xl"
          boxShadow="lg"
          border="1px solid"
          borderColor="gray.100"
        >
          <CustomButton
            text={t("workflow.flowVisualizer.actions.debug")}
            variant="white"
            rightIcon={<VscDebugAlt />}
            onClick={() => setShowDebugPreview(true)}
          />
          <ApiKeyButton teamId={teamId.toString()} />
          <CustomButton
            text={t("workflow.flowVisualizer.actions.deploy")}
            variant="blue"
            rightIcon={<MdBuild />}
            onClick={onSave}
            isLoading={isSaving}
            loadingText={t("workflow.flowVisualizer.actions.saving")}
          />
        </Box>
      </Box>

      {/* 属性面板 */}
      {selectedNodeId && (
        <Box
          w={selectedNode?.type === "code" || selectedNode?.type === "ifelse" ? "450px" : "330px"}
          minW={selectedNode?.type === "code" || selectedNode?.type === "ifelse" ? "450px" : "330px"}
          maxW={selectedNode?.type === "code" || selectedNode?.type === "ifelse" ? "450px" : "330px"}
          bg="white"
          p={6}
          borderRadius="xl"
          boxShadow="lg"
          border="1px solid"
          borderColor="gray.100"
          mr={2}
          my={2}
          position="relative"
          transition="all 0.2s"
          maxH="calc(100vh - 64px)"
          overflowY="auto"
        >
          <CloseButton
            onClick={closePropertiesPanel}
            position="absolute"
            right={4}
            top={4}
            size="md"
            borderRadius="full"
            transition="all 0.2s"
            _hover={{
              bg: "gray.100",
              transform: "rotate(90deg)",
            }}
          />
          {getNodePropertiesComponent(
            nodes.find((n) => n.id === selectedNodeId) || null
          )}
        </Box>
      )}

      {/* Debug 预览面板 */}
      {showDebugPreview && (
        <Box
          w="350px"
          h="calc(100% - 16px)"
          bg="white"
          borderRadius="xl"
          boxShadow="lg"
          border="1px solid"
          borderColor="gray.100"
          overflow="hidden"
          my={2}
          mr={2}
          position="relative"
          transition="all 0.2s"
        >
          <CloseButton
            onClick={() => setShowDebugPreview(false)}
            position="absolute"
            right={4}
            top={4}
            size="md"
            zIndex={1}
            borderRadius="full"
            transition="all 0.2s"
            _hover={{
              bg: "gray.100",
              transform: "rotate(90deg)",
            }}
          />
          <Box h="full" overflow="hidden">
            <DebugPreview
              teamId={teamId}
              triggerSubmit={() => {}}
              useDeployButton={false}
              useApiKeyButton={false}
              isWorkflow={true}
              showHistoryButton={false}
              onClose={() => setShowDebugPreview(false)}
            />
          </Box>
        </Box>
      )}

      {/* 节点菜单 */}
      {showNodeMenu && (
        <Box
          position="fixed"
          left={`${menuPosition.x}px`}
          top={`${menuPosition.y}px`}
          zIndex={1000}
          maxH="full"
          overflowY="auto"
          bg="white"
          borderRadius="xl"
          boxShadow="lg"
          border="1px solid"
          borderColor="gray.100"
          transition="all 0.2s"
        >
          <SharedNodeMenu onNodeSelect={addNodeToEdge} isDraggable={false} />
        </Box>
      )}

      {/* 上下文菜单 */}
      {contextMenu.nodeId && (
        <Menu isOpen={true} onClose={closeContextMenu}>
          <MenuButton as={Button} style={{ display: "none" }} />
          <MenuList
            style={{
              position: "absolute",
              left: `${contextMenu.x}px`,
              top: `${contextMenu.y}px`,
            }}
            bg="white"
            borderRadius="xl"
            boxShadow="lg"
            border="1px solid"
            borderColor="gray.100"
            p={2}
          >
            <MenuItem
              onClick={deleteNode}
              borderRadius="lg"
              transition="all 0.2s"
              _hover={{
                bg: "red.50",
                color: "red.500",
              }}
            >
              Delete Node
            </MenuItem>
          </MenuList>
        </Menu>
      )}
    </Box>
  );
};

export default FlowVisualizer;
