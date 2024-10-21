import {
  Box,
  Text,
  VStack,
  Popover,
  PopoverTrigger,
  PopoverContent,
  Button,
  Textarea,
} from "@chakra-ui/react";
import type React from "react";
import { useCallback, useState, useEffect } from "react";

import { useVariableInsertion } from "@/hooks/graphs/useVariableInsertion";

import { VariableReference } from "../../FlowVis/variableSystem";

interface AnswerPropertiesProps {
  node: any;
  onNodeDataChange: (nodeId: string, key: string, value: any) => void;
  availableVariables: VariableReference[];
}

const AnswerProperties: React.FC<AnswerPropertiesProps> = ({
  node,
  onNodeDataChange,
  availableVariables,
}) => {
  const [answerInput, setAnswerInput] = useState("");

  useEffect(() => {
    if (node && node.data.answer !== undefined) {
      setAnswerInput(node.data.answer || "");
    }
  }, [node]);

  const handleAnswerChange = useCallback(
    (value: string) => {
      setAnswerInput(value);
      onNodeDataChange(node.id, "answer", value);
    },
    [node.id, onNodeDataChange]
  );

  const {
    showVariables,
    setShowVariables,
    inputRef,
    handleKeyDown,
    insertVariable,
  } = useVariableInsertion<HTMLTextAreaElement>({
    onValueChange: (value) => handleAnswerChange(value),
    availableVariables,
  });

  return (
    <VStack align="stretch" spacing={4}>
      <Box>
        <Text fontWeight="bold">Answer:</Text>
        <Popover
          isOpen={showVariables}
          onClose={() => setShowVariables(false)}
          placement="bottom-start"
        >
          <PopoverTrigger>
            <Textarea
              ref={inputRef}
              value={answerInput}
              onChange={(e) => handleAnswerChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Write your answer here. Use '/' to insert variables."
              style={{
                whiteSpace: "pre-wrap",
                minHeight: "100px",
              }}
            />
          </PopoverTrigger>
          <PopoverContent>
            <VStack align="stretch">
              {availableVariables.map((v) => (
                <Button
                  key={`${v.nodeId}.${v.variableName}`}
                  onClick={() =>
                    insertVariable(`${v.nodeId}.${v.variableName}`)
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
    </VStack>
  );
};

export default AnswerProperties;
