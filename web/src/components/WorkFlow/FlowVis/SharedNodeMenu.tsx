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


import { useSkillsQuery } from "@/hooks/useSkillsQuery";

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
  const { data: tools, isLoading, isError } = useSkillsQuery();

  const handleNodeInteraction =
    (nodeType: NodeType | string, tool?: any) =>
    (event: React.MouseEvent | React.DragEvent) => {
      if (isDraggable && event.type === "dragstart") {
        const dragEvent = event as React.DragEvent;

        dragEvent.dataTransfer.setData(
          "application/reactflow",
          JSON.stringify({
            tool: nodeType === "plugin" ? tool : nodeType,
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
      borderRadius="md"
      boxShadow="md"
      h="full"
      minH="full"
    >
      <Tabs isLazy>
        <TabList mb="1em" position="sticky" top={0} bg="white" zIndex={1}>
          <Tab>Nodes</Tab>
          <Tab>Plugins</Tab>
        </TabList>
        <TabPanels>
          <TabPanel h="full" overflowY="auto" px={2} py={0} minH={"400px"}>
            <VStack spacing={2} align="stretch">
              {Object.entries(nodeConfig).map(
                ([nodeType, { display, icon: Icon, colorScheme }]) =>
                  nodeType !== "plugin" &&
                  nodeType !== "start" &&
                  nodeType !== "end" && (
                    <Box
                      key={nodeType}
                      border="1px solid #ddd"
                      borderRadius="md"
                      padding={2}
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
                      _hover={{ bg: "gray.100" }}
                    >
                      <IconButton
                        aria-label={display}
                        icon={<Icon />}
                        colorScheme={colorScheme}
                        size="xs"
                        mr={2}
                      />
                      <Text display="inline" fontSize="sm">
                        {display}
                      </Text>
                    </Box>
                  )
              )}
            </VStack>
          </TabPanel>
          <TabPanel h="full" overflowY="auto" px={2} py={0} minH={"400px"}>
            <VStack spacing={2} align="stretch">
              {isLoading ? (
                <Text>Loading tools...</Text>
              ) : isError ? (
                <Text>Error loading tools</Text>
              ) : (
                tools?.data.map((tool) => (
                  <Box
                    key={tool.display_name}
                    border="1px solid #ddd"
                    borderRadius="md"
                    p={2}
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
                    _hover={{ bg: "gray.100" }}
                  >
                    <HStack spacing="2">
                      <ToolsIcon
                        tools_name={tool.display_name!.replace(/ /g, "_")}
                      />
                      <Text fontSize="xs">{tool.display_name}</Text>
                    </HStack>
                  </Box>
                ))
              )}
            </VStack>
          </TabPanel>
        </TabPanels>
      </Tabs>
    </Box>
  );
};

export default SharedNodeMenu;