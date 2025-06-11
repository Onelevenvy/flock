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
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
} from "@chakra-ui/react";
import { useForm, Controller, useFieldArray } from "react-hook-form";
import { useMutation, useQueryClient, useQuery } from "react-query";
import { Select as MultiSelect } from "chakra-react-select";
import { AddIcon, DeleteIcon } from "@chakra-ui/icons";
import {
  type ApiError,
  type UserOut,
  type UserUpdate,
  type GroupOut,
  type RoleOut,
  UsersService,
  GroupsService,
  RolesService,
} from "@/client";
import useCustomToast from "@/hooks/useCustomToast";
import { emailPattern } from "@/utils";
import { useEffect } from "react";

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

interface BaseUserFormData {
  email: string;
  full_name: string;
  is_superuser: boolean;
  is_active: boolean;
  groupRolePairs: GroupRolePair[];
}

interface CreateUserFormData extends BaseUserFormData {
  password: string;
  confirm_password: string;
}

interface UpdateUserFormData extends BaseUserFormData {
  password?: string;
  confirm_password?: string;
}

type UserFormData = CreateUserFormData | UpdateUserFormData;

interface ExtendedUserOut extends UserOut {
  roles: { id: number; name: string; group_id: number }[];
}

const DEFAULT_PASSWORD = "12345678";

