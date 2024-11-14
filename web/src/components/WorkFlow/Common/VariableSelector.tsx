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
import { useTranslation } from "react-i18next";

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
  placeholder,
  showVariables,
  setShowVariables,
  inputRef,
  handleKeyDown,
  insertVariable,
  availableVariables = [],
  minHeight = "100px",
}) => {
  const { t } = useTranslation();

  return (
    <Box>
      <Text fontWeight="600" mb={2} color="gray.700" fontSize="sm">
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
            placeholder={
              placeholder || String(t("workflow.variableSelector.placeholder"))
            }
            style={{
              whiteSpace: "pre-wrap",
              minHeight: minHeight,
            }}
            bg="ui.inputbgcolor"
            borderColor="gray.200"
            borderRadius="lg"
            fontSize="sm"
            transition="all 0.2s"
            _hover={{
              borderColor: "gray.300",
              transform: "translateY(-1px)",
              boxShadow: "sm",
            }}
            _focus={{
              borderColor: "blue.500",
              boxShadow: "0 0 0 1px var(--chakra-colors-blue-500)",
              transform: "translateY(-1px)",
            }}
          />
        </PopoverTrigger>
        <PopoverContent
          width="auto"
          minWidth="250px"
          maxWidth="400px"
          boxShadow="lg"
          border="1px solid"
          borderColor="gray.100"
          borderRadius="lg"
          p={2}
          bg="white"
          _focus={{
            outline: "none",
          }}
        >
          <VStack align="stretch" spacing={1}>
            <Text
              fontSize="sm"
              fontWeight="600"
              color="gray.600"
              p={2}
              borderBottom="1px solid"
              borderColor="gray.100"
            >
              {t("workflow.variableSelector.availableVariables")}
            </Text>
            {availableVariables?.length > 0 ? (
              availableVariables.map((v) => (
                <Button
                  key={`${v.nodeId}.${v.variableName}`}
                  onClick={() =>
                    insertVariable(`${v.nodeId}.${v.variableName}`)
                  }
                  size="sm"
                  variant="ghost"
                  justifyContent="flex-start"
                  px={3}
                  py={2}
                  height="auto"
                  transition="all 0.2s"
                  _hover={{
                    bg: "blue.50",
                    transform: "translateX(2px)",
                  }}
                  leftIcon={
                    <Box
                      as="span"
                      bg="blue.50"
                      color="blue.600"
                      px={2}
                      py={1}
                      borderRadius="md"
                      fontSize="xs"
                      fontWeight="600"
                      transition="all 0.2s"
                    >
                      {v.nodeId}
                    </Box>
                  }
                >
                  <Text fontSize="sm" ml={2} color="gray.700">
                    {v.variableName}
                  </Text>
                </Button>
              ))
            ) : (
              <Text fontSize="sm" color="gray.500" textAlign="center" p={4}>
                {t("workflow.variableSelector.noVariables")}
              </Text>
            )}
          </VStack>
        </PopoverContent>
      </Popover>
    </Box>
  );
};

export default VariableSelector;
