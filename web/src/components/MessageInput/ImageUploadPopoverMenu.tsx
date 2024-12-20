import {
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverBody,
  Button,
  Input,
  VStack,
  InputGroup,
  InputRightElement,
  useToast,
  FormControl,
  FormErrorMessage,
  Text,
  Alert,
  AlertIcon,
} from "@chakra-ui/react";
import { useState } from "react";
import { RiImageAddLine, RiUploadCloud2Line } from "react-icons/ri";

interface ImageUploadModalProps {
  onImageSelect: (imageData: string) => void;
}

const ImageUploadModal = ({ onImageSelect }: ImageUploadModalProps) => {
  const [imageUrl, setImageUrl] = useState("");
  const [urlError, setUrlError] = useState("");
  const toast = useToast();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        onImageSelect(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
    e.target.value = "";
  };

  const isValidUrl = (url: string) => {
    return /^https?:\/\/.+/.test(url);
  };

  const validateAndLoadUrl = async () => {
    if (!imageUrl) {
      setUrlError("请输入URL地址");
      return;
    }

    if (!isValidUrl(imageUrl)) {
      setUrlError("URL必须以http://或https://开头");
      return;
    }

    try {
      const response = await fetch(imageUrl);
      if (!response.ok) throw new Error("图片加载失败");

      const blob = await response.blob();
      if (!blob.type.startsWith("image/")) {
        throw new Error("请输入有效的图片URL");
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        onImageSelect(reader.result as string);
        setImageUrl("");
      };
      reader.readAsDataURL(blob);
    } catch (error) {
      setUrlError("无效的图片URL");
      toast({
        title: "图片加载失败",
        description: "请确保输入的是有效的图片URL",
        status: "error",
        duration: 3000,
        isClosable: true,
      });
    }
  };

  return (
    <Popover placement="top-end">
      <PopoverTrigger>
        <Button
          leftIcon={<RiImageAddLine />}
          size="sm"
          variant="ghost"
          aria-label="upload-image"
          transition="all 0.2s"
          _hover={{
            transform: "translateY(-1px)",
            bg: "gray.100",
          }}
        />
      </PopoverTrigger>
      <PopoverContent width="300px">
        <PopoverBody p={4}>
          <VStack spacing={4}>
            <Alert status="info">
              <AlertIcon />
              Please make sure your llm supports image input!
            </Alert>
            <Button
              leftIcon={<RiUploadCloud2Line />}
              onClick={() =>
                document.getElementById("modal-file-input")?.click()
              }
              w="full"
              colorScheme="blue"
              variant="outline"
              size="sm"
            >
              本地上传
            </Button>
            <input
              type="file"
              id="modal-file-input"
              accept="image/*"
              style={{ display: "none" }}
              onChange={handleFileChange}
            />

            <Text fontSize="sm" color="gray.500">
              或
            </Text>

            <FormControl isInvalid={!!urlError}>
              <InputGroup size="sm">
                <Input
                  placeholder="输入图片链接"
                  value={imageUrl}
                  onChange={(e) => {
                    setImageUrl(e.target.value);
                    setUrlError("");
                  }}
                  pr="4.5rem"
                />
                <InputRightElement width="4.5rem">
                  <Button
                    h="1.4rem"
                    size="xs"
                    colorScheme="blue"
                    onClick={validateAndLoadUrl}
                    isDisabled={!imageUrl.trim()}
                  >
                    添加
                  </Button>
                </InputRightElement>
              </InputGroup>
              <FormErrorMessage>{urlError}</FormErrorMessage>
            </FormControl>
          </VStack>
        </PopoverBody>
      </PopoverContent>
    </Popover>
  );
};

export default ImageUploadModal;
