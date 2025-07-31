import {
  Text,
  VStack,
  FormControl,
  FormLabel,
  Spinner,
  Box,
  Tooltip,
  HStack, 
} from "@chakra-ui/react";
import React, { useCallback, useMemo, useState, useEffect } from "react";
import { useVariableInsertion } from "@/hooks/graphs/useVariableInsertion";
import { useToolProvidersQuery } from "@/hooks/useToolProvidersQuery";
import type { VariableReference } from "../../FlowVis/variableSystem";
import VariableSelector from "../../Common/VariableSelector";
import type { ToolProviderWithToolsListOut } from "@/client";


interface ParameterInputProps {
  paramName: string;
  paramDetails: any;
  value: string;
  onChange: (paramName: string, value: string) => void;
  availableVariables: VariableReference[];
}
const ParameterInput: React.FC<ParameterInputProps> = ({ paramName, paramDetails, value, onChange, availableVariables }) => {
  const variableInsertionHook = useVariableInsertion<HTMLTextAreaElement>({ onValueChange: (newValue) => onChange(paramName, newValue), availableVariables });
  const hasLongDescription = paramDetails.description && paramDetails.description.length > 50;
  return (
      <FormControl key={paramName} isRequired={paramDetails.required}>
          <HStack justify="space-between" align="center" mb={1}>
              <FormLabel mb={0} fontWeight="medium" color="gray.800">
                  {paramName}
                  <Text as="span" fontSize="xs" color="gray.500" ml={2} fontWeight="normal">({paramDetails.type})</Text>
              </FormLabel>
          </HStack>
          <Tooltip label={paramDetails.description} isDisabled={!hasLongDescription} placement="top-start" hasArrow>
              <VariableSelector 
              value={value}
               onChange={(newValue) => onChange(paramName, newValue)} 
               placeholder={hasLongDescription ? `Hover for description...` : paramDetails.description}
                showVariables={variableInsertionHook.showVariables} setShowVariables={variableInsertionHook.setShowVariables}
                 inputRef={variableInsertionHook.inputRef as React.RefObject<HTMLTextAreaElement>} 
                 handleKeyDown={variableInsertionHook.handleKeyDown} 
                 insertVariable={variableInsertionHook.insertVariable} 
                 availableVariables={availableVariables}
                 minHeight="60px" 
                label={null}
                 />
          </Tooltip>
      </FormControl>
  );
};

// --- 主组件 ---
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
  const { data: toolProvidersData, isLoading } = useToolProvidersQuery();
  const providers: ToolProviderWithToolsListOut[] = toolProvidersData?.providers || [];
  const [argValues, setArgValues] = useState<Record<string, any>>({});
  
 

  const selectedTool = useMemo(() => {
      if (!node.data.tool?.id) return null;
      for (const provider of providers) {
          const foundTool = provider.tools.find(t => t.id === node.data.tool.id);
          if (foundTool) return foundTool;
      }
      return null;
  }, [node.data.tool?.id, providers]);




  useEffect(() => {
      try {
          const existingArgs = node.data.args ? JSON.parse(node.data.args) : {};
          if (JSON.stringify(existingArgs) !== JSON.stringify(argValues)) {
             setArgValues(existingArgs);
          }
      } catch (e) {
          setArgValues({});
      }
  }, [node.data.args]);

  const handleArgChange = useCallback((paramName: string, value: string) => {
      const newArgValues = { ...argValues, [paramName]: value };
      setArgValues(newArgValues);
      onNodeDataChange(node.id, "args", JSON.stringify(newArgValues, null, 2));
  }, [argValues, node.id, onNodeDataChange]);

  if (isLoading) {
      return <Box display="flex" justifyContent="center" p={4}><Spinner /></Box>;
  }
  
  if (!selectedTool?.input_parameters || Object.keys(selectedTool.input_parameters).length === 0) {
      return <Text p={2} fontSize="sm" color="gray.500">No input parameters for this tool.</Text>;
  }

  return (
      <VStack align="stretch" spacing={4}>
          {Object.entries(selectedTool.input_parameters).map(([paramName, paramDetails]) => (
              <ParameterInput
                  key={paramName}
                  paramName={paramName}
                  paramDetails={paramDetails}
                  value={argValues[paramName] || ""}
                  onChange={handleArgChange}
                  availableVariables={availableVariables}
              />
          ))}
      </VStack>
  );
};

export default PluginNodeProperties;