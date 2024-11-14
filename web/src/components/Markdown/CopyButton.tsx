import { IconButton, useToast, useColorModeValue } from "@chakra-ui/react";
import { Check, Copy } from "lucide-react";
import { useState } from "react";

const CopyButton = ({ id }: { id: string }) => {
  const [copied, setCopied] = useState(false);
  const toast = useToast();

  const buttonBg = useColorModeValue("white", "gray.700");
  const buttonHoverBg = useColorModeValue("gray.50", "gray.600");
  const iconColor = useColorModeValue("gray.600", "gray.300");
  const successColor = useColorModeValue("green.500", "green.300");

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
        position: "top",
        variant: "subtle",
      });
      setTimeout(() => {
        setCopied(false);
      }, 1000);
    } catch (error) {
      console.error("Failed to copy text: ", error);
      toast({
        title: "Failed to copy",
        status: "error",
        duration: 2000,
        isClosable: true,
        position: "top",
        variant: "subtle",
      });
    }
  };

  return (
    <IconButton
      aria-label={copied ? "Copied" : "Copy"}
      icon={copied ? <Check size={16} /> : <Copy size={16} />}
      onClick={onCopy}
      size="sm"
      variant="ghost"
      bg={buttonBg}
      color={copied ? successColor : iconColor}
      borderRadius="lg"
      transition="all 0.2s"
      _hover={{
        bg: buttonHoverBg,
        transform: "translateY(-1px)",
      }}
      _active={{
        transform: "translateY(0)",
      }}
      position="relative"
      boxShadow={copied ? "sm" : "none"}
    />
  );
};

export default CopyButton;
