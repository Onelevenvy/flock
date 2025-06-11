import {
  Button,
  FormControl,
  FormErrorMessage,
  FormLabel,
  Input,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  VStack,
  useColorModeValue,
} from "@chakra-ui/react";
import { type SubmitHandler, useForm } from "react-hook-form";
import { useMutation, useQueryClient } from "react-query";
import { useEffect } from "react";

import { type RoleCreate, type RoleOut, RolesService } from "@/client";
import type { ApiError } from "@/client/core/ApiError";
import useCustomToast from "@/hooks/useCustomToast";

interface RoleFormProps {
  role?: RoleOut;
  groupId: number;
  isOpen: boolean;
  onClose: () => void;
}

const RoleForm = ({ role, groupId, isOpen, onClose }: RoleFormProps) => {
  const isEditMode = !!role;
  const queryClient = useQueryClient();
  const showToast = useCustomToast();

  // console.log('RoleForm - Current groupId:', groupId);

  const bgColor = useColorModeValue("white", "gray.800");
  const borderColor = useColorModeValue("gray.100", "gray.700");
  const inputBgColor = useColorModeValue("ui.inputbgcolor", "gray.700");

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<RoleCreate>({
    mode: "onBlur",
    defaultValues: isEditMode
      ? {
          name: role.name,
          description: role.description || "",
          is_system_role: role.is_system_role,
          group_id: role.group_id,
        }
      : {
          name: "",
          description: "",
          is_system_role: false,
          group_id: groupId,
        },
  });

  useEffect(() => {
    setValue("group_id", groupId);
  }, [groupId, setValue]);

  const createRole = async (data: RoleCreate) => {
    // console.log('Creating role with data:', data);
    await RolesService.createRole({
      requestBody: { ...data, group_id: groupId },
    });
  };

  const updateRole = async (data: RoleCreate) => {
    if (!role) return;
    await RolesService.updateRole({ roleId: role.id, requestBody: data });
  };

  const mutation = useMutation(isEditMode ? updateRole : createRole, {
    onSuccess: () => {
      showToast(
        "Success!",
        `Role ${isEditMode ? "updated" : "created"} successfully.`,
        "success",
      );
      reset();
      onClose();
    },
    onError: (err: ApiError) => {
      const errDetail = err.body?.detail;
      showToast("Something went wrong.", `${errDetail}`, "error");
    },
    onSettled: () => {
      queryClient.invalidateQueries("roles");
    },
  });

  const onSubmit: SubmitHandler<RoleCreate> = (data) => {
    mutation.mutate(data);
  };

  const onCancel = () => {
    reset();
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size={{ base: "sm", md: "md" }}
      isCentered
      motionPreset="slideInBottom"
    >
      <ModalOverlay bg="blackAlpha.300" backdropFilter="blur(10px)" />
      <ModalContent
        bg={bgColor}
        borderRadius="xl"
        boxShadow="xl"
        border="1px solid"
        borderColor={borderColor}
        as="form"
        onSubmit={handleSubmit(onSubmit)}
      >
        <ModalHeader
          borderBottom="1px solid"
          borderColor={borderColor}
          py={4}
          fontSize="lg"
          fontWeight="600"
        >
          {isEditMode ? "Edit Role" : "Add Role"}
        </ModalHeader>

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

        <ModalBody py={6}>
          <VStack spacing={6}>
            <FormControl isRequired isInvalid={!!errors.name}>
              <FormLabel fontSize="sm" fontWeight="500" color="gray.700">
                Role Name
              </FormLabel>
              <Input
                {...register("name", {
                  required: "Role name is required",
                })}
                placeholder="Enter role name"
                bg={inputBgColor}
                border="1px solid"
                borderColor={borderColor}
                borderRadius="lg"
                fontSize="sm"
                transition="all 0.2s"
                _hover={{
                  borderColor: "gray.300",
                }}
                _focus={{
                  borderColor: "ui.main",
                  boxShadow: "0 0 0 1px var(--chakra-colors-ui-main)",
                }}
              />
              {errors.name && (
                <FormErrorMessage>{errors.name.message}</FormErrorMessage>
              )}
            </FormControl>

            <FormControl>
              <FormLabel fontSize="sm" fontWeight="500" color="gray.700">
                Description
              </FormLabel>
              <Input
                {...register("description")}
                placeholder="Enter role description"
                bg={inputBgColor}
                border="1px solid"
                borderColor={borderColor}
                borderRadius="lg"
                fontSize="sm"
                transition="all 0.2s"
                _hover={{
                  borderColor: "gray.300",
                }}
                _focus={{
                  borderColor: "ui.main",
                  boxShadow: "0 0 0 1px var(--chakra-colors-ui-main)",
                }}
              />
            </FormControl>
          </VStack>
        </ModalBody>

        <ModalFooter borderTop="1px solid" borderColor={borderColor} gap={3}>
          <Button
            variant="primary"
            type="submit"
            isLoading={isSubmitting}
            isDisabled={isEditMode && !isDirty}
            transition="all 0.2s"
            _hover={{
              transform: "translateY(-1px)",
              boxShadow: "md",
            }}
            _active={{
              transform: "translateY(0)",
            }}
          >
            {isEditMode ? "Save Changes" : "Create"}
          </Button>
          <Button
            onClick={onCancel}
            variant="ghost"
            transition="all 0.2s"
            _hover={{
              bg: "gray.100",
            }}
          >
            Cancel
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default RoleForm;
