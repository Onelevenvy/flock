"use client";
import {
  Badge,
  Box,
  Container,
  Flex,
  Spinner,
  Table,
  TableContainer,
  Tbody,
  Td,
  Th,
  Thead,
  Tr,
  useColorModeValue,
  Text,
  Button,
  HStack,
  Tabs,
  TabList,
  Tab,
  TabPanels,
  TabPanel,
} from "@chakra-ui/react";
import React, { useState } from "react";
import { useQuery } from "react-query";

import { 
  type ApiError, 
  UsersService, 
  GroupsService, 
  RolesService,
  type GroupOut,
  type RoleOut,
} from "@/client";
import ActionsMenu from "@/components/Common/ActionsMenu";
import Navbar from "@/components/Common/Navbar";
import useAuth from "@/hooks/useAuth";
import useCustomToast from "@/hooks/useCustomToast";
import { AddIcon } from "@chakra-ui/icons";
import AddGroup from "./AddGroup";
import EditGroup from "./EditGroup";

function MembersPage() {
  const showToast = useCustomToast();
  const { currentUser } = useAuth();
  const [isAddGroupOpen, setIsAddGroupOpen] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<GroupOut | null>(null);

  const bgColor = useColorModeValue("white", "gray.800");
  const borderColor = useColorModeValue("gray.100", "gray.700");
  const tableBgColor = useColorModeValue("white", "gray.800");
  const tableHeaderBg = useColorModeValue("gray.50", "gray.700");
  const hoverBg = useColorModeValue("gray.50", "gray.700");

  // Fetch data for all tabs
  const {
    data: users,
    isLoading: isLoadingUsers,
    isError: isErrorUsers,
    error: errorUsers,
  } = useQuery("users", () => UsersService.readUsers({}));

  const {
    data: groups,
    isLoading: isLoadingGroups,
    isError: isErrorGroups,
    error: errorGroups,
  } = useQuery("groups", () => GroupsService.readGroups({}));

  const {
    data: roles,
    isLoading: isLoadingRoles,
    isError: isErrorRoles,
    error: errorRoles,
  } = useQuery("roles", () => RolesService.readRoles({}));

  if (isErrorUsers || isErrorGroups || isErrorRoles) {
    const errDetail = 
      (isErrorUsers && (errorUsers as ApiError).body?.detail) ||
      (isErrorGroups && (errorGroups as ApiError).body?.detail) ||
      (isErrorRoles && (errorRoles as ApiError).body?.detail);
    showToast("Something went wrong.", `${errDetail}`, "error");
  }

  const isLoading = isLoadingUsers || isLoadingGroups || isLoadingRoles;

  if (isLoading) {
    return (
      <Flex 
        justify="center" 
        align="center" 
        height="100vh" 
        width="full"
        bg="ui.bgMain"
      >
        <Spinner 
          size="xl" 
          color="ui.main" 
          thickness="3px"
          speed="0.8s"
        />
      </Flex>
    );
  }

  return (
    <>
      <Container maxW="full">
        <Flex justifyContent="flex-end" mb={6}>
          <Navbar type="User" />
        </Flex>

        <Tabs>
          <TabList mb={6}>
            <Tab>Members</Tab>
            <Tab>Groups</Tab>
            <Tab>Roles</Tab>
          </TabList>

          <TabPanels>
            {/* Members Tab */}
            <TabPanel p={0}>
              <Box
                bg={bgColor}
                borderRadius="xl"
                border="1px solid"
                borderColor={borderColor}
                overflow="hidden"
                transition="all 0.2s"
                boxShadow="sm"
                _hover={{
                  boxShadow: "md",
                  borderColor: "gray.200",
                }}
              >
                <TableContainer>
                  <Table fontSize="sm">
                    <Thead bg={tableHeaderBg}>
                      <Tr>
                        <Th>Full name</Th>
                        <Th>Email</Th>
                        <Th>Role</Th>
                        <Th>Status</Th>
                        <Th>Actions</Th>
                      </Tr>
                    </Thead>
                    <Tbody>
                      {users?.data.map((user) => (
                        <Tr 
                          key={user.id}
                          transition="all 0.2s"
                          _hover={{ bg: hoverBg }}
                        >
                          <Td py={4}>
                            <HStack spacing={2}>
                              <Text 
                                color={!user.full_name ? "gray.400" : "gray.700"}
                                fontWeight="500"
                              >
                                {user.full_name || "N/A"}
                              </Text>
                              {currentUser?.id === user.id && (
                                <Badge
                                  colorScheme="blue"
                                  variant="subtle"
                                  fontSize="xs"
                                  borderRadius="full"
                                  px={2}
                                  py={0.5}
                                >
                                  You
                                </Badge>
                              )}
                            </HStack>
                          </Td>
                          <Td py={4}>
                            <Text color="gray.600">{user.email}</Text>
                          </Td>
                          <Td py={4}>
                            <Badge
                              colorScheme={user.is_superuser ? "purple" : "gray"}
                              variant="subtle"
                              fontSize="xs"
                              borderRadius="full"
                              px={2}
                              py={0.5}
                            >
                              {user.is_superuser ? "Superuser" : "User"}
                            </Badge>
                          </Td>
                          <Td py={4}>
                            <HStack spacing={2}>
                              <Box
                                w="2"
                                h="2"
                                borderRadius="full"
                                bg={user.is_active ? "green.400" : "red.400"}
                              />
                              <Text color="gray.600">
                                {user.is_active ? "Active" : "Inactive"}
                              </Text>
                            </HStack>
                          </Td>
                          <Td py={4}>
                            <ActionsMenu
                              type="User"
                              value={user}
                              disabled={currentUser?.id === user.id}
                            />
                          </Td>
                        </Tr>
                      ))}
                    </Tbody>
                  </Table>
                </TableContainer>
              </Box>
            </TabPanel>

            {/* Groups Tab */}
            <TabPanel p={0}>
              <Flex justifyContent="flex-end" mb={4}>
                <Button
                  leftIcon={<AddIcon />}
                  colorScheme="blue"
                  variant="solid"
                  size="sm"
                  onClick={() => setIsAddGroupOpen(true)}
                >
                  Add Group
                </Button>
              </Flex>
              <Box
                bg={bgColor}
                borderRadius="xl"
                border="1px solid"
                borderColor={borderColor}
                overflow="hidden"
                transition="all 0.2s"
                boxShadow="sm"
                _hover={{
                  boxShadow: "md",
                  borderColor: "gray.200",
                }}
              >
                <TableContainer>
                  <Table fontSize="sm">
                    <Thead bg={tableHeaderBg}>
                      <Tr>
                        <Th>Group Name</Th>
                        <Th>Description</Th>
                        <Th>Type</Th>
                        <Th>Actions</Th>
                      </Tr>
                    </Thead>
                    <Tbody>
                      {groups?.data.map((group: GroupOut) => (
                        <Tr 
                          key={group.id}
                          transition="all 0.2s"
                          _hover={{ bg: hoverBg }}
                        >
                          <Td py={4}>
                            <Text fontWeight="500" color="gray.700">
                              {group.name}
                            </Text>
                          </Td>
                          <Td py={4}>
                            <Text color="gray.600">
                              {group.description || "No description"}
                            </Text>
                          </Td>
                          <Td py={4}>
                            <Badge
                              colorScheme={group.is_system_group ? "purple" : "blue"}
                              variant="subtle"
                              fontSize="xs"
                              borderRadius="full"
                              px={2}
                              py={0.5}
                            >
                              {group.is_system_group ? "System" : "Custom"}
                            </Badge>
                          </Td>
                          <Td py={4}>
                            <ActionsMenu
                              type="Group"
                              value={group}
                              disabled={group.is_system_group}
                              onEdit={() => setSelectedGroup(group)}
                            />
                          </Td>
                        </Tr>
                      ))}
                    </Tbody>
                  </Table>
                </TableContainer>
              </Box>
            </TabPanel>

            {/* Roles Tab */}
            <TabPanel p={0}>
              <Flex justifyContent="flex-end" mb={4}>
                <Button
                  leftIcon={<AddIcon />}
                  colorScheme="blue"
                  variant="solid"
                  size="sm"
                  onClick={() => {/* TODO: Open Add Role Modal */}}
                >
                  Add Role
                </Button>
              </Flex>
              <Box
                bg={bgColor}
                borderRadius="xl"
                border="1px solid"
                borderColor={borderColor}
                overflow="hidden"
                transition="all 0.2s"
                boxShadow="sm"
                _hover={{
                  boxShadow: "md",
                  borderColor: "gray.200",
                }}
              >
                <TableContainer>
                  <Table fontSize="sm">
                    <Thead bg={tableHeaderBg}>
                      <Tr>
                        <Th>Role Name</Th>
                        <Th>Description</Th>
                        <Th>Type</Th>
                        <Th>Actions</Th>
                      </Tr>
                    </Thead>
                    <Tbody>
                      {roles?.data.map((role: RoleOut) => (
                        <Tr 
                          key={role.id}
                          transition="all 0.2s"
                          _hover={{ bg: hoverBg }}
                        >
                          <Td py={4}>
                            <Text fontWeight="500" color="gray.700">
                              {role.name}
                            </Text>
                          </Td>
                          <Td py={4}>
                            <Text color="gray.600">
                              {role.description || "No description"}
                            </Text>
                          </Td>
                          <Td py={4}>
                            <Badge
                              colorScheme={role.is_system_role ? "purple" : "blue"}
                              variant="subtle"
                              fontSize="xs"
                              borderRadius="full"
                              px={2}
                              py={0.5}
                            >
                              {role.is_system_role ? "System" : "Custom"}
                            </Badge>
                          </Td>
                          <Td py={4}>
                            <ActionsMenu
                              type="Role"
                              value={role}
                              disabled={role.is_system_role}
                            />
                          </Td>
                        </Tr>
                      ))}
                    </Tbody>
                  </Table>
                </TableContainer>
              </Box>
            </TabPanel>
          </TabPanels>
        </Tabs>

        {/* Modals */}
        <AddGroup 
          isOpen={isAddGroupOpen} 
          onClose={() => setIsAddGroupOpen(false)} 
        />
        {selectedGroup && (
          <EditGroup
            group={selectedGroup}
            isOpen={!!selectedGroup}
            onClose={() => setSelectedGroup(null)}
          />
        )}
      </Container>
    </>
  );
}

export default MembersPage;
