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
import { useTranslation } from "react-i18next";

interface ImageUploadModalProps {
  onImageSelect: (imageData: string) => void;
}

const ImageUploadModal = ({ onImageSelect }: ImageUploadModalProps) => {
  const { t } = useTranslation();
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
      setUrlError(
        t("components.imageUpload.imageUrl.error.required") as string
      );
      return;
    }

    if (!isValidUrl(imageUrl)) {
      setUrlError(t("components.imageUpload.imageUrl.error.format") as string);
      return;
    }

    try {
      const response = await fetch(imageUrl);
      if (!response.ok)
        throw new Error(
          t("components.imageUpload.imageUrl.error.loading") as string
        );

      const blob = await response.blob();
      if (!blob.type.startsWith("image/")) {
        throw new Error(
          t("components.imageUpload.imageUrl.error.notImage") as string
        );
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        onImageSelect(reader.result as string);
        setImageUrl("");
      };
      reader.readAsDataURL(blob);
    } catch (error) {
      setUrlError(t("components.imageUpload.imageUrl.error.invalid") as string);
      toast({
        title: t("components.imageUpload.imageUrl.error.loading"),
        description: t("components.imageUpload.imageUrl.error.notImage"),
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
              {t("components.imageUpload.warning")}
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
              {t("components.imageUpload.localUpload")}
            </Button>
            <input
              type="file"
              id="modal-file-input"
              accept="image/*"
              style={{ display: "none" }}
              onChange={handleFileChange}
            />

            <Text fontSize="sm" color="gray.500">
              {t("components.imageUpload.or")}
            </Text>

            <FormControl isInvalid={!!urlError}>
              <InputGroup size="sm">
                <Input
                  placeholder={
                    t("components.imageUpload.imageUrl.placeholder") as string
                  }
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
                    {t("components.imageUpload.imageUrl.add")}
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
