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
  FormControl,
  FormLabel,
  Select,
  VStack,
  IconButton,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
} from "@chakra-ui/react";
import React, { useState } from "react";
import { useQuery, useQueryClient } from "react-query";
import { AddIcon, EditIcon, DeleteIcon } from "@chakra-ui/icons";
import { BsThreeDotsVertical } from "react-icons/bs";

import { 
  type ApiError, 
  UsersService, 
  GroupsService, 
  RolesService,
  type GroupOut,
  type RoleOut,
  type UserOut,
} from "@/client";
import useAuth from "@/hooks/useAuth";
import useCustomToast from "@/hooks/useCustomToast";
import UserForm from "./UserForm";
import GroupForm from "./GroupForm";
import RoleForm from "./RoleForm";
import { useTranslation } from "react-i18next";

function MembersPage() {
  const showToast = useCustomToast();
  const { currentUser } = useAuth();
  const queryClient = useQueryClient();
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [isAddGroupOpen, setIsAddGroupOpen] = useState(false);
  const [isAddRoleOpen, setIsAddRoleOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserOut | undefined>(undefined);
  const [selectedGroup, setSelectedGroup] = useState<GroupOut | null>(null);
  const [selectedGroupForRoles, setSelectedGroupForRoles] = useState<GroupOut | null>(null);
  const [selectedRole, setSelectedRole] = useState<RoleOut | null>(null);
  const { t } = useTranslation();
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
  } = useQuery("groups", () => GroupsService.readGroups({}), {
    onSuccess: (data) => {
      if (data.data.length > 0 && !selectedGroupForRoles) {
        setSelectedGroupForRoles(data.data[0]);
      }
    }
  });

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

  const handleDeleteGroup = async (group: GroupOut) => {
    try {
      await GroupsService.deleteGroup({ groupId: group.id });
      showToast("Success!", "Group deleted successfully.", "success");
      queryClient.invalidateQueries("groups");
    } catch (err) {
      const errDetail = (err as ApiError).body?.detail;
      showToast("Something went wrong.", `${errDetail}`, "error");
    }
  };

  const handleDeleteRole = async (role: RoleOut) => {
    try {
      await RolesService.deleteRole({ roleId: role.id });
      showToast("Success!", "Role deleted successfully.", "success");
      queryClient.invalidateQueries("roles");
    } catch (err) {
      const errDetail = (err as ApiError).body?.detail;
      showToast("Something went wrong.", `${errDetail}`, "error");
    }
  };

  const handleDeleteUser = async (userId: number) => {
    try {
      await UsersService.deleteUser({ userId });
      showToast("Success!", "User deleted successfully.", "success");
      queryClient.invalidateQueries("users");
    } catch (err) {
      const error = err as ApiError;
      const errDetail = error.body?.detail;
      showToast("Something went wrong.", `${errDetail}`, "error");
    }
  };
  
  return (
    <>
      <Container maxW="full">
        <Flex justifyContent="space-between" mb={6}>
          <Text fontSize="2xl" fontWeight="bold">Settings</Text>
        </Flex>

        <Tabs>
          <TabList mb={6}>
            <Tab>{t("setting.setting.usermanagement")}</Tab>
            <Tab>{t("setting.setting.groupmanagement")}</Tab>
            <Tab>{t("setting.setting.rolemanagement")}</Tab>
          </TabList>

          <TabPanels>
            {/* User Tab */}
            <TabPanel p={0}>
              <Flex justifyContent="flex-end" mb={4}>
                <Button
                  leftIcon={<AddIcon />}
                  colorScheme="blue"
                  variant="solid"
                  size="sm"
                  onClick={() => setIsAddUserOpen(true)}
                >
                  Add User
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
                        <Th>Full name</Th>
                        <Th>Email</Th>
                        <Th>Group</Th>
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
                            <Text color="gray.600">
                              {groups?.data.find(g => 
                                Array.isArray(user.groups) && user.groups.some(ug => ug.id === g.id)
                              )?.name || "默认用户组"}
                            </Text>
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
                              {user.is_superuser ? "管理员" : "普通用户"}
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
                            <Menu>
                              <MenuButton
                                as={IconButton}
                                icon={<BsThreeDotsVertical />}
                                variant="ghost"
                                size="sm"
                              />
                              <MenuList>
                                <MenuItem icon={<EditIcon />} onClick={() => setSelectedUser(user)}>
                                  Edit
                                </MenuItem>
                                <MenuItem
                                  icon={<DeleteIcon />}
                                  color="red.500"
                                  onClick={() => handleDeleteUser(user.id)}
                                >
                                  Delete
                                </MenuItem>
                              </MenuList>
                            </Menu>
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
                        <Th>Admin</Th>
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
                            <Text color="gray.600">
                              {users?.data.find(u => u.id === group.admin_id)?.full_name || "未设置"}
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
                            <HStack spacing={2}>
                              <IconButton
                                aria-label="Edit group"
                                icon={<EditIcon />}
                                size="sm"
                                variant="ghost"
                                isDisabled={group.is_system_group}
                                onClick={() => setSelectedGroup(group)}
                              />
                              <IconButton
                                aria-label="Delete group"
                                icon={<DeleteIcon />}
                                size="sm"
                                variant="ghost"
                                colorScheme="red"
                                isDisabled={group.is_system_group}
                                onClick={() => handleDeleteGroup(group)}
                              />
                            </HStack>
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
              <VStack spacing={4} align="stretch">
                <FormControl>
                  <FormLabel>选择用户组</FormLabel>
                  <Select 
                    placeholder="选择要管理角色的用户组"
                    value={selectedGroupForRoles?.id || ""}
                    onChange={(e) => {
                      const groupId = parseInt(e.target.value);
                      const group = groups?.data.find(g => g.id === groupId) || null;
                      setSelectedGroupForRoles(group);
                    }}
                  >
                    {groups?.data.map((group) => (
                      <option key={group.id} value={group.id}>
                        {group.name} {group.is_system_group ? "(系统)" : ""}
                      </option>
                    ))}
                  </Select>
                </FormControl>

                {selectedGroupForRoles && (
                  <>
                    <Flex justifyContent="space-between" alignItems="center" mb={4}>
                      <Text fontSize="sm" color="gray.600">
                        管理员: {users?.data.find(u => u.id === selectedGroupForRoles.admin_id)?.full_name || "未设置"}
                      </Text>
                      <Button
                        leftIcon={<AddIcon />}
                        colorScheme="blue"
                        variant="solid"
                        size="sm"
                        onClick={() => setIsAddRoleOpen(true)}
                      >
                        添加角色
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
                            {roles?.data
                              .filter(role => role.group_id === selectedGroupForRoles.id)
                              .map((role: RoleOut) => (
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
                                    <HStack spacing={2}>
                                      <IconButton
                                        aria-label="Edit role"
                                        icon={<EditIcon />}
                                        size="sm"
                                        variant="ghost"
                                        isDisabled={role.is_system_role}
                                        onClick={() => setSelectedRole(role)}
                                      />
                                      <IconButton
                                        aria-label="Delete role"
                                        icon={<DeleteIcon />}
                                        size="sm"
                                        variant="ghost"
                                        colorScheme="red"
                                        isDisabled={role.is_system_role}
                                        onClick={() => handleDeleteRole(role)}
                                      />
                                    </HStack>
                                  </Td>
                                </Tr>
                            ))}
                          </Tbody>
                        </Table>
                      </TableContainer>
                    </Box>
                  </>
                )}
              </VStack>
            </TabPanel>
          </TabPanels>
        </Tabs>

        {/* Modals */}
        <GroupForm 
          isOpen={isAddGroupOpen} 
          onClose={() => setIsAddGroupOpen(false)} 
        />
        {selectedGroup && (
          <GroupForm
            group={selectedGroup}
            isOpen={!!selectedGroup}
            onClose={() => setSelectedGroup(null)}
          />
        )}
        {selectedGroupForRoles && (
          <RoleForm
            isOpen={isAddRoleOpen}
            onClose={() => setIsAddRoleOpen(false)}
            groupId={selectedGroupForRoles.id}
          />
        )}
        {selectedRole && (
          <RoleForm
            role={selectedRole}
            groupId={selectedRole.group_id}
            isOpen={!!selectedRole}
            onClose={() => setSelectedRole(null)}
          />
        )}
        <UserForm
          isOpen={isAddUserOpen || !!selectedUser}
          onClose={() => {
            setIsAddUserOpen(false);
            setSelectedUser(undefined);
          }}
          user={selectedUser}
        />
      </Container>
    </>
  );
}

export default MembersPage;
