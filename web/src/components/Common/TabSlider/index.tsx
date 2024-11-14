import { Box, Flex, Text } from "@chakra-ui/react";
import type { FC } from "react";

type Option = {
  value: string;
  text: string;
  icon?: React.ReactNode;
};

type TabSliderProps = {
  className?: string;
  value: string;
  onChange: (v: string) => void;
  options: Option[];
};

const TabSlider: FC<TabSliderProps> = ({
  className,
  value,
  onChange,
  options,
}) => {
  return (
    <Flex 
      className={className} 
      position="relative" 
      bg="gray.50" 
      p={1} 
      borderRadius="xl"
    >
      {options.map((option, index) => (
        <Box
          key={option.value}
          onClick={() => onChange(option.value)}
          px={3}
          py={2}
          display="flex"
          alignItems="center"
          borderRadius="lg"
          cursor="pointer"
          transition="all 0.2s ease-in-out"
          bg={value === option.value ? "white" : "transparent"}
          color={value === option.value ? "gray.800" : "gray.600"}
          boxShadow={value === option.value ? "sm" : "none"}
          borderWidth="1px"
          borderColor={value === option.value ? "gray.200" : "transparent"}
          _hover={{
            bg: value === option.value ? "white" : "gray.100",
            transform: "translateY(-1px)",
          }}
          _active={{
            transform: "translateY(0)",
          }}
          mr={index < options.length - 1 ? 2 : 0}
        >
          {option.icon && (
            <Box
              as="span"
              mr={2}
              color={value === option.value ? "blue.500" : "gray.500"}
              transition="all 0.2s"
            >
              {option.icon}
            </Box>
          )}
          <Text
            fontSize="sm"
            fontWeight={value === option.value ? "600" : "500"}
            transition="all 0.2s"
          >
            {option.text}
          </Text>
        </Box>
      ))}
    </Flex>
  );
};

export default TabSlider;