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
    <>
      <Modal
        size={size}
        isOpen={isOpen}
        onClose={onClose}
        closeOnOverlayClick={false}
      >
        <ModalOverlay />
        <ModalContent width={"1000px"}>
          {/* <ModalHeader /> */}
          <ModalCloseButton />
          <ModalBody width={"1000px"}>{component}</ModalBody>
          {/* <ModalFooter /> */}
        </ModalContent>
      </Modal>
    </>
  );
};

export default CustomModalWrapper;
