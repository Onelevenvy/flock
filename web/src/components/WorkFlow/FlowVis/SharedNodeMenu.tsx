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
} from "@chakra-ui/react";
import React from "react";
import { useTranslation } from "react-i18next";

import { useSkillsQuery } from "@/hooks/useSkillsQuery";
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
  const { data: tools, isLoading, isError } = useSkillsQuery();
  const {
    data: subgraphs,
    isLoading: isSubgraphsLoading,
    isError: isSubgraphsError,
  } = useSubgraphsQuery();

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
          })
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
                      p={3}
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
                      <HStack spacing={3} overflow="hidden">
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
                  )
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
                    tools?.data.map((tool) => (
                      <Box
                        key={tool.display_name}
                        border="1px solid"
                        borderColor="gray.200"
                        borderRadius="lg"
                        p={3}
                        cursor={isDraggable ? "move" : "pointer"}
                        onClick={
                          !isDraggable
                            ? handleNodeInteraction("plugin", tool)
                            : undefined
                        }
                        onDragStart={
                          isDraggable
                            ? handleNodeInteraction("plugin", tool)
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
                            bg="blue.50"
                            flexShrink={0}
                            size={"sm"}
                          >
                            <ToolsIcon
                              tools_name={tool.display_name!.replace(/ /g, "_")}
                              color="blue.500"
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
                            title={tool.display_name!}
                          >
                            {tool.display_name}
                          </Text>
                        </HStack>
                      </Box>
                    ))
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
