import {
  FormControl,
  FormErrorMessage,
  HStack,
  IconButton,
  Input,
  VStack,
  Select,
  Text,
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
      <FormControl isInvalid={!!nameError}>
        <HStack spacing={1} mb={1}>
          <IconButton
            aria-label="names"
            icon={icon}
            colorScheme={colorScheme}
            size="sm"
            transition="all 0.2s"
            _hover={{
              transform: "scale(1.1)",
            }}
            _active={{
              transform: "scale(0.95)",
            }}
          />
          <Input
            value={nodeName}
            onChange={(e) => onNameChange(e.target.value)}
            size="sm"
            fontWeight="500"
            w="75%"
            bg="white"
            borderRadius="lg"
            borderColor="white"
            transition="all 0.2s"
            _hover={{
              borderColor: `${colorScheme}.200`,
            }}
            _focus={{
              borderColor: `${colorScheme}.500`,
              boxShadow: `0 0 0 1px ${colorScheme}.500`,
            }}
          />
        </HStack>
        <FormErrorMessage>{nameError}</FormErrorMessage>
      </FormControl>

      {inputVariables.map((varName) => (
        <FormControl key={varName}>
          <Text fontWeight="bold"  color="gray.700" mb={1}>
            {varName}:
          </Text>
          <Select
            value={node.data[varName] || ""}
            onChange={(e) => onNodeDataChange(node.id, varName, e.target.value)}
            size="sm"
            bg="ui.inputbgcolor"
            borderRadius="lg"
            borderColor="gray.200"
            transition="all 0.2s"
            _hover={{
              borderColor: `${colorScheme}.200`,
            }}
            _focus={{
              borderColor: `${colorScheme}.500`,
              boxShadow: `0 0 0 1px ${colorScheme}.500`,
            }}
          >
            <option value="">Select a variable</option>
            {availableVariables.map((v) => (
              <option
                key={`${v.nodeId}.${v.variableName}`}
                value={`{${v.nodeId}.${v.variableName}}`}
              >
                {v.nodeId}.{v.variableName}
              </option>
            ))}
          </Select>
        </FormControl>
      ))}

      {children}
    </VStack>
  );
};

export default BaseProperties;
