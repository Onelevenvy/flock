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
  Box,
  Text,
  IconButton,
  HStack,
} from "@chakra-ui/react";
import { type SubmitHandler, useForm, Controller, useFieldArray } from "react-hook-form";
import { useMutation, useQueryClient, useQuery } from "react-query";
import { Select as MultiSelect } from "chakra-react-select";
import { AddIcon, DeleteIcon } from "@chakra-ui/icons";
import {
  type ApiError,
  type UserOut,
  type UserUpdate,
  type UserCreate,
  type GroupOut,
  type RoleOut,
  UsersService,
  GroupsService,
  RolesService,
} from "@/client";
import useCustomToast from "@/hooks/useCustomToast";
import { emailPattern } from "@/utils";

interface UserFormProps {
  user?: UserOut;
  isOpen: boolean;
  onClose: () => void;
}

interface SelectOption {
  value: number;
  label: string;
}

interface GroupRolePair {
  group: SelectOption | null;
  roles: SelectOption[];
}

interface UserFormData extends Omit<UserCreate, "password"> {
  password?: string;
  confirm_password: string;
  groupRolePairs: GroupRolePair[];
}

interface ExtendedUserOut extends UserOut {
  roles?: { id: number; name: string; group_id: number }[];
}

const UserForm = ({ user, isOpen, onClose }: UserFormProps) => {
  const isEditMode = !!user;
  const queryClient = useQueryClient();
  const showToast = useCustomToast();

  const bgColor = useColorModeValue("white", "gray.800");
  const borderColor = useColorModeValue("gray.100", "gray.700");
  const inputBgColor = useColorModeValue("ui.inputbgcolor", "gray.700");

  // Fetch groups and roles
  const { data: groups } = useQuery<{ data: GroupOut[]; count: number }>("groups", () =>
    GroupsService.readGroups({ skip: 0, limit: 100 })
  );

  const { data: roles } = useQuery<{ data: RoleOut[]; count: number }>("roles", () =>
    RolesService.readRoles({ skip: 0, limit: 100 })
  );

  const defaultValues = isEditMode
    ? {
        ...user,
        password: "",
        confirm_password: "",
        groupRolePairs: user.groups ? 
          (user.groups as unknown as Array<{ id: number; name: string }>).map(g => ({
            group: { value: g.id, label: g.name },
            roles: (user as ExtendedUserOut).roles
              ?.filter(r => r.group_id === g.id)
              .map(r => ({ value: r.id, label: r.name })) || []
          })) : 
          [{ group: null, roles: [] }]
      }
    : {
        email: "",
        full_name: "",
        password: "",
        confirm_password: "",
        is_superuser: false,
        is_active: false,
        groupRolePairs: [{ group: null, roles: [] }]
      };

  const {
    register,
    handleSubmit,
    reset,
    getValues,
    control,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<UserFormData>({
    mode: "onBlur",
    criteriaMode: "all",
    defaultValues,
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "groupRolePairs"
  });

  const createUser = async (formData: UserFormData) => {
    const groups: number[] = [];
    const roles: number[] = [];
    formData.groupRolePairs.forEach(pair => {
      if (pair.group) {
        groups.push(pair.group.value);
        roles.push(...pair.roles.map(r => r.value));
      }
    });

    const data = {
      ...formData,
      groups,
      roles,
      password: formData.password || "",
    } as UserCreate;
    await UsersService.createUser({ requestBody: data });
  };

  const updateUser = async (formData: UserFormData) => {
    if (!user) return;
    const groups: number[] = [];
    const roles: number[] = [];
    formData.groupRolePairs.forEach(pair => {
      if (pair.group) {
        groups.push(pair.group.value);
        roles.push(...pair.roles.map(r => r.value));
      }
    });

    const data = {
      ...formData,
      groups,
      roles,
    } as UserUpdate;
    if (data.password === "") {
      delete (data as any).password;
    }
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
      submitData.password = undefined;
    }
    mutation.mutate(submitData);
  };

  const onCancel = () => {
    reset();
    onClose();
  };

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      size={{ base: "sm", md: "xl" }}
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

            <Box w="full">
              <FormLabel
                fontSize="sm"
                fontWeight="500"
                color="gray.700"
              >
                Groups and Roles
              </FormLabel>
              <VStack spacing={4} align="stretch">
                {fields.map((field, index) => (
                  <HStack key={field.id} spacing={4} align="flex-start">
                    <FormControl flex={1}>
                      <Controller
                        name={`groupRolePairs.${index}.group`}
                        control={control}
                        render={({ field: { onChange, value } }) => (
                          <MultiSelect
                            value={value}
                            onChange={onChange}
                            options={groups?.data.map(group => ({
                              value: group.id,
                              label: group.name
                            }))}
                            placeholder="Select group"
                            isClearable={false}
                          />
                        )}
                      />
                    </FormControl>
                    <FormControl flex={2}>
                      <Controller
                        name={`groupRolePairs.${index}.roles`}
                        control={control}
                        render={({ field: { onChange, value } }) => (
                          <MultiSelect
                            value={value}
                            onChange={onChange}
                            isMulti
                            options={roles?.data
                              .filter(role => field.group && role.group_id === field.group.value)
                              .map(role => ({
                                value: role.id,
                                label: role.name
                              }))}
                            placeholder="Select roles"
                            isDisabled={!field.group}
                          />
                        )}
                      />
                    </FormControl>
                    <IconButton
                      aria-label="Remove group-role pair"
                      icon={<DeleteIcon />}
                      variant="ghost"
                      colorScheme="red"
                      isDisabled={fields.length === 1}
                      onClick={() => remove(index)}
                    />
                  </HStack>
                ))}
              </VStack>
              <Button
                leftIcon={<AddIcon />}
                variant="ghost"
                size="sm"
                mt={2}
                onClick={() => append({ group: null, roles: [] })}
              >
                Add Group
              </Button>
            </Box>

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