import { DeleteIcon } from "@chakra-ui/icons";
import {
  Box,
  Button,
  HStack,
  IconButton,
  Text,
  VStack,
} from "@chakra-ui/react";
import type React from "react";
import { useTranslation } from "react-i18next";
import { FaPlus } from "react-icons/fa";

import {
  ToolOutIdWithAndName,
  ToolProviderWithToolsListOut,
} from "@/client";
import ToolsIcon from "@/components/Icons/Tools";
import ToolSelector from "@/components/Members/ToolSelector";
import { useToolProvidersQuery } from "@/hooks/useToolProvidersQuery";

interface ToolNodePropertiesProps {
  node: any;
  onNodeDataChange: (nodeId: string, key: string, value: any) => void;
}

const ToolNodeProperties: React.FC<ToolNodePropertiesProps> = ({
  node,
  onNodeDataChange,
}) => {
  const { t } = useTranslation();
  const { data: providersData, isLoading, isError } = useToolProvidersQuery();

  const providers: ToolProviderWithToolsListOut[] = providersData?.providers || [];

  const addTool = (tool: ToolOutIdWithAndName) => {
    const toolName = tool.display_name || tool.name;
    const currentTools = node.data.tools || [];
    if (!currentTools.includes(toolName)) {
      onNodeDataChange(node.id, "tools", [...currentTools, toolName]);
    }
  };

  const removeTool = (toolName: string) => {
    const currentTools = node.data.tools || [];
    onNodeDataChange(
      node.id,
      "tools",
      currentTools.filter((t: string) => t !== toolName)
    );
  };

  const allTools: ToolOutIdWithAndName[] = providers.flatMap(
    (p) => p.tools || []
  );

  const selectedToolsObjects: ToolOutIdWithAndName[] = (node.data.tools || [])
    .map((toolName: string) =>
      allTools.find((t) => (t.display_name || t.name) === toolName)
    )
    .filter(Boolean) as ToolOutIdWithAndName[];

  if (isLoading) return <Text>Loading tools...</Text>;
  if (isError) return <Text>Error loading tools</Text>;

  if (!isLoading && providers.length === 0) {
    return <Text>{t("workflow.nodes.tool.noToolsAvailable")}</Text>;
  }

  return (
    <Box p={4}>
      <VStack spacing={4} align="stretch">
        <ToolSelector
          providers={providers}
          selectedTools={selectedToolsObjects}
          onSelect={addTool}
          onDeselect={(tool) => removeTool(tool.display_name || tool.name)}
        >
          <Button colorScheme="blue" size="sm" leftIcon={<FaPlus />}>
            {t("workflow.nodes.tool.addTool")}
          </Button>
        </ToolSelector>

        <VStack spacing={2} align="stretch">
          {node.data.tools?.map((tool: string) => (
            <Box
              key={tool}
              p={2}
              borderWidth={1}
              borderRadius="md"
              bg="gray.50"
              _hover={{ bg: "gray.100" }}
            >
              <HStack justify="space-between" align="center">
                <HStack spacing={2}>
                  <ToolsIcon tools_name={tool.replace(/ /g, "_")} />
                  <Text fontSize="sm" fontWeight="500" color="gray.700">
                    {tool}
                  </Text>
                </HStack>
                <IconButton
                  aria-label="Remove tool"
                  icon={<DeleteIcon />}
                  size="xs"
                  variant="ghost"
                  colorScheme="red"
                  onClick={() => removeTool(tool)}
                />
              </HStack>
            </Box>
          ))}
        </VStack>
      </VStack>
    </Box>
  );
};

export default ToolNodeProperties;
