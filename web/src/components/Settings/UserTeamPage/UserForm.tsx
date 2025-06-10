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
  useColorModeValue,
} from "@chakra-ui/react";
import { type SubmitHandler, useForm } from "react-hook-form";
import { useMutation, useQueryClient } from "react-query";

import {
  type ApiError,
  type UserOut,
  type UserUpdate,
  type UserCreate,
  UsersService,
} from "@/client";
import useCustomToast from "@/hooks/useCustomToast";
import { emailPattern } from "@/utils";

interface UserFormProps {
  user?: UserOut;
  isOpen: boolean;
  onClose: () => void;
}

interface UserFormData extends Omit<UserCreate, "password"> {
  password?: string;
  confirm_password: string;
}

const UserForm = ({ user, isOpen, onClose }: UserFormProps) => {
  const isEditMode = !!user;
  const queryClient = useQueryClient();
  const showToast = useCustomToast();

  const bgColor = useColorModeValue("white", "gray.800");
  const borderColor = useColorModeValue("gray.100", "gray.700");
  const inputBgColor = useColorModeValue("ui.inputbgcolor", "gray.700");

  const defaultValues = isEditMode
    ? {
        ...user,
        password: "",
        confirm_password: "",
      }
    : {
        email: "",
        full_name: "",
        password: "",
        confirm_password: "",
        is_superuser: false,
        is_active: false,
      };

  const {
    register,
    handleSubmit,
    reset,
    getValues,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<UserFormData>({
    mode: "onBlur",
    criteriaMode: "all",
    defaultValues,
  });

  const createUser = async (data: UserCreate) => {
    await UsersService.createUser({ requestBody: data });
  };

  const updateUser = async (data: UserUpdate) => {
    if (!user) return;
    await UsersService.updateUser({ userId: user.id, requestBody: data });
  };

  const mutation = useMutation(isEditMode ? updateUser : createUser, {
    onSuccess: () => {
      showToast(
        "Success!",
        `User ${isEditMode ? "updated" : "created"} successfully.`,
        "success"
      );
      reset();
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

  const onSubmit: SubmitHandler<UserFormData> = async (data) => {
    const submitData = { ...data };
    if (isEditMode && submitData.password === "") {
      delete submitData.password;
    }
    mutation.mutate(submitData as UserCreate);
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
          {isEditMode ? "Edit User" : "Add User"}
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
            <FormControl isRequired={!isEditMode} isInvalid={!!errors.email}>
              <FormLabel
                fontSize="sm"
                fontWeight="500"
                color="gray.700"
              >
                Email
              </FormLabel>
              <Input
                {...register("email", {
                  required: !isEditMode && "Email is required",
                  pattern: emailPattern,
                })}
                placeholder="Email"
                type="email"
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
              {errors.email && (
                <FormErrorMessage>{errors.email.message}</FormErrorMessage>
              )}
            </FormControl>

            <FormControl>
              <FormLabel
                fontSize="sm"
                fontWeight="500"
                color="gray.700"
              >
                Full name
              </FormLabel>
              <Input
                {...register("full_name")}
                placeholder="Full name"
                type="text"
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

            <FormControl isRequired={!isEditMode} isInvalid={!!errors.password}>
              <FormLabel
                fontSize="sm"
                fontWeight="500"
                color="gray.700"
              >
                Password
              </FormLabel>
              <Input
                {...register("password", {
                  required: !isEditMode && "Password is required",
                  minLength: {
                    value: 8,
                    message: "Password must be at least 8 characters",
                  },
                })}
                placeholder="Password"
                type="password"
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
              {errors.password && (
                <FormErrorMessage>{errors.password.message}</FormErrorMessage>
              )}
            </FormControl>

            <FormControl isRequired={!isEditMode} isInvalid={!!errors.confirm_password}>
              <FormLabel
                fontSize="sm"
                fontWeight="500"
                color="gray.700"
              >
                Confirm Password
              </FormLabel>
              <Input
                {...register("confirm_password", {
                  required: !isEditMode && "Please confirm your password",
                  validate: (value) =>
                    !value ||
                    value === getValues().password ||
                    "The passwords do not match",
                })}
                placeholder="Confirm password"
                type="password"
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
              {errors.confirm_password && (
                <FormErrorMessage>
                  {errors.confirm_password.message}
                </FormErrorMessage>
              )}
            </FormControl>

            <Flex w="full" gap={8}>
              <FormControl>
                <Checkbox 
                  {...register("is_superuser")} 
                  colorScheme="blue"
                  size="lg"
                >
                  Is superuser?
                </Checkbox>
              </FormControl>
              <FormControl>
                <Checkbox 
                  {...register("is_active")} 
                  colorScheme="blue"
                  size="lg"
                >
                  Is active?
                </Checkbox>
              </FormControl>
            </Flex>
          </VStack>
        </ModalBody>

        <ModalFooter 
          borderTop="1px solid"
          borderColor={borderColor}
          gap={3}
        >
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

export default UserForm; 