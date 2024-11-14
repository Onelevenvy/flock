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
      borderRadius="xl"
      background="white"
      minWidth="200"
      maxWidth="200"
      textAlign="center"
      position="relative"
      boxShadow="lg"
      border="1px solid"
      borderColor="gray.100"
      transition="all 0.2s"
      _hover={{
        transform: "translateY(-1px)",
        boxShadow: "xl",
        borderColor: "gray.200",
      }}
    >
      <HStack spacing={2} mb={1}>
        <IconButton
          aria-label={data.label}
          icon={icon}
          colorScheme={colorScheme}
          size="sm"
          variant="ghost"
          bg={`${colorScheme}.50`}
          color={`${colorScheme}.500`}
          flexShrink={0}
          transition="all 0.2s"
          _hover={{
            transform: "scale(1.1)",
          }}
          _active={{
            transform: "scale(0.95)",
          }}
        />
        <Text
          fontWeight="500"
          fontSize="sm"
          color="gray.700"
          transition="all 0.2s"
          _hover={{
            color: `${colorScheme}.500`,
          }}
        >
          {data.label}
        </Text>
      </HStack>
      {children}
    </Box>
  );
};
