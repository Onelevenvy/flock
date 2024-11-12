import { Box, HStack, IconButton, Text } from "@chakra-ui/react";
import type React from "react";
import type { NodeProps } from "reactflow";

interface BaseNodeProps extends NodeProps {
  icon?: React.ReactElement;
  colorScheme: string;
  children: React.ReactNode;
}

export const BaseNode: React.FC<BaseNodeProps> = ({
  data,
  icon,
  colorScheme,
  children,
  id,
}) => (
  <Box
    padding="10px"
    borderRadius="lg"
    background="white"
    minWidth="200px"
    maxWidth="200px"
    textAlign="center"
    position="relative"
    boxShadow="0 2px 4px rgba(0,0,0,0.1)"
    border="1px solid"
    borderColor="gray.200"
    transition="all 0.2s"
    _hover={{
      boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
      borderColor: "gray.300",
    }}
  >
    <HStack spacing={2} mb={2} justify="center">
      <IconButton
        aria-label={data.label}
        icon={icon}
        colorScheme={colorScheme}
        size="sm"
        borderRadius="md"
      />
      <Text fontWeight="600" fontSize="sm" color="gray.700">
        {data.label}
      </Text>
    </HStack>
    {children}
  </Box>
);
