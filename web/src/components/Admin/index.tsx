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
  Text,
} from "@chakra-ui/react";
import React from "react";
import { useQuery } from "react-query";

import { type ApiError, UsersService } from "@/client";
import ActionsMenu from "@/components/Common/ActionsMenu";
import Navbar from "@/components/Common/Navbar";
import useAuth from "@/hooks/useAuth";
import useCustomToast from "@/hooks/useCustomToast";

function Admin() {
  const showToast = useCustomToast();
  const { currentUser } = useAuth();
  const {
    data: users,
    isLoading,
    isError,
    error,
  } = useQuery("users", () => UsersService.readUsers({}));

  if (isError) {
    const errDetail = (error as ApiError).body?.detail;
    showToast("Something went wrong.", `${errDetail}`, "error");
  }

  return (
    <Box bg="ui.bgMain" minH="100vh" px={6} py={4}>
      {isLoading ? (
        <Flex justify="center" align="center" height="100vh" width="full">
          <Spinner size="xl" color="ui.main" thickness="3px" />
        </Flex>
      ) : (
        users && (
          <Container maxW="7xl">
            <Box mb={6}>
              <Navbar type="User" />
            </Box>

            <Box
              bg="white"
              borderRadius="xl"
              border="1px solid"
              borderColor="gray.100"
              overflow="hidden"
              boxShadow="sm"
              transition="all 0.2s"
              _hover={{
                boxShadow: "md",
              }}
            >
              <TableContainer>
                <Table fontSize="md" size={{ base: "sm", md: "md" }}>
                  <Thead bg="gray.50">
                    <Tr>
                      <Th py={4}>Full name</Th>
                      <Th py={4}>Email</Th>
                      <Th py={4}>Role</Th>
                      <Th py={4}>Status</Th>
                      <Th py={4}>Actions</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {users.data.map((user) => (
                      <Tr
                        key={user.id}
                        transition="all 0.2s"
                        _hover={{ bg: "gray.50" }}
                      >
                        <Td py={4}>
                          <Flex align="center" gap={2}>
                            <Text color={!user.full_name ? "gray.400" : "gray.700"}>
                              {user.full_name || "N/A"}
                            </Text>
                            {currentUser?.id === user.id && (
                              <Badge
                                colorScheme="blue"
                                variant="subtle"
                                borderRadius="full"
                                px={2}
                              >
                                You
                              </Badge>
                            )}
                          </Flex>
                        </Td>
                        <Td py={4} color="gray.600">{user.email}</Td>
                        <Td py={4}>
                          <Badge
                            colorScheme={user.is_superuser ? "purple" : "gray"}
                            variant="subtle"
                            borderRadius="full"
                            px={2}
                          >
                            {user.is_superuser ? "Superuser" : "User"}
                          </Badge>
                        </Td>
                        <Td py={4}>
                          <Flex align="center" gap={2}>
                            <Box
                              w="2"
                              h="2"
                              borderRadius="full"
                              bg={user.is_active ? "green.400" : "red.400"}
                            />
                            <Text color="gray.600">
                              {user.is_active ? "Active" : "Inactive"}
                            </Text>
                          </Flex>
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
          </Container>
        )
      )}
    </Box>
  );
}

export default Admin;
