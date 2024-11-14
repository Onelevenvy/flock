import { Box, Text, VStack, Select } from "@chakra-ui/react";
import type React from "react";
import { useCallback, useState, useEffect } from "react";

import { useVariableInsertion } from "@/hooks/graphs/useVariableInsertion";
import { useUploadsQuery } from "@/hooks/useUploadsQuery";
import { VariableReference } from "../../FlowVis/variableSystem";
import VariableSelector from "../../Common/VariableSelector";

interface RetrievalPropertiesProps {
  node: any;
  onNodeDataChange: (nodeId: string, key: string, value: any) => void;
  availableVariables: VariableReference[];
}

const RetrievalProperties: React.FC<RetrievalPropertiesProps> = ({
  node,
  onNodeDataChange,
  availableVariables,
}) => {
  const [queryInput, setQueryInput] = useState("");
  const [ragMethod, setRagMethod] = useState("Adaptive_RAG");
  const [selectedDatabase, setSelectedDatabase] = useState<string | null>(null);

  const { data: uploads, isLoading: isLoadingUploads } = useUploadsQuery();

  useEffect(() => {
    if (node) {
      setQueryInput(node.data.query || "");
      setRagMethod(node.data.rag_method || "Adaptive_RAG");
      setSelectedDatabase(node.data.knownledge_database?.[0] || null);
    }
  }, [node]);

  const handleQueryChange = useCallback(
    (value: string) => {
      setQueryInput(value);
      onNodeDataChange(node.id, "query", value);
    },
    [node.id, onNodeDataChange]
  );

  const handleRagMethodChange = useCallback(
    (event: React.ChangeEvent<HTMLSelectElement>) => {
      const value = event.target.value;
      setRagMethod(value);
      onNodeDataChange(node.id, "rag_method", value);
    },
    [node.id, onNodeDataChange]
  );

  const handleDatabaseChange = useCallback(
    (event: React.ChangeEvent<HTMLSelectElement>) => {
      const value = event.target.value;
      setSelectedDatabase(value);

      const selectedUpload = uploads?.data.find(
        (upload) => upload.name === value
      );

      if (selectedUpload) {
        onNodeDataChange(node.id, "knownledge_database", [value]);
        onNodeDataChange(node.id, "usr_id", selectedUpload.owner_id);
        onNodeDataChange(node.id, "kb_id", selectedUpload.id);
      }
    },
    [node.id, onNodeDataChange, uploads]
  );

  const {
    showVariables,
    setShowVariables,
    inputRef,
    handleKeyDown,
    insertVariable,
  } = useVariableInsertion<HTMLTextAreaElement>({
    onValueChange: (value) => handleQueryChange(value),
    availableVariables,
  });

  return (
    <VStack align="stretch" spacing={4}>
      <VariableSelector
        label="Query"
        value={queryInput}
        onChange={handleQueryChange}
        placeholder="Enter query. Use '/' to insert variables."
        showVariables={showVariables}
        setShowVariables={setShowVariables}
        inputRef={inputRef}
        handleKeyDown={handleKeyDown}
        insertVariable={insertVariable}
        availableVariables={availableVariables}
        minHeight="80px"
      />

      <Box>
        <Text fontWeight="500" fontSize="sm" color="gray.700" mb={2}>
          RAG Method:
        </Text>
        <Select
          value={ragMethod}
          onChange={handleRagMethodChange}
          size="sm"
          bg="ui.inputbgcolor"
          borderRadius="lg"
          borderColor="gray.200"
          _hover={{
            borderColor: "teal.200",
          }}
          _focus={{
            borderColor: "teal.500",
            boxShadow: "0 0 0 1px var(--chakra-colors-teal-500)",
          }}
          transition="all 0.2s"
        >
          <option value="Adaptive_RAG">Adaptive RAG</option>
          <option value="Agentic_RAG">Agentic RAG</option>
          <option value="Corrective_RAG">Corrective RAG</option>
          <option value="Self-RAG">Self-RAG</option>
        </Select>
      </Box>

      <Box>
        <Text fontWeight="500" fontSize="sm" color="gray.700" mb={2}>
          Knowledge Database:
        </Text>
        <Select
          placeholder="Select Knowledge Database"
          onChange={handleDatabaseChange}
          value={selectedDatabase || ""}
          size="sm"
          bg="ui.inputbgcolor"
          borderRadius="lg"
          borderColor="gray.200"
          _hover={{
            borderColor: "teal.200",
          }}
          _focus={{
            borderColor: "teal.500",
            boxShadow: "0 0 0 1px var(--chakra-colors-teal-500)",
          }}
          transition="all 0.2s"
        >
          {uploads?.data.map((upload) => (
            <option key={upload.id} value={upload.name}>
              {upload.name}
            </option>
          ))}
        </Select>
      </Box>
    </VStack>
  );
};

export default RetrievalProperties;
