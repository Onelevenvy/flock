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
      borderRadius="xl"
      boxShadow="sm"
      h="full"
      minH="full"
      border="1px solid"
      borderColor="gray.100"
      overflow="hidden"
    >
      <Tabs isLazy variant="soft-rounded" colorScheme="blue">
        <TabList
          mb={4}
          position="sticky"
          top={0}
          bg="white"
          zIndex={1}
          p={2}
          borderBottom="1px solid"
          borderColor="gray.100"
        >
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

        <TabPanels>
          <TabPanel h="full" overflowY="auto" px={3} py={2} minH="400px">
            <VStack spacing={2} align="stretch">
              {Object.entries(nodeConfig).map(
                ([nodeType, { display, icon: Icon, colorScheme }]) =>
                  nodeType !== "plugin" &&
                  nodeType !== "start" &&
                  nodeType !== "end" && (
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

          <TabPanel h="full" overflowY="auto" px={3} py={2} minH="400px">
            <VStack spacing={2} align="stretch">
              {isLoading ? (
                <Text color="gray.600">{t("workflow.nodeMenu.loading")}</Text>
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
          </TabPanel>
        </TabPanels>
      </Tabs>
    </Box>
  );
};

export default SharedNodeMenu;
