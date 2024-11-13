import { Box, HStack, IconButton, Text } from "@chakra-ui/react";
import type React from "react";
import type { NodeProps } from "reactflow";
import { useTranslation } from "react-i18next";

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
}) => {
  const { t } = useTranslation();
  
  return (
    <Box
      padding="10px"
      borderRadius="lg"
      background="white"
      minWidth="200"
      maxWidth="200"
      textAlign="center"
      position="relative"
      boxShadow="md"
    >
      <HStack spacing={2} mb={1}>
        <IconButton
          aria-label={data.label}
          icon={icon}
          colorScheme={colorScheme}
          size="xs"
        />
        <Text fontWeight="bold" fontSize="xs">
          {data.label}
        </Text>
      </HStack>
      {children}
    </Box>
  );
};
