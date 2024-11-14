import { Box, Input, Text, VStack } from "@chakra-ui/react";
import type React from "react";
import { useTranslation } from "react-i18next";

interface StartNodePropertiesProps {
  node: any;
  onNodeDataChange: (nodeId: string, key: string, value: any) => void;
}

const StartNodeProperties: React.FC<StartNodePropertiesProps> = ({
  node,
  onNodeDataChange,
}) => {
  const { t } = useTranslation();

  return (
    <VStack align="stretch" spacing={4}>
      <Box>
        <Text 
          fontWeight="500" 
          fontSize="sm" 
          color="gray.700"
          mb={2}
        >
          {t("workflow.nodes.start.initialInput")}:
        </Text>
        <Input
          value={node.data.initialInput || ''}
          onChange={(e) =>
            onNodeDataChange(node.id, "initialInput", e.target.value)
          }
          placeholder={t("workflow.nodes.start.placeholder") || "Enter initial input"}
          size="sm"
          borderRadius="lg"
          borderColor="gray.200"
          _hover={{
            borderColor: "green.200"
          }}
          _focus={{
            borderColor: "green.500",
            boxShadow: "0 0 0 1px var(--chakra-colors-green-500)"
          }}
          transition="all 0.2s"
        />
      </Box>
    </VStack>
  );
};

export default StartNodeProperties;
