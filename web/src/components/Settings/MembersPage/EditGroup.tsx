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
  Checkbox,
  Tabs,
  TabList,
  Tab,
  TabPanels,
  TabPanel,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Switch,
} from "@chakra-ui/react";
import { type SubmitHandler, useForm } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "react-query";

import { type GroupUpdate, type GroupOut, GroupsService, ResourcesService } from "@/client";
import type { ApiError } from "@/client/core/ApiError";
import useCustomToast from "@/hooks/useCustomToast";

interface EditGroupProps {
  group: GroupOut;
  isOpen: boolean;
  onClose: () => void;
}

const EditGroup = ({ group, isOpen, onClose }: EditGroupProps) => {
  const queryClient = useQueryClient();
  const showToast = useCustomToast();

  const bgColor = useColorModeValue("white", "gray.800");
  const borderColor = useColorModeValue("gray.100", "gray.700");
  const inputBgColor = useColorModeValue("ui.inputbgcolor", "gray.700");

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<GroupUpdate>({
    mode: "onBlur",
    defaultValues: {
      name: group.name,
      description: group.description,
      is_system_group: group.is_system_group,
    },
  });

  // Fetch resources for permissions tab
  const { data: resources } = useQuery(
    "resources",
    () => ResourcesService.readResources({}),
    {
      enabled: isOpen,
    }
  );

  const updateGroup = async (data: GroupUpdate) => {
    await GroupsService.updateGroup({ groupId: group.id, requestBody: data });
  };

  const mutation = useMutation(updateGroup, {
    onSuccess: () => {
      showToast("Success!", "Group updated successfully.", "success");
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

  const onSubmit: SubmitHandler<GroupUpdate> = (data) => {
    mutation.mutate(data);
  };

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      size="xl"
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
        maxH="90vh"
        overflowY="auto"
      >
        <ModalHeader 
          borderBottom="1px solid"
          borderColor={borderColor}
          py={4}
          fontSize="lg"
          fontWeight="600"
        >
          Edit Group: {group.name}
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

        <Tabs>
          <TabList px={6} pt={4}>
            <Tab>Basic Info</Tab>
            <Tab>Permissions</Tab>
            <Tab>Members</Tab>
          </TabList>

          <TabPanels>
            <TabPanel>
              <form onSubmit={handleSubmit(onSubmit)}>
                <ModalBody py={6}>
                  <VStack spacing={6}>
                    <FormControl isRequired isInvalid={!!errors.name}>
                      <FormLabel
                        fontSize="sm"
                        fontWeight="500"
                        color="gray.700"
                      >
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
                      <FormLabel
                        fontSize="sm"
                        fontWeight="500"
                        color="gray.700"
                      >
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

                    <FormControl>
                      <Checkbox 
                        {...register("is_system_group")} 
                        colorScheme="blue"
                        size="lg"
                      >
                        System Group
                      </Checkbox>
                    </FormControl>
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
                    isDisabled={!isDirty}
                    transition="all 0.2s"
                    _hover={{
                      transform: "translateY(-1px)",
                      boxShadow: "md",
                    }}
                    _active={{
                      transform: "translateY(0)",
                    }}
                  >
                    Save Changes
                  </Button>
                  <Button
                    onClick={onClose}
                    variant="ghost"
                    transition="all 0.2s"
                    _hover={{
                      bg: "gray.100",
                    }}
                  >
                    Cancel
                  </Button>
                </ModalFooter>
              </form>
            </TabPanel>

            <TabPanel>
              <Table size="sm">
                <Thead>
                  <Tr>
                    <Th>Resource</Th>
                    <Th>Type</Th>
                    <Th>Create</Th>
                    <Th>Read</Th>
                    <Th>Update</Th>
                    <Th>Delete</Th>
                    <Th>Execute</Th>
                    <Th>Manage</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {resources?.data.map((resource) => (
                    <Tr key={resource.id}>
                      <Td>{resource.name}</Td>
                      <Td>{resource.type}</Td>
                      <Td><Switch size="sm" /></Td>
                      <Td><Switch size="sm" /></Td>
                      <Td><Switch size="sm" /></Td>
                      <Td><Switch size="sm" /></Td>
                      <Td><Switch size="sm" /></Td>
                      <Td><Switch size="sm" /></Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            </TabPanel>

            <TabPanel>
              {/* TODO: Add member management UI */}
            </TabPanel>
          </TabPanels>
        </Tabs>
      </ModalContent>
    </Modal>
  );
};

export default EditGroup; 