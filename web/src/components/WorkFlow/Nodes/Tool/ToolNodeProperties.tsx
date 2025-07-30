import { DeleteIcon } from "@chakra-ui/icons";
import {
  Box,
  Button,
  Flex,
  HStack,
  IconButton,
  Text,
  VStack,
} from "@chakra-ui/react";
import type React from "react";
import { useTranslation } from "react-i18next";
import { FaTools } from "react-icons/fa";
import { useState } from 'react';

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
    const currentTools: any[] = node.data.tools || [];
    if (!currentTools.some((t) => t.id === tool.id)) {
      const provider = providers.find((p) =>
        p.tools.some((t) => t.id === tool.id)
      );
      const newTool = {
        id: tool.id,
        name: tool.display_name || tool.name,
        provider: provider?.provider_name || "Unknown",
      };
      onNodeDataChange(node.id, "tools", [...currentTools, newTool]);
    }
  };

  const removeTool = (toolId: number) => {
    const currentTools: any[] = node.data.tools || [];
    onNodeDataChange(
      node.id,
      "tools",
      currentTools.filter((t) => t.id !== toolId)
    );
  };

  const allTools: ToolOutIdWithAndName[] = providers.flatMap(
    (p) => p.tools || []
  );

  const selectedToolsObjects: ToolOutIdWithAndName[] = (
    node.data.tools || []
  )
    .map((t: any) => allTools.find((at) => at.id === t.id))
    .filter(Boolean) as ToolOutIdWithAndName[];

  const [isToolSelectorOpen, setIsToolSelectorOpen] = useState(false);

  if (isLoading) return <Text>Loading tools...</Text>;

  if (isError) return <Text>Error loading tools</Text>;

  if (!isLoading && providers.length === 0) {
    return <Text>{t("workflow.nodes.tool.noToolsAvailable")}</Text>;
  }

  return (
    <Box p={4}>
      <VStack spacing={4} align="stretch">
        <>
          <Flex justify="space-between" align="center" mb={2}>
            <Button
              size="xs"
              variant="ghost"
              leftIcon={<FaTools size="12px" />}
              colorScheme="blue"
              transition="all 0.2s"
              _hover={{
                transform: "translateY(-1px)",
              }}
              onClick={() => setIsToolSelectorOpen(true)}
            >
              {t("workflow.nodes.tool.addTool")}
            </Button>
            <HStack spacing={2}>
              <Text fontSize="sm" fontWeight="500" color="gray.700">
                {t("workflow.nodes.tool.title")}
              </Text>
              <Text fontSize="xs" color="gray.500">
                ({node.data.tools?.length || 0})
              </Text>
            </HStack>
          </Flex>
          <ToolSelector
            isOpen={isToolSelectorOpen}
            onClose={() => setIsToolSelectorOpen(false)}
            providers={providers}
            selectedTools={selectedToolsObjects}
            onSelect={addTool}
            onDeselect={(tool) => removeTool(tool.id)}
          />
        </>

        <VStack spacing={2} align="stretch">
          {(node.data.tools || []).map((tool: any) => (
            <Box
              key={tool.id}
              p={2}
              borderWidth={1}
              borderRadius="md"
              bg="gray.50"
              _hover={{ bg: "gray.100" }}
            >
              <HStack justify="space-between" align="center">
                <HStack spacing={2}>
                  <ToolsIcon tools_name={tool.provider} />
                  <Text fontSize="sm" fontWeight="500" color="gray.700">
                    {tool.name}
                  </Text>
                </HStack>
                <IconButton
                  aria-label="Remove tool"
                  icon={<DeleteIcon />}
                  size="xs"
                  variant="ghost"
                  colorScheme="red"
                  onClick={() => removeTool(tool.id)}
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
