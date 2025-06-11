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
  Select,
} from "@chakra-ui/react";
import { type SubmitHandler, useForm } from "react-hook-form";
import { useMutation, useQueryClient, useQuery } from "react-query";

import {
  type GroupCreate,
  type GroupOut,
  GroupsService,
  UsersService,
} from "@/client";
import type { ApiError } from "@/client/core/ApiError";
import useCustomToast from "@/hooks/useCustomToast";

interface GroupFormProps {
  group?: GroupOut;
  isOpen: boolean;
  onClose: () => void;
}

const GroupForm = ({ group, isOpen, onClose }: GroupFormProps) => {
  const isEditMode = !!group;
  const queryClient = useQueryClient();
  const showToast = useCustomToast();

  const bgColor = useColorModeValue("white", "gray.800");
  const borderColor = useColorModeValue("gray.100", "gray.700");
  const inputBgColor = useColorModeValue("ui.inputbgcolor", "gray.700");

  // Fetch users for admin selection
  const { data: users } = useQuery("users", () => UsersService.readUsers({}), {
    enabled: isOpen,
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<GroupCreate>({
    mode: "onBlur",
    defaultValues: isEditMode
      ? {
          name: group.name,
          description: group.description,
          is_system_group: group.is_system_group,
          admin_id: group.admin_id,
        }
      : {
          name: "",
          description: "",
          is_system_group: false,
          admin_id: undefined,
        },
  });

  const createGroup = async (data: GroupCreate) => {
    await GroupsService.createGroup({ requestBody: data });
  };

  const updateGroup = async (data: GroupCreate) => {
    if (!group) return;
    await GroupsService.updateGroup({ groupId: group.id, requestBody: data });
  };

  const mutation = useMutation(isEditMode ? updateGroup : createGroup, {
    onSuccess: () => {
      showToast(
        "Success!",
        `Group ${isEditMode ? "updated" : "created"} successfully.`,
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
      queryClient.invalidateQueries("groups");
    },
  });

  const onSubmit: SubmitHandler<GroupCreate> = (data) => {
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
          {isEditMode ? "Edit Group" : "Add Group"}
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
                Group Name
              </FormLabel>
              <Input
                {...register("name", {
                  required: "Group name is required",
                })}
                placeholder="Enter group name"
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
                placeholder="Enter group description"
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

            <FormControl isRequired>
              <FormLabel fontSize="sm" fontWeight="500" color="gray.700">
                Group Admin
              </FormLabel>
              <Select
                {...register("admin_id", {
                  required: "Group admin is required",
                  valueAsNumber: true,
                })}
                placeholder="Select group admin"
                bg={inputBgColor}
                border="1px solid"
                borderColor={borderColor}
                borderRadius="lg"
                fontSize="sm"
              >
                {users?.data.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.full_name || user.email}
                  </option>
                ))}
              </Select>
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

export default GroupForm;
