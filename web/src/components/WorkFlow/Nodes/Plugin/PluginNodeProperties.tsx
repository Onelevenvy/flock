import {
  Box,
  Text,
  VStack,
  Button,
} from "@chakra-ui/react";
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
    (key: string, value: string) => {
      onNodeDataChange(node.id, "args", {
        ...node.data.args,
        [key]: value,
      });
    },
    [node.id, node.data.args, onNodeDataChange]
  );

  const variableInsertionHooks: {
    [key: string]: ReturnType<typeof useVariableInsertion<HTMLTextAreaElement>>;
  } = {};

  if (tool?.input_parameters) {
    Object.keys(tool.input_parameters).forEach((key) => {
      // eslint-disable-next-line react-hooks/rules-of-hooks
      variableInsertionHooks[key] = useVariableInsertion<HTMLTextAreaElement>({
        onValueChange: (value) => handleInputChange(key, value),
        availableVariables,
      });
    });
  }

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
      <Text fontWeight="bold" mb={2}>Input Parameters:</Text>
      {tool?.input_parameters &&
        Object.entries(tool.input_parameters).map(([key]) => (
          <VariableSelector
            key={key}
            label={key}
            value={node.data.args[key] || ""}
            onChange={(value) => handleInputChange(key, value)}
            showVariables={variableInsertionHooks[key]?.showVariables}
            setShowVariables={variableInsertionHooks[key]?.setShowVariables}
            inputRef={variableInsertionHooks[key]?.inputRef}
            handleKeyDown={variableInsertionHooks[key]?.handleKeyDown}
            insertVariable={variableInsertionHooks[key]?.insertVariable}
            availableVariables={availableVariables}
          />
        ))}
      <Button onClick={handleInvoke} isLoading={loading}>
        Run Tool
      </Button>
    </VStack>
  );
};

export default PluginNodeProperties;