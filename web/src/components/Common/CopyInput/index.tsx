import {
  InputGroup,
  Input,
  InputRightElement,
  IconButton,
  useToast,
} from "@chakra-ui/react";
import { useState } from "react";
import { FiCheck, FiCopy } from "react-icons/fi";

interface CopyInputProps {
  value: string;
}

export const CopyInput = ({ value }: CopyInputProps) => {
  const [copied, setCopied] = useState(false);
  const toast = useToast();

  const onClickHandler = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    
    toast({
      title: "Copied to clipboard",
      status: "success",
      duration: 2000,
      isClosable: true,
      position: "top",
    });

    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <InputGroup size="md">
      <Input
        pr="3rem"
        isReadOnly
        value={value}
        bg="white"
        border="1px solid"
        borderColor="gray.200"
        borderRadius="lg"
        fontSize="sm"
        transition="all 0.2s"
        _hover={{
          borderColor: "gray.300",
        }}
        _focus={{
          borderColor: "blue.500",
          boxShadow: "0 0 0 1px var(--chakra-colors-blue-500)",
        }}
      />
      <InputRightElement width="3rem">
        <IconButton
          aria-label={copied ? "Copied" : "Copy"}
          icon={copied ? <FiCheck /> : <FiCopy />}
          size="sm"
          variant="ghost"
          colorScheme={copied ? "green" : "gray"}
          onClick={onClickHandler}
          transition="all 0.2s"
          borderRadius="md"
          _hover={{
            bg: copied ? "green.50" : "gray.100",
            transform: "translateY(-1px)",
          }}
          _active={{
            transform: "translateY(0)",
          }}
        />
      </InputRightElement>
    </InputGroup>
  );
};

export default CopyInput;
