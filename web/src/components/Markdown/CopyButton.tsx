import { IconButton, useToast } from "@chakra-ui/react";
import { Check, Copy } from "lucide-react";
import { useState } from "react";

const CopyButton = ({ id }: { id: string }) => {
  const [copied, setCopied] = useState(false);
  const toast = useToast();

  const onCopy = async () => {
    try {
      setCopied(true);
      const text = document.getElementById(id)?.innerText || "";

      await navigator.clipboard.writeText(text);
      toast({
        title: "Copied to clipboard!",
        status: "success",
        duration: 1000,
        isClosable: true,
      });
      setTimeout(() => {
        setCopied(false);
      }, 1000);
    } catch (error) {
      console.error("Failed to copy text: ", error);
    }
  };

  return (
    <IconButton
      aria-label={copied ? "Copied" : "Copy"}
      icon={copied ? <Check size={16} /> : <Copy size={16} />}
      onClick={onCopy}
      variant="outline"
      borderRadius="md"
      size="sm"
      colorScheme={copied ? "green" : "gray"}
      transition="all 0.2s"
      _hover={{
        bg: "gray.200",
        dark: { bg: "gray.800" },
      }}
      position="relative"
    />
  );
};

export default CopyButton;
