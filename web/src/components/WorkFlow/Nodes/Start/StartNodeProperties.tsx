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
        <Text fontWeight="bold">{t("workflow.nodes.start.initialInput") || "Initial Input"}:</Text>
        <Input
          value={node.data.initialInput}
          onChange={(e) =>
            onNodeDataChange(node.id, "initialInput", e.target.value)
          }
          placeholder={t("workflow.nodes.start.placeholder") || "Enter initial input"}
        />
      </Box>
    </VStack>
  );
};

export default StartNodeProperties;
