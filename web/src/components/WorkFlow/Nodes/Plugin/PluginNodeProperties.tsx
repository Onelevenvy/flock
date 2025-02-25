import { Text, VStack, Button } from "@chakra-ui/react";
import type React from "react";
import { useCallback, useState } from "react";

import { ToolsService } from "@/client/services/ToolsService";
import { useVariableInsertion } from "@/hooks/graphs/useVariableInsertion";
import { useSkillsQuery } from "@/hooks/useSkillsQuery";
import { VariableReference } from "../../FlowVis/variableSystem";
import VariableSelector from "../../Common/VariableSelector";

interface PluginNodePropertiesProps {
  node: any;
  onNodeDataChange: (nodeId: string, key: string, value: any) => void;
  availableVariables: VariableReference[];
}

const PluginNodeProperties: React.FC<PluginNodePropertiesProps> = ({
  node,
  onNodeDataChange,
  availableVariables,
}) => {
  const { data: skills } = useSkillsQuery();
  const tool = skills?.data.find(
    (skill) => skill.display_name === node.data.toolName
  );
  const [loading, setLoading] = useState(false);

  const handleInputChange = useCallback(
    (value: string) => {
      onNodeDataChange(node.id, "args", value);
    },
    [node.id, onNodeDataChange]
  );

  const variableInsertionHook = useVariableInsertion<HTMLTextAreaElement>({
    onValueChange: handleInputChange,
    availableVariables,
  });

  const handleInvoke = async () => {
    setLoading(true);
    try {
      const response = await ToolsService.invokeTools({
        toolName: node.data.toolName,
        requestBody: node.data.args,
      });
      console.log("Invoke Result:", response);
    } catch (err) {
      console.error("Error invoking tool", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <VStack align="stretch" spacing={4}>
      <Text fontWeight="bold" mb={2} color="gray.700">
        Input Parameters:
      </Text>
      <VariableSelector
        label="Args"
        value={node.data.args || ""}
        onChange={handleInputChange}
        showVariables={variableInsertionHook.showVariables}
        setShowVariables={variableInsertionHook.setShowVariables}
        inputRef={variableInsertionHook.inputRef}
        handleKeyDown={variableInsertionHook.handleKeyDown}
        insertVariable={variableInsertionHook.insertVariable}
        availableVariables={availableVariables}
        minHeight="80px"
      />
      <Button
        onClick={handleInvoke}
        isLoading={loading}
        colorScheme="blue"
        size="md"
        borderRadius="lg"
        bg="ui.main"
        color="white"
        fontWeight="500"
        transition="all 0.2s"
        _hover={{
          bg: "blue.500",
          transform: "translateY(-1px)",
          boxShadow: "md",
        }}
        _active={{
          bg: "blue.600",
          transform: "translateY(0)",
        }}
      >
        Run Tool
      </Button>
    </VStack>
  );
};

export default PluginNodeProperties;
