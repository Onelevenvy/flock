"use client";
import {
  Badge,
  Box,
  Button,
  FormControl,
  FormLabel,
  HStack,
  IconButton,
  Select,
  Table,
  TableContainer,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
  VStack,
  useColorModeValue,
} from "@chakra-ui/react";
import { AddIcon, DeleteIcon, EditIcon } from "@chakra-ui/icons";
import { useState, useEffect } from "react";
import {
  type ApiError,
  type GroupOut,
  type RoleOut,
  type UserOut,
  RolesService,
} from "@/client";
import useCustomToast from "@/hooks/useCustomToast";
import RoleForm from "./RoleForm";
import { useMutation, useQueryClient } from "react-query";

interface RoleTabProps {
  roles: RoleOut[];
  groups: GroupOut[];
  users: UserOut[];
}

export default function RoleTab({ roles, groups, users }: RoleTabProps) {
  const showToast = useCustomToast();
  const queryClient = useQueryClient();
  const [isAddRoleOpen, setIsAddRoleOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<RoleOut | null>(null);
  const [selectedGroupForRoles, setSelectedGroupForRoles] =
    useState<GroupOut | null>(null);

  const bgColor = useColorModeValue("white", "gray.800");
  const borderColor = useColorModeValue("gray.100", "gray.700");
  const tableHeaderBg = useColorModeValue("gray.50", "gray.700");
  const hoverBg = useColorModeValue("gray.50", "gray.700");

  // Set default group on component mount
  useEffect(() => {
    if (groups.length > 0 && !selectedGroupForRoles) {
      setSelectedGroupForRoles(groups[0]);
    }
  }, [groups]);

  const deleteMutation = useMutation(
    (roleId: number) => RolesService.deleteRole({ roleId }),
    {
      onSuccess: () => {
        showToast("Success!", "Role deleted successfully.", "success");
        queryClient.invalidateQueries("roles");
      },
      onError: (err: ApiError) => {
        const errDetail = err.body?.detail;
        showToast("Something went wrong.", `${errDetail}`, "error");
      },
    },
  );

  const handleDeleteRole = async (role: RoleOut) => {
    deleteMutation.mutate(role.id);
  };

  return (
    <VStack spacing={4} align="stretch">
      <FormControl>
        <FormLabel>选择用户组</FormLabel>
        <Select
          placeholder="选择要管理角色的用户组"
          value={selectedGroupForRoles?.id || ""}
          onChange={(e) => {
            const groupId = parseInt(e.target.value);
            const group = groups.find((g) => g.id === groupId) || null;
            setSelectedGroupForRoles(group);
          }}
        >
          {groups.map((group) => (
            <option key={group.id} value={group.id}>
              {group.name} {group.is_system_group ? "(系统)" : ""}
            </option>
          ))}
        </Select>
      </FormControl>

      {selectedGroupForRoles && (
        <>
          <HStack justify="space-between" align="center" mb={4}>
            <Text fontSize="sm" color="gray.600">
              管理员:{" "}
              {users.find((u) => u.id === selectedGroupForRoles.admin_id)
                ?.full_name || "未设置"}
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
          </HStack>
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
                  {roles
                    .filter(
                      (role) => role.group_id === selectedGroupForRoles.id,
                    )
                    .map((role) => (
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
                            colorScheme={
                              role.is_system_role ? "purple" : "blue"
                            }
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
    </VStack>
  );
}
