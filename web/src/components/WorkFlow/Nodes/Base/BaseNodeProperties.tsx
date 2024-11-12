import {
  FormControl,
  FormErrorMessage,
  HStack,
  IconButton,
  Input,
  VStack,
  Select,
  Text,
  Box,
} from "@chakra-ui/react";
import React from "react";
import { Node } from "reactflow";

import { VariableReference } from "../../FlowVis/variableSystem";
import { nodeConfig, NodeType } from "../nodeConfig";

interface BasePropertiesProps {
  children: React.ReactNode;
  nodeName: string;
  onNameChange: (newName: string) => void;
  nameError: string | null;
  icon: React.ReactElement;
  colorScheme: string;
  node: Node;
  onNodeDataChange: (nodeId: string, key: string, value: any) => void;
  availableVariables: VariableReference[];
}

const BaseProperties: React.FC<BasePropertiesProps> = ({
  children,
  nodeName,
  onNameChange,
  nameError,
  icon,
  colorScheme,
  node,
  onNodeDataChange,
  availableVariables,
}) => {
  const nodeType = node.type as NodeType;
  const inputVariables = nodeConfig[nodeType].inputVariables;

  return (
    <VStack spacing={4} align="stretch">
      <Box borderBottom="1px solid" borderColor="gray.200" pb={3}>
        <FormControl isInvalid={!!nameError}>
          <HStack spacing={2} align="center">
            <IconButton
              aria-label="node-type"
              icon={icon}
              colorScheme={colorScheme}
              size="sm"
              borderRadius="md"
            />
            <Input
              value={nodeName}
              onChange={(e) => onNameChange(e.target.value)}
              size="sm"
              fontWeight="600"
              borderColor="gray.200"
              _hover={{ borderColor: "gray.300" }}
              _focus={{ borderColor: "blue.500", boxShadow: "none" }}
              placeholder="Enter node name"
            />
          </HStack>
          <FormErrorMessage>{nameError}</FormErrorMessage>
        </FormControl>
      </Box>

      {inputVariables.length > 0 && (
        <Box>
          <Text fontSize="md" fontWeight="600" color="gray.700" mb={2}>
            Input Variables
          </Text>
          <VStack spacing={3}>
            {inputVariables.map((varName) => (
              <FormControl key={varName}>
                <Text fontSize="sm" fontWeight="500" color="gray.600" mb={1}>
                  {varName}:
                </Text>
                <Select
                  value={node.data[varName] || ""}
                  onChange={(e) =>
                    onNodeDataChange(node.id, varName, e.target.value)
                  }
                  size="sm"
                  bg="gray.50"
                  borderColor="gray.200"
                  _hover={{ borderColor: "gray.300" }}
                >
                  <option value="">Select a variable</option>
                  {availableVariables.map((v) => (
                    <option
                      key={`${v.nodeId}.${v.variableName}`}
                      value={`\${${v.nodeId}.${v.variableName}}`}
                    >
                      {v.nodeId}.{v.variableName}
                    </option>
                  ))}
                </Select>
              </FormControl>
            ))}
          </VStack>
        </Box>
      )}

      <Box>{children}</Box>
    </VStack>
  );
};

export default BaseProperties;
