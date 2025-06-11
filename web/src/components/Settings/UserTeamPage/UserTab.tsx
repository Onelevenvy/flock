"use client";
import {
  Badge,
  Box,
  Button,
  Flex,
  HStack,
  IconButton,
  Menu,
  MenuButton,
  MenuItem,
  MenuList,
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
  useToast,
} from "@chakra-ui/react";
import { AddIcon, DeleteIcon, EditIcon, RepeatIcon } from "@chakra-ui/icons";
import { BsThreeDotsVertical } from "react-icons/bs";
import { useState } from "react";
import { useQueryClient, useMutation } from "react-query";
import { type ApiError, type UserOut, UsersService } from "@/client";
import useCustomToast from "@/hooks/useCustomToast";
import UserForm from "./UserForm";

const DEFAULT_PASSWORD = "12345678";

interface UserTabProps {
  users: UserOut[];
  currentUserId?: number;
  totalCount: number;
  onPageChange?: (page: number) => void;
}

const PAGE_SIZE = 10;

export default function UserTab({ users, currentUserId, totalCount, onPageChange }: UserTabProps) {
  const toast = useToast();
  const showToast = useCustomToast();
  const queryClient = useQueryClient();
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserOut | undefined>(undefined);
  const [currentPage, setCurrentPage] = useState(1);

  const bgColor = useColorModeValue("white", "gray.800");
  const borderColor = useColorModeValue("gray.100", "gray.700");
  const tableHeaderBg = useColorModeValue("gray.50", "gray.700");
  const hoverBg = useColorModeValue("gray.50", "gray.700");

  const resetPasswordMutation = useMutation(
    (userId: number) =>
      UsersService.updateUser({
        userId,
        requestBody: {
          password: DEFAULT_PASSWORD,
        },
      }),
    {
      onSuccess: () => {
        toast({
          title: "Success",
          description: "Password has been reset to default (12345678)",
          status: "success",
          duration: 3000,
          isClosable: true,
        });
        queryClient.invalidateQueries("users");
      },
      onError: (err: ApiError) => {
        const errDetail = err.body?.detail;
        showToast("Something went wrong.", `${errDetail}`, "error");
      },
    }
  );

  const handleResetPassword = async (userId: number, isSuperUser: boolean) => {
    if (isSuperUser) {
      toast({
        title: "Warning",
        description: "Cannot reset superuser password",
        status: "warning",
        duration: 3000,
        isClosable: true,
      });
      return;
    }
    resetPasswordMutation.mutate(userId);
  };

  const handleDeleteUser = async (userId: number, isSuperUser: boolean) => {
    if (isSuperUser) {
      toast({
        title: "Warning",
        description: "Cannot delete superuser accounts.",
        status: "warning",
        duration: 3000,
        isClosable: true,
      });
      return;
    }

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

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
    onPageChange?.(newPage);
  };

  return (
    <>
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
        <TableContainer maxH="600px" overflowY="auto">
          <Table fontSize="sm">
            <Thead position="sticky" top={0} bg={tableHeaderBg} zIndex={1}>
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
              {users?.map((user) => (
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
                      {currentUserId === user.id && (
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
                    <VStack align="start" spacing={1}>
                      {user.groups?.map((group: any) => (
                        <Badge
                          key={group.id}
                          colorScheme="blue"
                          variant="subtle"
                          fontSize="xs"
                          borderRadius="full"
                          px={2}
                          py={0.5}
                        >
                          {group.name}
                        </Badge>
                      )) || (
                        <Badge
                          colorScheme="gray"
                          variant="subtle"
                          fontSize="xs"
                          borderRadius="full"
                          px={2}
                          py={0.5}
                        >
                          默认用户组
                        </Badge>
                      )}
                    </VStack>
                  </Td>
                  <Td py={4}>
                    <VStack align="start" spacing={1}>
                      {(user as any).roles?.map((role: any) => (
                        <Badge
                          key={role.id}
                          colorScheme="purple"
                          variant="subtle"
                          fontSize="xs"
                          borderRadius="full"
                          px={2}
                          py={0.5}
                        >
                          {role.name}
                        </Badge>
                      ))}
                      {user.is_superuser && (
                        <Badge
                          colorScheme="red"
                          variant="subtle"
                          fontSize="xs"
                          borderRadius="full"
                          px={2}
                          py={0.5}
                        >
                          管理员
                        </Badge>
                      )}
                    </VStack>
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
                    <HStack spacing={2} justify="flex-end">
                      <IconButton
                        aria-label="Reset password"
                        icon={<RepeatIcon />}
                        size="sm"
                        variant="ghost"
                        colorScheme="orange"
                        onClick={() => handleResetPassword(user.id, user.is_superuser || false)}
                        isDisabled={user.is_superuser || false}
                        title={user.is_superuser ? "Cannot reset superuser password" : "Reset password to default (12345678)"}
                      />
                      <IconButton
                        aria-label="Edit user"
                        icon={<EditIcon />}
                        size="sm"
                        variant="ghost"
                        onClick={() => setSelectedUser(user)}
                        isDisabled={user.is_superuser || false}
                        title={user.is_superuser ? "Cannot edit superuser accounts" : "Edit user"}
                      />
                      <IconButton
                        aria-label="Delete user"
                        icon={<DeleteIcon />}
                        size="sm"
                        variant="ghost"
                        colorScheme="red"
                        onClick={() => handleDeleteUser(user.id, user.is_superuser || false)}
                        isDisabled={user.is_superuser || false}
                        title={user.is_superuser ? "Cannot delete superuser accounts" : "Delete user"}
                      />
                    </HStack>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </TableContainer>
        {totalPages > 1 && (
          <Flex justify="center" p={4} borderTop="1px solid" borderColor={borderColor}>
            <HStack spacing={2}>
              <Button
                size="sm"
                variant="outline"
                isDisabled={currentPage === 1}
                onClick={() => handlePageChange(currentPage - 1)}
              >
                Previous
              </Button>
              <Text fontSize="sm">
                Page {currentPage} of {totalPages}
              </Text>
              <Button
                size="sm"
                variant="outline"
                isDisabled={currentPage === totalPages}
                onClick={() => handlePageChange(currentPage + 1)}
              >
                Next
              </Button>
            </HStack>
          </Flex>
        )}
      </Box>

      <UserForm
        isOpen={isAddUserOpen || !!selectedUser}
        onClose={() => {
          setIsAddUserOpen(false);
          setSelectedUser(undefined);
        }}
        user={selectedUser}
      />
    </>
  );
} 