import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
  Button,
  Input,
  VStack,
  HStack,
  Text,
  useToast,
  FormControl,
  FormErrorMessage,
} from "@chakra-ui/react";
import { useState } from "react";
import { RiImageAddLine, RiLink } from "react-icons/ri";

interface ImageUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImageSelect: (imageData: string) => void;
}

const ImageUploadModal = ({ isOpen, onClose, onImageSelect }: ImageUploadModalProps) => {
  const [imageUrl, setImageUrl] = useState("");
  const [urlError, setUrlError] = useState("");
  const toast = useToast();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        onImageSelect(reader.result as string);
        onClose();
      };
      reader.readAsDataURL(file);
    }
    e.target.value = "";
  };

  const validateAndLoadUrl = async () => {
    if (!imageUrl) {
      setUrlError("请输入URL地址");
      return;
    }

    try {
      const response = await fetch(imageUrl);
      if (!response.ok) throw new Error("图片加载失败");
      
      const blob = await response.blob();
      if (!blob.type.startsWith('image/')) {
        throw new Error("请输入有效的图片URL");
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        onImageSelect(reader.result as string);
        onClose();
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
    <Modal isOpen={isOpen} onClose={onClose} isCentered>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>添加图片</ModalHeader>
        <ModalCloseButton />
        <ModalBody pb={6}>
          <VStack spacing={4}>
            <HStack w="full" spacing={4}>
              <Button
                leftIcon={<RiImageAddLine />}
                onClick={() => document.getElementById("modal-file-input")?.click()}
                flex={1}
                colorScheme="blue"
                variant="outline"
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
            </HStack>

            <Text>或</Text>

            <FormControl isInvalid={!!urlError}>
              <Input
                placeholder="输入图片URL"
                value={imageUrl}
                onChange={(e) => {
                  setImageUrl(e.target.value);
                  setUrlError("");
                }}
              />
              <FormErrorMessage>{urlError}</FormErrorMessage>
            </FormControl>

            <Button
              leftIcon={<RiLink />}
              onClick={validateAndLoadUrl}
              w="full"
              colorScheme="blue"
            >
              通过URL添加
            </Button>
          </VStack>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
};

export default ImageUploadModal; 