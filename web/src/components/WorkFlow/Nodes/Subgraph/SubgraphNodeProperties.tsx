import { Text, VStack } from "@chakra-ui/react";
import type React from "react";

interface SubgraphNodePropertiesProps {
  node: any;
  onNodeDataChange: (nodeId: string, key: string, value: any) => void;
}

const SubgraphNodeProperties: React.FC<SubgraphNodePropertiesProps> = ({
  node,
}) => {
  return (
    <VStack align="stretch" spacing={4}>
      <VStack align="stretch" spacing={2}>
        <Text fontWeight="bold" mb={2} color="gray.700">
          Name
        </Text>
        <Text
          color="gray.600"
          fontSize="sm"
          bg="gray.50"
          p={2}
          borderRadius="md"
        >
          {node.data.label}
        </Text>
      </VStack>

      <VStack align="stretch" spacing={2}>
        <Text fontWeight="bold" mb={2} color="gray.700">
          Description
        </Text>
        <Text
          color="gray.600"
          fontSize="sm"
          bg="gray.50"
          p={2}
          borderRadius="md"
          whiteSpace="pre-wrap"
        >
          {node.data.description || "No description available"}
        </Text>
      </VStack>

      <VStack align="stretch" spacing={2}>
        <Text fontWeight="bold" mb={2} color="gray.700">
          Subgraph ID
        </Text>
        <Text
          color="gray.600"
          fontSize="sm"
          bg="gray.50"
          p={2}
          borderRadius="md"
        >
          {node.data.subgraphId}
        </Text>
      </VStack>
    </VStack>
  );
};

export default SubgraphNodeProperties;
