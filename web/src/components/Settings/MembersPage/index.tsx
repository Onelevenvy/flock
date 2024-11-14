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
  HStack,
} from "@chakra-ui/react";
import React from "react";
import { useQuery } from "react-query";

import { type ApiError, UsersService } from "@/client";
import ActionsMenu from "@/components/Common/ActionsMenu";
import Navbar from "@/components/Common/Navbar";
import useAuth from "@/hooks/useAuth";
import useCustomToast from "@/hooks/useCustomToast";

function MembersPage() {
  const showToast = useCustomToast();
  const { currentUser } = useAuth();

  const bgColor = useColorModeValue("white", "gray.800");
  const borderColor = useColorModeValue("gray.100", "gray.700");
  const tableBgColor = useColorModeValue("white", "gray.800");
  const tableHeaderBg = useColorModeValue("gray.50", "gray.700");
  const hoverBg = useColorModeValue("gray.50", "gray.700");

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
    <>
      {isLoading ? (
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
      ) : (
        users && (
          <Container maxW="full">
            <Flex justifyContent="flex-end" mb={6}>
              <Navbar type="User" />
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
                      <Th 
                        py={4}
                        color="gray.600"
                        fontSize="xs"
                        fontWeight="600"
                        textTransform="uppercase"
                      >
                        Full name
                      </Th>
                      <Th 
                        py={4}
                        color="gray.600"
                        fontSize="xs"
                        fontWeight="600"
                        textTransform="uppercase"
                      >
                        Email
                      </Th>
                      <Th 
                        py={4}
                        color="gray.600"
                        fontSize="xs"
                        fontWeight="600"
                        textTransform="uppercase"
                      >
                        Role
                      </Th>
                      <Th 
                        py={4}
                        color="gray.600"
                        fontSize="xs"
                        fontWeight="600"
                        textTransform="uppercase"
                      >
                        Status
                      </Th>
                      <Th 
                        py={4}
                        color="gray.600"
                        fontSize="xs"
                        fontWeight="600"
                        textTransform="uppercase"
                      >
                        Actions
                      </Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {users.data.map((user) => (
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
          </Container>
        )
      )}
    </>
  );
}

export default MembersPage;
