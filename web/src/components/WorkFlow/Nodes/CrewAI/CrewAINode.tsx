import { Box, Text, VStack, HStack, Tag } from "@chakra-ui/react";
import React from "react";
import { Handle, type NodeProps, Position } from "reactflow";
import { FaRobot, FaListAlt } from "react-icons/fa";

import { BaseNode } from "../Base/BaseNode";
import { nodeConfig } from "../nodeConfig";
import { CrewAINodeData } from "../../types";

const CrewAINode: React.FC<NodeProps> = (props) => {
  const { icon: Icon, colorScheme } = nodeConfig.crewai;
  const data = props.data as CrewAINodeData;

  return (
    <BaseNode {...props} icon={<Icon />} colorScheme={colorScheme}>
      <Handle type="target" position={Position.Left} id="left" />
      <Handle type="target" position={Position.Right} id="right" />
      <Handle type="source" position={Position.Left} id="left" />
      <Handle type="source" position={Position.Right} id="right" />
      
      <VStack spacing={2} align="stretch">
        <Box bg="#f2f4f7" borderRadius="md" p={2}>
          <HStack justify="space-between" mb={1}>
            <HStack>
              <FaRobot size="12px" />
              <Text fontSize="xs" fontWeight="bold">Agents</Text>
            </HStack>
            <Tag size="sm" colorScheme="blue">{data.agents.length}</Tag>
          </HStack>
          {data.agents.length > 0 && (
            <VStack align="start" spacing={1}>
              {data.agents.slice(0, 2).map((agent) => (
                <Text key={agent.id} fontSize="xs" noOfLines={1}>
                  • {agent.role}
                </Text>
              ))}
              {data.agents.length > 2 && (
                <Text fontSize="xs">• ... and {data.agents.length - 2} more</Text>
              )}
            </VStack>
          )}
        </Box>

        <Box bg="#f2f4f7" borderRadius="md" p={2}>
          <HStack justify="space-between" mb={1}>
            <HStack>
              <FaListAlt size="12px" />
              <Text fontSize="xs" fontWeight="bold">Tasks</Text>
            </HStack>
            <Tag size="sm" colorScheme="green">{data.tasks.length}</Tag>
          </HStack>
          {data.tasks.length > 0 && (
            <VStack align="start" spacing={1}>
              {data.tasks.slice(0, 2).map((task, index) => (
                <Text key={index} fontSize="xs" noOfLines={1}>
                  • {task.description}
                </Text>
              ))}
              {data.tasks.length > 2 && (
                <Text fontSize="xs">• ... and {data.tasks.length - 2} more</Text>
              )}
            </VStack>
          )}
        </Box>

        <Tag size="sm" alignSelf="center" colorScheme={data.process_type === "sequential" ? "blue" : "purple"}>
          {data.process_type}
        </Tag>
      </VStack>
    </BaseNode>
  );
};

export default React.memo(CrewAINode); 