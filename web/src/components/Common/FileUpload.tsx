import {
  FormControl,
  FormErrorMessage,
  FormLabel,
  Icon,
  Input,
  InputGroup,
  InputLeftElement,
} from "@chakra-ui/react";
import { useRef } from "react";
import { type Control, useController } from "react-hook-form";
import { FiFile } from "react-icons/fi";

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
  placeholder = "Your file ...",
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
    <FormControl isInvalid={invalid} isRequired={isRequired} mt={4}>
      <FormLabel htmlFor="writeUpFile">{children}</FormLabel>
      <InputGroup>
        <InputLeftElement pointerEvents="none">
          <Icon as={FiFile} />
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
        />
      </InputGroup>
      <FormErrorMessage>{invalid}</FormErrorMessage>
    </FormControl>
  );
};

export default FileUpload;
