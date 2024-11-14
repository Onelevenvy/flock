import {
  Button,
  Checkbox,
  Flex,
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
} from "@chakra-ui/react";
import { type SubmitHandler, useForm } from "react-hook-form";
import { useMutation, useQueryClient } from "react-query";

import {
  type ApiError,
  type UserOut,
  type UserUpdate,
  UsersService,
} from "../../client";
import useCustomToast from "../../hooks/useCustomToast";
import { emailPattern } from "../../utils";

interface EditUserProps {
  user: UserOut;
  isOpen: boolean;
  onClose: () => void;
}

interface UserUpdateForm extends UserUpdate {
  confirm_password: string;
}

const EditUser = ({ user, isOpen, onClose }: EditUserProps) => {
  const queryClient = useQueryClient();
  const showToast = useCustomToast();

  const {
    register,
    handleSubmit,
    reset,
    getValues,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<UserUpdateForm>({
    mode: "onBlur",
    criteriaMode: "all",
    defaultValues: user,
  });

  const updateUser = async (data: UserUpdateForm) => {
    await UsersService.updateUser({ userId: user.id, requestBody: data });
  };

  const mutation = useMutation(updateUser, {
    onSuccess: () => {
      showToast("Success!", "User updated successfully.", "success");
      onClose();
    },
    onError: (err: ApiError) => {
      const errDetail = err.body?.detail;
      showToast("Something went wrong.", `${errDetail}`, "error");
    },
    onSettled: () => {
      queryClient.invalidateQueries("users");
    },
  });

  const onSubmit: SubmitHandler<UserUpdateForm> = async (data) => {
    if (data.password === "") {
      data.password = undefined;
    }
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
    >
      <ModalOverlay bg="blackAlpha.300" backdropFilter="blur(10px)" />
      <ModalContent
        as="form"
        onSubmit={handleSubmit(onSubmit)}
        borderRadius="xl"
        boxShadow="xl"
      >
        <ModalHeader 
          borderBottom="1px solid" 
          borderColor="gray.100"
          py={4}
        >
          Edit User
        </ModalHeader>
        <ModalCloseButton 
          top={4}
          transition="all 0.2s"
          _hover={{
            bg: "gray.100",
            transform: "rotate(90deg)",
          }}
        />

        <ModalBody py={6}>
          <VStack spacing={4}>
            <FormControl isInvalid={!!errors.email}>
              <FormLabel color="gray.700">Email</FormLabel>
              <Input
                {...register("email", {
                  required: "Email is required",
                  pattern: emailPattern,
                })}
                placeholder="Email"
                type="email"
                bg="white"
                borderColor="gray.200"
                transition="all 0.2s"
                _hover={{
                  borderColor: "gray.300",
                }}
                _focus={{
                  borderColor: "blue.500",
                  boxShadow: "0 0 0 1px var(--chakra-colors-blue-500)",
                }}
              />
              {errors.email && (
                <FormErrorMessage>{errors.email.message}</FormErrorMessage>
              )}
            </FormControl>

            <FormControl>
              <FormLabel color="gray.700">Full name</FormLabel>
              <Input
                {...register("full_name")}
                placeholder="Full name"
                type="text"
                bg="white"
                borderColor="gray.200"
                transition="all 0.2s"
                _hover={{
                  borderColor: "gray.300",
                }}
                _focus={{
                  borderColor: "blue.500",
                  boxShadow: "0 0 0 1px var(--chakra-colors-blue-500)",
                }}
              />
            </FormControl>

            <FormControl isInvalid={!!errors.password}>
              <FormLabel color="gray.700">Password</FormLabel>
              <Input
                {...register("password", {
                  minLength: {
                    value: 8,
                    message: "Password must be at least 8 characters",
                  },
                })}
                placeholder="Leave blank to keep current password"
                type="password"
                bg="white"
                borderColor="gray.200"
                transition="all 0.2s"
                _hover={{
                  borderColor: "gray.300",
                }}
                _focus={{
                  borderColor: "blue.500",
                  boxShadow: "0 0 0 1px var(--chakra-colors-blue-500)",
                }}
              />
              {errors.password && (
                <FormErrorMessage>{errors.password.message}</FormErrorMessage>
              )}
            </FormControl>

            <FormControl isInvalid={!!errors.confirm_password}>
              <FormLabel color="gray.700">Confirm Password</FormLabel>
              <Input
                {...register("confirm_password", {
                  validate: (value) =>
                    !getValues().password ||
                    value === getValues().password ||
                    "The passwords do not match",
                })}
                placeholder="Confirm new password"
                type="password"
                bg="white"
                borderColor="gray.200"
                transition="all 0.2s"
                _hover={{
                  borderColor: "gray.300",
                }}
                _focus={{
                  borderColor: "blue.500",
                  boxShadow: "0 0 0 1px var(--chakra-colors-blue-500)",
                }}
              />
              {errors.confirm_password && (
                <FormErrorMessage>
                  {errors.confirm_password.message}
                </FormErrorMessage>
              )}
            </FormControl>

            <Flex w="full" gap={8}>
              <Checkbox
                {...register("is_superuser")}
                colorScheme="blue"
                size="lg"
              >
                Is superuser
              </Checkbox>
              <Checkbox
                {...register("is_active")}
                colorScheme="blue"
                size="lg"
              >
                Is active
              </Checkbox>
            </Flex>
          </VStack>
        </ModalBody>

        <ModalFooter 
          borderTop="1px solid" 
          borderColor="gray.100"
          gap={3}
          py={4}
        >
          <Button
            type="submit"
            colorScheme="blue"
            isLoading={isSubmitting}
            isDisabled={!isDirty}
            loadingText="Saving..."
            transition="all 0.2s"
            _hover={{
              transform: "translateY(-1px)",
              boxShadow: "md",
            }}
          >
            Save
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

export default EditUser;
