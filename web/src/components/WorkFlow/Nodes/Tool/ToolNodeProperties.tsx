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
import { useState } from "react";
import { FaTools } from "react-icons/fa";

import ToolsIcon from "@/components/Icons/Tools";
import { useSkillsQuery } from "@/hooks/useSkillsQuery";

import ToolsList from "./ToolsListModal";

interface ToolNodePropertiesProps {
  node: any;
  onNodeDataChange: (nodeId: string, key: string, value: any) => void;
}

const ToolNodeProperties: React.FC<ToolNodePropertiesProps> = ({
  node,
  onNodeDataChange,
}) => {
  const [isToolsListOpen, setIsToolsListOpen] = useState(false);
  const { data: skills, isLoading, isError } = useSkillsQuery();

  const addTool = (tool: string) => {
    const currentTools = node.data.tools || [];
    if (!currentTools.includes(tool)) {
      onNodeDataChange(node.id, "tools", [...currentTools, tool]);
    }
  };

  const removeTool = (tool: string) => {
    const currentTools = node.data.tools || [];
    onNodeDataChange(
      node.id,
      "tools",
      currentTools.filter((t: string) => t !== tool)
    );
  };

  if (isLoading) return <Text>Loading skills...</Text>;
  if (isError) return <Text>Error loading skills</Text>;

  return (
    <VStack align="stretch" spacing={4}>
      <Box>
        <HStack justify="space-between" align="center" mb={3}>
          <HStack spacing={2}>
            <FaTools size="14px" color="#4A5568" />
            <Text fontSize="md" fontWeight="600" color="gray.700">
              Tools
            </Text>
            <Text fontSize="xs" color="gray.500">
              ({node.data.tools?.length || 0})
            </Text>
          </HStack>
          <Button
            size="xs"
            variant="ghost"
            leftIcon={<FaTools size="12px" />}
            onClick={() => setIsToolsListOpen(true)}
            colorScheme="blue"
          >
            Add Tool
          </Button>
        </HStack>

        <VStack align="stretch" spacing={2}>
          {node.data.tools?.map((tool: string) => (
            <Box
              key={tool}
              p={2}
              bg="gray.50"
              borderRadius="md"
              borderLeft="3px solid"
              borderLeftColor="blue.400"
              transition="all 0.2s"
              _hover={{
                bg: "gray.100",
                borderLeftColor: "blue.500",
              }}
            >
              <HStack justify="space-between" align="center">
                <HStack spacing={2}>
                  <ToolsIcon tools_name={tool.replace(/ /g, "_")} />
                  <Text fontSize="sm" fontWeight="500">
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
      </Box>

      {isToolsListOpen && (
        <ToolsList
          skills={skills?.data || []}
          onClose={() => setIsToolsListOpen(false)}
          onAddTool={addTool}
          selectedTools={node.data.tools || []}
        />
      )}
    </VStack>
  );
};

export default ToolNodeProperties;
