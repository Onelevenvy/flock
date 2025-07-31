import {
  Box,
  Tab,
  TabList,
  TabPanel,
  TabPanels,
  Tabs,
  Text,
  VStack,
  HStack,
  IconButton,
  Accordion,
  AccordionItem,
  AccordionButton,
  AccordionPanel,
  AccordionIcon,
  Tooltip,
} from "@chakra-ui/react";
import React, { useState } from "react";
import { useTranslation } from "react-i18next";

import { useToolProvidersQuery } from "@/hooks/useToolProvidersQuery";
import { useSubgraphsQuery } from "@/hooks/useSubgraphsQuery";
import ToolsIcon from "../../Icons/Tools";
import { nodeConfig, type NodeType } from "../Nodes/nodeConfig";

interface SharedNodeMenuProps {
  onNodeSelect: (nodeType: NodeType | string, tool?: any) => void;
  isDraggable?: boolean;
}

const SharedNodeMenu: React.FC<SharedNodeMenuProps> = ({
  onNodeSelect,
  isDraggable = false,
}) => {
  const { t } = useTranslation();
  const { data: tools, isLoading, isError } = useToolProvidersQuery();
  const {
    data: subgraphs,
    isLoading: isSubgraphsLoading,
    isError: isSubgraphsError,
  } = useSubgraphsQuery();
  const [expandedProviders, setExpandedProviders] = useState<Record<number, boolean>>({});

  const handleNodeInteraction =
    (nodeType: NodeType | string, tool?: any) =>
      (event: React.MouseEvent | React.DragEvent) => {
        if (isDraggable && event.type === "dragstart") {
          const dragEvent = event as React.DragEvent;
          dragEvent.dataTransfer.setData(
            "application/reactflow",
            JSON.stringify({
              tool:
                nodeType === "subgraph"
                  ? {
                    name: tool.name,
                    id: tool.id,
                    description: tool.description,
                  }
                  : nodeType === "plugin"
                    ? tool
                    : nodeType,
              type: nodeType,
            }),
          );
          dragEvent.dataTransfer.effectAllowed = "move";
        } else if (!isDraggable) {
          onNodeSelect(nodeType, tool);
        }
      };

  return (
    <Box
      width="200px"
      bg="white"
      h="full"
      maxH="full"
      overflow="hidden"
      display="flex"
      flexDirection="column"
    >
      <Tabs
        isLazy
        variant="soft-rounded"
        colorScheme="blue"
        display="flex"
        flexDirection="column"
        h="full"
        maxH="full"
        overflow="hidden"
      >
        <TabList mb={0} bg="white" p={2}>
          <Tab
            _selected={{
              bg: "blue.50",
              color: "blue.600",
              fontWeight: "500",
            }}
            transition="all 0.2s"
          >
            {t("workflow.nodeMenu.title")}
          </Tab>
          <Tab
            _selected={{
              bg: "blue.50",
              color: "blue.600",
              fontWeight: "500",
            }}
            transition="all 0.2s"
          >
            {t("workflow.nodeMenu.plugins")}
          </Tab>
        </TabList>

        <TabPanels overflowY="auto" overflowX="hidden">
          <TabPanel p={2}>
            <VStack spacing={2} align="stretch">
              {Object.entries(nodeConfig).map(
                ([nodeType, { display, icon: Icon, colorScheme }]) =>
                  nodeType !== "plugin" &&
                  nodeType !== "start" &&
                  nodeType !== "end" &&
                  nodeType !== "subgraph" && (
                    <Box
                      key={nodeType}
                      border="1px solid"
                      borderColor="gray.200"
                      borderRadius="lg"
                      px={3}
                      py={2}
                      cursor={isDraggable ? "move" : "pointer"}
                      onClick={
                        !isDraggable
                          ? handleNodeInteraction(nodeType as NodeType)
                          : undefined
                      }
                      onDragStart={
                        isDraggable
                          ? handleNodeInteraction(nodeType as NodeType)
                          : undefined
                      }
                      draggable={isDraggable}
                      transition="all 0.2s"
                      _hover={{
                        bg: "gray.50",
                        transform: "translateY(-1px)",
                        boxShadow: "sm",
                        borderColor: "gray.300",
                      }}
                      _active={{
                        transform: "translateY(0)",
                      }}
                    >
                      <HStack spacing={5} overflow="hidden">
                        <IconButton
                          aria-label={display}
                          icon={<Icon />}
                          colorScheme={colorScheme}
                          size="sm"
                          variant="ghost"
                          bg={`${colorScheme}.50`}
                          color={`${colorScheme}.500`}
                          flexShrink={0}
                        />
                        <Text
                          fontSize="xs"
                          fontWeight="500"
                          color="gray.700"
                          noOfLines={1}
                          overflow="hidden"
                          textOverflow="ellipsis"
                          whiteSpace="nowrap"
                          title={display}
                        >
                          {display}
                        </Text>
                      </HStack>
                    </Box>
                  ),
              )}
            </VStack>
          </TabPanel>

          <TabPanel p={2}>
            <VStack spacing={4} align="stretch" maxH="full">
              <Box>
                <Text fontSize="sm" fontWeight="500" color="gray.600" mb={2}>
                  {t("workflow.nodeMenu.tools")}
                </Text>
                <VStack spacing={2} align="stretch">
                  {isLoading ? (
                    <Text color="gray.600">
                      {t("workflow.nodeMenu.loading")}
                    </Text>
                  ) : isError ? (
                    <Text color="red.500">{t("workflow.nodeMenu.error")}</Text>
                  ) : (
                    <Accordion allowMultiple>
                      {tools?.providers.map((provider) => (
                        <AccordionItem key={provider.id} border="none">
                          <AccordionButton
                            py={2}
                            _hover={{ bg: 'gray.50' }}
                            onClick={(e) => {
                              e.stopPropagation();
                              setExpandedProviders(prev => ({
                                ...prev,
                                [provider.id]: !prev[provider.id]
                              }));
                            }}
                          >
                            <Box flex="1" textAlign="left">
                              <HStack>
                                {provider.icon && (
                                  <Box w="5" h="5" borderRadius="md" bg="primary.100" display="flex" alignItems="center" justifyContent="center">
                                    <ToolsIcon
                                      h="6"
                                      w="6"
                                      tools_name={(provider.icon || provider.provider_name!)}
                                      color={`${provider.tool_type === 'builtin' ? "blue" : "purple"}.500`}
                                    />
                                  </Box>
                                )}
                                <Text fontSize="xs" fontWeight="500" >
                                  {provider.display_name || provider.provider_name}
                                </Text>
                              </HStack>
                            </Box>
                            <AccordionIcon />
                          </AccordionButton>
                          <AccordionPanel pb={2}>
                            <VStack spacing={2} align="stretch">
                              {provider.tools.map((tool) => {
                                const isOnline = tool.is_online !== undefined && tool.is_online !== null ? tool.is_online : true;
                                return (
                                  <Tooltip
                                    key={tool.id}
                                    label={!isOnline ? "工具离线不可用" : tool.description}
                                    placement="right"
                                    isDisabled={!tool.description && isOnline}
                                  >
                                    <Box
                                      p={2}
                                      borderRadius="md"
                                      cursor={isOnline && !isDraggable ? "pointer" : isDraggable ? "move" : "not-allowed"}
                                      draggable={isDraggable && isOnline}
                                      transition="all 0.2s"
                                      onClick={(event) => {
                                        if (isOnline && !isDraggable) {
                                          event.stopPropagation();
                                          handleNodeInteraction("plugin", tool)(event);
                                        }
                                      }}
                                      onDragStart={
                                        isDraggable && isOnline
                                          ? (event) => {
                                            event.stopPropagation();
                                            handleNodeInteraction("plugin", tool)(event);
                                          }
                                          : undefined
                                      }
                                      _hover={isOnline ? {
                                        bg: "gray.50",
                                        transform: "translateY(-1px)",
                                        boxShadow: "sm",
                                        borderColor: "gray.300",
                                      } : {}}
                                      _active={{
                                        transform: "translateY(0)",
                                      }}
                                    >
                                      <HStack spacing={3} overflow="hidden">

                                        <Text
                                          fontSize="xs"
                                          fontWeight="500"
                                          color={isOnline ? "gray.700" : "gray.400"}
                                          noOfLines={1}
                                          overflow="hidden"
                                          textOverflow="ellipsis"
                                          whiteSpace="nowrap"
                                          title={tool.display_name || tool.name}
                                        >
                                          {tool.display_name || tool.name}
                                        </Text>
                                      </HStack>
                                    </Box>
                                  </Tooltip>
                                );
                              })}
                            </VStack>
                          </AccordionPanel>
                        </AccordionItem>
                      ))}
                    </Accordion>
                  )}
                </VStack>
              </Box>

              <Box>
                <Text fontSize="sm" fontWeight="500" color="gray.600" mb={2}>
                  {t("workflow.nodeMenu.subgraphs")}
                </Text>
                <VStack spacing={2} align="stretch">
                  {isSubgraphsLoading ? (
                    <Text color="gray.600">
                      {t("workflow.nodeMenu.loading")}
                    </Text>
                  ) : isSubgraphsError ? (
                    <Text color="red.500">{t("workflow.nodeMenu.error")}</Text>
                  ) : subgraphs?.data && subgraphs.data.length > 0 ? (
                    subgraphs.data.map((subgraph) => (
                      <Box
                        key={subgraph.id}
                        border="1px solid"
                        borderColor="gray.200"
                        borderRadius="lg"
                        p={3}
                        cursor={isDraggable ? "move" : "pointer"}
                        onClick={
                          !isDraggable
                            ? handleNodeInteraction("subgraph", subgraph)
                            : undefined
                        }
                        onDragStart={
                          isDraggable
                            ? handleNodeInteraction("subgraph", subgraph)
                            : undefined
                        }
                        draggable={isDraggable}
                        transition="all 0.2s"
                        _hover={{
                          bg: "gray.50",
                          transform: "translateY(-1px)",
                          boxShadow: "sm",
                          borderColor: "gray.300",
                        }}
                        _active={{
                          transform: "translateY(0)",
                        }}
                      >
                        <HStack spacing={3} overflow="hidden">
                          <Box
                            as={IconButton}
                            borderRadius="lg"
                            bg="purple.50"
                            flexShrink={0}
                            size="sm"
                            aria-label="Subgraph"
                          >
                            <ToolsIcon
                              tools_name="workflow"
                              color="purple.500"
                              boxSize={4}
                            />
                          </Box>
                          <Text
                            fontSize="xs"
                            fontWeight="500"
                            color="gray.700"
                            noOfLines={1}
                            overflow="hidden"
                            textOverflow="ellipsis"
                            whiteSpace="nowrap"
                            title={subgraph.name}
                          >
                            {subgraph.name}
                          </Text>
                        </HStack>
                      </Box>
                    ))
                  ) : (
                    <Text color="gray.500" fontSize="sm">
                      {t("workflow.common.noResults")}
                    </Text>
                  )}
                </VStack>
              </Box>
            </VStack>
          </TabPanel>
        </TabPanels>
      </Tabs>
    </Box>
  );
};

export default SharedNodeMenu;
