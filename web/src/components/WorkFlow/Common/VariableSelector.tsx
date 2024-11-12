import {
  Box,
  Button,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Text,
  Textarea,
  VStack,
} from "@chakra-ui/react";
import React from "react";

import { VariableReference } from "../FlowVis/variableSystem";

interface VariableSelectorProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  showVariables: boolean;
  setShowVariables: (show: boolean) => void;
  inputRef: React.RefObject<HTMLTextAreaElement>;
  handleKeyDown: (e: React.KeyboardEvent) => void;
  insertVariable: (variable: string) => void;
  availableVariables: VariableReference[];
  minHeight?: string;
}

const VariableSelector: React.FC<VariableSelectorProps> = ({
  label,
  value,
  onChange,
  placeholder = "Write here. Use '/' to insert variables.",
  showVariables,
  setShowVariables,
  inputRef,
  handleKeyDown,
  insertVariable,
  availableVariables = [],
  minHeight = "100px",
}) => {
  return (
    <Box>
      <Text fontWeight="bold" mb={2}>
        {label}
      </Text>
      <Popover
        isOpen={showVariables}
        onClose={() => setShowVariables(false)}
        placement="bottom-start"
        autoFocus={false}
      >
        <PopoverTrigger>
          <Textarea
            ref={inputRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            style={{
              whiteSpace: "pre-wrap",
              minHeight: minHeight,
            }}
            borderColor="gray.200"
            _hover={{ borderColor: "gray.300" }}
            _focus={{ borderColor: "blue.500", boxShadow: "none" }}
          />
        </PopoverTrigger>
        <PopoverContent
          width="auto"
          minWidth="200px"
          maxWidth="400px"
          boxShadow="lg"
          border="1px solid"
          borderColor="gray.200"
          p={2}
        >
          <VStack align="stretch" spacing={1}>
            <Text fontSize="sm" fontWeight="500" color="gray.600" p={2}>
              Available Variables
            </Text>
            {availableVariables?.length > 0 ? (
              availableVariables.map((v) => (
                <Button
                  key={`${v.nodeId}.${v.variableName}`}
                  onClick={() => insertVariable(`${v.nodeId}.${v.variableName}`)}
                  size="sm"
                  variant="ghost"
                  justifyContent="flex-start"
                  px={3}
                  py={2}
                  height="auto"
                  _hover={{
                    bg: "blue.50",
                  }}
                  leftIcon={
                    <Box
                      as="span"
                      bg="blue.100"
                      color="blue.700"
                      px={2}
                      py={1}
                      borderRadius="md"
                      fontSize="xs"
                      fontWeight="500"
                    >
                      {v.nodeId}
                    </Box>
                  }
                >
                  <Text fontSize="sm" ml={2}>
                    {v.variableName}
                  </Text>
                </Button>
              ))
            ) : (
              <Text fontSize="sm" color="gray.500" textAlign="center" p={2}>
                No variables available
              </Text>
            )}
          </VStack>
        </PopoverContent>
      </Popover>
    </Box>
  );
};

export default VariableSelector; 