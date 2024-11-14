"use client";

import {
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalOverlay,
} from "@chakra-ui/react";

const CustomModalWrapper = ({
  size,
  isOpen,
  onClose,
  component,
}: {
  size:
    | "xs"
    | "sm"
    | "md"
    | "lg"
    | "xl"
    | "2xl"
    | "3xl"
    | "4xl"
    | "5xl"
    | "6xl"
    | "full"
    | string;
  isOpen: boolean;
  onClose: () => void;
  component: React.ReactNode;
}) => {
  return (
    <Modal
      size={size}
      isOpen={isOpen}
      onClose={onClose}
      closeOnOverlayClick={false}
      motionPreset="slideInBottom"
    >
      <ModalOverlay 
        bg="blackAlpha.300" 
        backdropFilter="blur(10px)"
      />
      <ModalContent
        borderRadius="xl"
        boxShadow="xl"
        bg="white"
        overflow="hidden"
        mx={4}
        my={4}
        transition="all 0.2s"
      >
        <ModalCloseButton
          position="absolute"
          right={4}
          top={4}
          borderRadius="full"
          transition="all 0.2s"
          _hover={{
            bg: "gray.100",
            transform: "rotate(90deg)",
          }}
        />
        <ModalBody p={6}>
          {component}
        </ModalBody>
      </ModalContent>
    </Modal>
  );
};

export default CustomModalWrapper;
