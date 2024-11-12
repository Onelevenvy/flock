import React from "react";
import { Handle, Position, type NodeProps } from "reactflow";
import { Box, Text, VStack } from "@chakra-ui/react";
import { BaseNode } from "../Base/BaseNode";
import { nodeConfig } from "../nodeConfig";
import { ClassifierNodeData } from "../../types";

const ClassifierNode: React.FC<NodeProps<ClassifierNodeData>> = (props) => {
  const { icon: Icon, colorScheme } = nodeConfig.classifier;
  const { categories } = props.data;

  return (
    <BaseNode {...props} icon={<Icon />} colorScheme={colorScheme}>
      <Handle
        type="target"
        position={Position.Left}
        id="input"
        style={{ left: -8 }}
      />
      
      <VStack spacing={1} align="stretch">
        {categories.map((category, index) => (
          <Box
            key={category.category_id}
            position="relative"
            bg="#f2f4f7"
            p={1}
            borderRadius="md"
          >
            <Text fontSize="xs" fontWeight="500">
              {category.category_name || `Category ${index + 1}`}
            </Text>
            <Handle
              type="source"
              position={Position.Right}
              id={category.category_id}
              style={{
                right: -8,
                top: "50%",
                transform: "translateY(-50%)",
                background: "#555",
                width: 8,
                height: 8,
              }}
            />
          </Box>
        ))}
      </VStack>
    </BaseNode>
  );
};

export default React.memo(ClassifierNode);
