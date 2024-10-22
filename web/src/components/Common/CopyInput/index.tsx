import {
  InputGroup,
  Input,
  InputRightElement,
  IconButton,
} from "@chakra-ui/react";
import { useState } from "react";
import { FiCheck, FiCopy } from "react-icons/fi";
interface CopyInputProps {
  value: string;
}
export const CopyInputs = ({ value }: CopyInputProps) => {
  const [copied, setCopied] = useState(false);
  const onClickHandler = () => {
    setCopied(true);
    navigator.clipboard.writeText(value);
    // Revert back to the copy icon after 2 seconds
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <InputGroup size="md">
      <Input pr="3rem" isReadOnly value={value} />
      <InputRightElement width="3rem">
        <IconButton
          variant="outline"
          h="1.75rem"
          aria-label="copy"
          icon={copied ? <FiCheck /> : <FiCopy />}
          size="sm"
          onClick={onClickHandler}
        />
      </InputRightElement>
    </InputGroup>
  );
};
export default CopyInputs;
