import { FormControl, FormErrorMessage, VStack } from "@chakra-ui/react";
import type React from "react";

interface EndPropertiesProps {
  children: React.ReactNode;
  nodeName: string;
  onNameChange: (newName: string) => void;
  nameError: string | null;
}

const EndProperties: React.FC<EndPropertiesProps> = ({
  children,
  nameError,
}) => {
  return (
    <VStack spacing={4} align="stretch">
      <FormControl 
        isInvalid={!!nameError}
        transition="all 0.2s"
      >
        <FormErrorMessage
          fontSize="sm"
          color="red.500"
          fontWeight="500"
        >
          {nameError}
        </FormErrorMessage>
      </FormControl>
      {children}
    </VStack>
  );
};

export default EndProperties;