const UserForm = ({ user, isOpen, onClose }: UserFormProps) => {
  const isEditMode = !!user;
  const queryClient = useQueryClient();
  const showToast = useCustomToast();

  const bgColor = useColorModeValue("white", "gray.800");
  const borderColor = useColorModeValue("gray.100", "gray.700");
  const inputBgColor = useColorModeValue("ui.inputbgcolor", "gray.700");

  // Fetch groups and roles
  const { data: groups } = useQuery<{ data: GroupOut[]; count: number }>(
    "groups",
    () => GroupsService.readGroups({ skip: 0, limit: 100 }),
  );

  const { data: roles } = useQuery<{ data: RoleOut[]; count: number }>(
    "roles",
    () => RolesService.readRoles({ skip: 0, limit: 100 }),
  );

  const getInitialGroupRolePairs = (): GroupRolePair[] => {
    if (!isEditMode || !user.groups) return [{ group: null, roles: [] }];

    return user.groups.map((g) => ({
      group: g.id ? { value: g.id, label: g.name } : null,
      roles: (user as ExtendedUserOut).roles
        .filter((r) => r.group_id === g.id)
        .map((r) => ({ value: r.id, label: r.name })),
    }));
  };

  const defaultValues = {
    email: isEditMode ? user.email : "",
    full_name: isEditMode ? user.full_name || "" : "",
    password: isEditMode ? undefined : DEFAULT_PASSWORD,
    confirm_password: isEditMode ? undefined : DEFAULT_PASSWORD,
    is_superuser: isEditMode ? !!user.is_superuser : false,
    is_active: isEditMode ? !!user.is_active : true,
    groupRolePairs: getInitialGroupRolePairs(),
  };

  const {
    register,
    handleSubmit,
    reset,
    getValues,
    control,
    watch,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<UserFormData>({
    mode: "onBlur",
    criteriaMode: "all",
    defaultValues: defaultValues as UserFormData,
    resolver: async (data) => {
      const errors: Record<string, any> = {};

      // Only validate email in create mode
      if (!isEditMode) {
        if (!data.email) {
          errors.email = { message: "Email is required" };
        } else if (!data.email.match(emailPattern.value)) {
          errors.email = { message: "Invalid email format" };
        }

        // Only validate password in create mode
        if (!data.password) {
          errors.password = { message: "Password is required" };
        } else if (data.password.length < 8) {
          errors.password = {
            message: "Password must be at least 8 characters",
          };
        }

        if (data.password !== data.confirm_password) {
          errors.confirm_password = { message: "The passwords do not match" };
        }
      }

      return {
        values: data,
        errors,
      };
    },
  });

  // Reset form when user changes or modal opens/closes
  useEffect(() => {
    if (isOpen) {
      const formValues = {
        email: isEditMode ? user.email : "",
        full_name: isEditMode ? user.full_name || "" : "",
        password: isEditMode ? undefined : DEFAULT_PASSWORD,
        confirm_password: isEditMode ? undefined : DEFAULT_PASSWORD,
        is_superuser: isEditMode ? !!user.is_superuser : false,
        is_active: isEditMode ? !!user.is_active : true,
        groupRolePairs: getInitialGroupRolePairs(),
      };

      reset(formValues as UserFormData);
    }
  }, [isOpen, user, reset, isEditMode]);

  const { fields, append, remove } = useFieldArray({
    control,
    name: "groupRolePairs",
  });

  const groupRolePairs = watch("groupRolePairs");

  const createUser = async (formData: UserFormData): Promise<UserOut> => {
    const groups: number[] = [];
    const roles: number[] = [];
    formData.groupRolePairs.forEach((pair) => {
      if (pair.group) {
        groups.push(pair.group.value);
        roles.push(...pair.roles.map((r) => r.value));
      }
    });

    return await UsersService.createUser({
      requestBody: {
        email: formData.email,
        full_name: formData.full_name,
        password: formData.password || DEFAULT_PASSWORD,
        groups,
        roles,
        is_superuser: formData.is_superuser,
        is_active: formData.is_active,
      },
    });
  };

  const updateUser = async (formData: UserFormData): Promise<UserOut> => {
    if (!user) throw new Error("No user data available for update");

    const groups: number[] = [];
    const roles: number[] = [];

    // 确保 groupRolePairs 存在且不为空
    if (formData.groupRolePairs && formData.groupRolePairs.length > 0) {
      formData.groupRolePairs.forEach((pair) => {
        if (pair.group) {
          groups.push(pair.group.value);
          if (pair.roles && pair.roles.length > 0) {
            roles.push(...pair.roles.map((r) => r.value));
          }
        }
      });
    }

    const updateData: UserUpdate = {
      full_name: formData.full_name,
      groups,
      roles,
    };

    try {
      const response = await UsersService.updateUser({
        userId: user.id,
        requestBody: updateData,
      });

      return response;
    } catch (error) {
      throw error;
    }
  };

  const mutation = useMutation<UserOut, ApiError, UserFormData>(
    isEditMode ? updateUser : createUser,
    {
      onSuccess: () => {
        showToast(
          "Success!",
          `User ${isEditMode ? "updated" : "created"} successfully.`,
          "success",
        );
        queryClient.invalidateQueries("users");
        onClose();
      },
      onError: (err: ApiError) => {
        console.error("Mutation error:", err);
        const errDetail = err.body?.detail;
        showToast("Something went wrong.", `${errDetail}`, "error");
      },
    },
  );

  const handleFormSubmit = async (data: UserFormData) => {
    try {
      if (isEditMode) {
        // 编辑模式下，不发送密码字段
        const { password, confirm_password, ...updateData } = data;
        await mutation.mutateAsync(updateData as UserFormData);
      } else {
        await mutation.mutateAsync(data);
      }
    } catch (error) {
      console.error("Error submitting form:", error);
    }
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
        noValidate
        onSubmit={handleSubmit(handleFormSubmit)}
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
              <FormLabel fontSize="sm" fontWeight="500" color="gray.700">
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
                  borderColor: isEditMode ? borderColor : "gray.300",
                }}
                _focus={{
                  borderColor: isEditMode ? borderColor : "ui.main",
                  boxShadow: isEditMode
                    ? "none"
                    : "0 0 0 1px var(--chakra-colors-ui-main)",
                }}
                isReadOnly={isEditMode}
                opacity={isEditMode ? 0.6 : 1}
                _readOnly={{
                  bg: "gray.100",
                  cursor: "not-allowed",
                }}
              />
              {errors.email && (
                <FormErrorMessage>{errors.email.message}</FormErrorMessage>
              )}
            </FormControl>

            <FormControl>
              <FormLabel fontSize="sm" fontWeight="500" color="gray.700">
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

            {!isEditMode && (
              <>
                <FormControl isRequired isInvalid={!!errors.password}>
                  <FormLabel fontSize="sm" fontWeight="500" color="gray.700">
                    Password
                  </FormLabel>
                  <Input
                    {...register("password", {
                      required: "Password is required",
                      minLength: {
                        value: 8,
                        message: "Password must be at least 8 characters",
                      },
                    })}
                    placeholder="Password"
                    type="password"
                    defaultValue={DEFAULT_PASSWORD}
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
                    <FormErrorMessage>
                      {errors.password.message}
                    </FormErrorMessage>
                  )}
                  {!errors.password && (
                    <Text fontSize="xs" color="gray.500" mt={1}>
                      默认密码为：12345678
                    </Text>
                  )}
                </FormControl>

                <FormControl isRequired isInvalid={!!errors.confirm_password}>
                  <FormLabel fontSize="sm" fontWeight="500" color="gray.700">
                    Confirm Password
                  </FormLabel>
                  <Input
                    {...register("confirm_password", {
                      required: "Please confirm your password",
                      validate: (value) =>
                        value === getValues().password ||
                        "The passwords do not match",
                    })}
                    placeholder="Confirm password"
                    type="password"
                    defaultValue={DEFAULT_PASSWORD}
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
              </>
            )}

            <Box w="full">
              <FormLabel fontSize="sm" fontWeight="500" color="gray.700" mb={4}>
                Groups and Roles
              </FormLabel>
              <Table variant="simple" size="sm" mb={4}>
                <Thead>
                  <Tr>
                    <Th width="40%">Group</Th>
                    <Th width="50%">Roles</Th>
                    <Th width="10%">Action</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {fields.map((field, index) => (
                    <Tr key={field.id}>
                      <Td>
                        <Controller
                          name={`groupRolePairs.${index}.group`}
                          control={control}
                          render={({ field: { onChange, value } }) => (
                            <MultiSelect
                              value={value}
                              onChange={(newValue: SelectOption | null) => {
                                onChange(newValue);
                                // Reset roles when group changes
                                const currentPairs =
                                  getValues("groupRolePairs");
                                currentPairs[index].roles = [];
                                // Update the form
                                reset({
                                  ...getValues(),
                                  groupRolePairs: currentPairs,
                                });
                              }}
                              options={groups?.data
                                .filter(
                                  (g) =>
                                    !groupRolePairs.some(
                                      (pair, i) =>
                                        i !== index &&
                                        pair.group?.value === g.id,
                                    ),
                                )
                                .map((group) => ({
                                  value: group.id,
                                  label: group.name,
                                }))}
                              placeholder="Select group"
                              isClearable={false}
                            />
                          )}
                        />
                      </Td>
                      <Td>
                        <Controller
                          name={`groupRolePairs.${index}.roles`}
                          control={control}
                          render={({ field: { onChange, value } }) => (
                            <MultiSelect
                              value={value}
                              onChange={onChange}
                              isMulti
                              options={roles?.data
                                .filter(
                                  (role) =>
                                    field.group &&
                                    role.group_id === field.group.value,
                                )
                                .map((role) => ({
                                  value: role.id,
                                  label: role.name,
                                }))}
                              placeholder="Select roles"
                              isDisabled={!field.group}
                            />
                          )}
                        />
                      </Td>
                      <Td>
                        <IconButton
                          aria-label="Remove group-role pair"
                          icon={<DeleteIcon />}
                          variant="ghost"
                          colorScheme="red"
                          size="sm"
                          isDisabled={fields.length === 1}
                          onClick={() => remove(index)}
                        />
                      </Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
              <Button
                leftIcon={<AddIcon />}
                variant="ghost"
                size="sm"
                onClick={() => append({ group: null, roles: [] })}
                isDisabled={groupRolePairs.some((pair) => !pair.group)}
              >
                Add Group
              </Button>
            </Box>

            {!isEditMode && (
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
            )}
          </VStack>
        </ModalBody>

        <ModalFooter borderTop="1px solid" borderColor={borderColor} gap={3}>
          <Button
            variant="primary"
            type="submit"
            isLoading={isSubmitting || mutation.isLoading}
            loadingText={isEditMode ? "Saving..." : "Creating..."}
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
            onClick={() => {
              reset();
              onClose();
            }}
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
