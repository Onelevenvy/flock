import { Text, VStack } from "@chakra-ui/react";
import type React from "react";
import { useCallback, useState } from "react";

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

  // 添加一个函数来格式化输入参数
  const formatInputSchema = useCallback(() => {
    if (!tool?.input_parameters) return null;
    return Object.entries(tool.input_parameters).map(([key, type]) => (
      <Text key={key} ml={4} fontSize="sm" color="gray.600">
        {key}: {type}
      </Text>
    ));
  }, [tool?.input_parameters]);

  return (
    <VStack align="stretch" spacing={4}>
      <VStack align="stretch" spacing={1}>
        <Text fontWeight="bold" mb={2} color="gray.700">
          Input Schema:
        </Text>
        {formatInputSchema()}
      </VStack>
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
    </VStack>
  );
};

export default PluginNodeProperties;
