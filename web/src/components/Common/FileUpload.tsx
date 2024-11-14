import {
  FormControl,
  FormErrorMessage,
  FormLabel,
  Icon,
  Input,
  InputGroup,
  InputLeftElement,
  Box,
} from "@chakra-ui/react";
import { useRef } from "react";
import { type Control, useController } from "react-hook-form";
import { FiFile, FiUploadCloud } from "react-icons/fi";

interface FileUploadProps {
  name: string;
  placeholder?: string;
  acceptedFileTypes?: string;
  control: Control<any>;
  isRequired?: boolean;
  children: React.ReactNode;
  onFileSelect?: (file: File) => void;
}

export const FileUpload = ({
  name,
  placeholder = "Choose a file...",
  acceptedFileTypes = "",
  control,
  isRequired = false,
  children,
  onFileSelect,
}: FileUploadProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const {
    field: { ref, onChange, value, ...inputProps },
    fieldState: { invalid },
  } = useController({
    name,
    control,
    rules: { required: isRequired },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onChange(file);
      if (onFileSelect) {
        onFileSelect(file);
      }
    }
  };

  return (
    <FormControl isInvalid={invalid} isRequired={isRequired}>
      <FormLabel 
        htmlFor="writeUpFile"
        color="gray.700"
        fontWeight="500"
      >
        {children}
      </FormLabel>
      <Box
        position="relative"
        transition="all 0.2s"
        _hover={{
          transform: "translateY(-1px)",
        }}
      >
        <InputGroup>
          <InputLeftElement pointerEvents="none">
            <Icon 
              as={value ? FiFile : FiUploadCloud} 
              color={value ? "blue.500" : "gray.400"}
              transition="all 0.2s"
            />
          </InputLeftElement>
          <input
            type="file"
            onChange={handleFileChange}
            accept={acceptedFileTypes}
            ref={inputRef}
            {...inputProps}
            style={{ display: "none" }}
          />
          <Input
            placeholder={placeholder}
            onClick={() => inputRef?.current?.click()}
            readOnly={true}
            value={value?.name || ""}
            cursor="pointer"
            bg="white"
            border="1px solid"
            borderColor="gray.200"
            borderRadius="lg"
            _hover={{
              borderColor: "blue.500",
              boxShadow: "0 0 0 1px var(--chakra-colors-blue-500)",
            }}
            transition="all 0.2s"
          />
        </InputGroup>
      </Box>
      <FormErrorMessage>
        {invalid && "Please select a file"}
      </FormErrorMessage>
    </FormControl>
  );
};

export default FileUpload;
