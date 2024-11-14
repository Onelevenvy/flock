import {
  AlertDialog,
  AlertDialogBody,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogOverlay,
  Button,
  Text,
} from "@chakra-ui/react";
import React from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQueryClient } from "react-query";

import {
  ToolsService,
  TeamsService,
  UploadsService,
  UsersService,
} from "../../client";
import useCustomToast from "../../hooks/useCustomToast";

interface DeleteProps {
  type: string;
  id: number;
  isOpen: boolean;
  onClose: () => void;
}

const Delete = ({ type, id, isOpen, onClose }: DeleteProps) => {
  const queryClient = useQueryClient();
  const showToast = useCustomToast();
  const cancelRef = React.useRef<HTMLButtonElement | null>(null);
  const {
    handleSubmit,
    formState: { isSubmitting },
  } = useForm();

  const deleteEntity = async (id: number) => {
    if (type === "User") {
      await UsersService.deleteUser({ userId: id });
    } else if (type === "Team") {
      await TeamsService.deleteTeam({ id: id });
    } else if (type === "Skill") {
      await ToolsService.deleteSkill({ id: id });
    } else if (type === "Upload") {
      await UploadsService.deleteUpload({ id: id });
    } else {
      throw new Error(`Unexpected type: ${type}`);
    }
  };

  const mutation = useMutation(deleteEntity, {
    onSuccess: () => {
      if (type !== "Upload") {
        showToast(
          "Success",
          `The ${type.toLowerCase()} was deleted successfully.`,
          "success"
        );
      }
      onClose();
    },
    onError: () => {
      showToast(
        "An error occurred.",
        `An error occurred while deleting the ${type.toLowerCase()}.`,
        "error"
      );
    },
    onSettled: () => {
      queryClient.invalidateQueries(
        type === "User"
          ? "users"
          : type === "Team"
            ? "teams"
            : type === "Skill"
              ? "skills"
              : "uploads"
      );
    },
  });

  const onSubmit = async () => {
    mutation.mutate(id);
  };

  return (
    <AlertDialog
      isOpen={isOpen}
      onClose={onClose}
      leastDestructiveRef={cancelRef}
      size={{ base: "sm", md: "md" }}
      isCentered
    >
      <AlertDialogOverlay bg="blackAlpha.300" backdropFilter="blur(10px)">
        <AlertDialogContent
          as="form"
          onSubmit={handleSubmit(onSubmit)}
          borderRadius="xl"
          boxShadow="xl"
          p={4}
        >
          <AlertDialogHeader
            fontSize="lg"
            fontWeight="600"
            color="gray.800"
            pb={2}
          >
            Delete {type}
          </AlertDialogHeader>

          <AlertDialogBody py={4}>
            {type === "User" && (
              <Text color="gray.600" mb={2}>
                All items associated with this user will also be{" "}
                <Text as="span" fontWeight="600" color="red.500">
                  permanently deleted.
                </Text>
              </Text>
            )}
            <Text color="gray.700">
              Are you sure? You will not be able to undo this action.
            </Text>
          </AlertDialogBody>

          <AlertDialogFooter gap={3}>
            <Button
              colorScheme="red"
              type="submit"
              isLoading={isSubmitting || mutation.isLoading}
              borderRadius="lg"
              px={6}
              transition="all 0.2s"
              _hover={{
                transform: "translateY(-1px)",
                boxShadow: "md",
              }}
              _active={{
                transform: "translateY(0)",
              }}
            >
              Delete
            </Button>
            <Button
              ref={cancelRef}
              onClick={onClose}
              isDisabled={isSubmitting}
              variant="ghost"
              borderRadius="lg"
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

export default Delete;
