import {
  AlertDialog,
  AlertDialogBody,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogOverlay,
  Button,
  useColorModeValue,
  Text,
} from "@chakra-ui/react";
import React from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQueryClient } from "react-query";

import { type ApiError, UsersService } from "../../../client";
import useAuth from "../../../hooks/useAuth";
import useCustomToast from "../../../hooks/useCustomToast";

interface DeleteProps {
  isOpen: boolean;
  onClose: () => void;
}

const DeleteConfirmation = ({ isOpen, onClose }: DeleteProps) => {
  const queryClient = useQueryClient();
  const showToast = useCustomToast();
  const cancelRef = React.useRef<HTMLButtonElement | null>(null);
  const { logout, currentUser } = useAuth();

  const bgColor = useColorModeValue("white", "gray.800");
  const borderColor = useColorModeValue("gray.100", "gray.700");

  const {
    handleSubmit,
    formState: { isSubmitting },
  } = useForm();

  const deleteCurrentUser = async (id: number) => {
    await UsersService.deleteUser({ userId: id });
  };

  const mutation = useMutation(deleteCurrentUser, {
    onSuccess: () => {
      showToast(
        "Success",
        "Your account has been successfully deleted.",
        "success"
      );
      logout();
      onClose();
    },
    onError: (err: ApiError) => {
      const errDetail = err.body?.detail;
      showToast("Something went wrong.", `${errDetail}`, "error");
    },
    onSettled: () => {
      queryClient.invalidateQueries("currentUser");
    },
  });

  const onSubmit = async () => {
    mutation.mutate(currentUser!.id);
  };

  return (
    <AlertDialog
      isOpen={isOpen}
      onClose={onClose}
      leastDestructiveRef={cancelRef}
      size={{ base: "sm", md: "md" }}
      isCentered
      motionPreset="slideInBottom"
    >
      <AlertDialogOverlay bg="blackAlpha.300" backdropFilter="blur(10px)">
        <AlertDialogContent
          bg={bgColor}
          borderRadius="xl"
          boxShadow="xl"
          border="1px solid"
          borderColor={borderColor}
          as="form"
          onSubmit={handleSubmit(onSubmit)}
        >
          <AlertDialogHeader
            fontSize="lg"
            fontWeight="600"
            borderBottom="1px solid"
            borderColor={borderColor}
            py={4}
          >
            Confirmation Required
          </AlertDialogHeader>

          <AlertDialogBody py={6}>
            <Text color="gray.700" fontSize="sm" lineHeight="tall">
              All your account data will be <strong>permanently deleted</strong>. 
              If you are sure, please click <strong>Confirm</strong> to proceed. 
              This action cannot be undone.
            </Text>
          </AlertDialogBody>

          <AlertDialogFooter gap={3} borderTop="1px solid" borderColor={borderColor}>
            <Button
              variant="danger"
              type="submit"
              isLoading={isSubmitting}
              transition="all 0.2s"
              _hover={{
                transform: "translateY(-1px)",
                boxShadow: "md",
              }}
              _active={{
                transform: "translateY(0)",
              }}
            >
              Confirm
            </Button>
            <Button
              ref={cancelRef}
              onClick={onClose}
              isDisabled={isSubmitting}
              variant="ghost"
              transition="all 0.2s"
              _hover={{
                bg: "gray.100",
              }}
            >
              Cancel
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialogOverlay>
    </AlertDialog>
  );
};

export default DeleteConfirmation;
