import {
  Box,
  Text,
  VStack,
  Button,
  Popover,
  PopoverTrigger,
  PopoverContent,
  Input,
} from "@chakra-ui/react";
import type React from "react";
import { useState, useCallback } from "react";

import { ToolsService } from "@/client/services/ToolsService";
import { useVariableInsertion } from "@/hooks/graphs/useVariableInsertion";
import { useSkillsQuery } from "@/hooks/useSkillsQuery";

import { VariableReference } from "../../FlowVis/variableSystem";


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

  // 为每个可能的输入参数创建一个 useVariableInsertion hook
  const variableInsertionHooks: {
    [key: string]: ReturnType<typeof useVariableInsertion<HTMLInputElement>>;
  } = {};

  if (tool?.input_parameters) {
    Object.keys(tool.input_parameters).forEach((key) => {
      // eslint-disable-next-line react-hooks/rules-of-hooks
      variableInsertionHooks[key] = useVariableInsertion<HTMLInputElement>({
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
      <Box>
        <Text fontWeight="bold">Input param:</Text>
      </Box>
      {tool?.input_parameters &&
        Object.entries(tool.input_parameters).map(([key, value]) => (
          <Box key={key}>
            <Text fontWeight="bold">{key}:</Text>
            <Popover
              isOpen={variableInsertionHooks[key]?.showVariables}
              onClose={() =>
                variableInsertionHooks[key]?.setShowVariables(false)
              }
              placement="bottom-start"
            >
              <PopoverTrigger>
                <Input
                  ref={variableInsertionHooks[key]?.inputRef}
                  value={node.data.args[key] || ""}
                  onChange={(e) => handleInputChange(key, e.target.value)}
                  onKeyDown={variableInsertionHooks[key]?.handleKeyDown}
                  placeholder={`Enter ${key}. Use '/' to insert variables.`}
                />
              </PopoverTrigger>
              <PopoverContent>
                <VStack align="stretch">
                  {availableVariables.map((v) => (
                    <Button
                      key={`${v.nodeId}.${v.variableName}`}
                      onClick={() =>
                        variableInsertionHooks[key]?.insertVariable(
                          `${v.nodeId}.${v.variableName}`
                        )
                      }
                      size="sm"
                    >
                      {v.nodeId}.{v.variableName}
                    </Button>
                  ))}
                </VStack>
              </PopoverContent>
            </Popover>
          </Box>
        ))}
      <Button onClick={handleInvoke} isLoading={loading}>
        Run Tool
      </Button>
    </VStack>
  );
};

export default PluginNodeProperties;