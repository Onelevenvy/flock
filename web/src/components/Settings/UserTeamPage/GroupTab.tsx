"use client";
import {
  Badge,
  Box,
  Button,
  Flex,
  HStack,
  IconButton,
  Table,
  TableContainer,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
  useColorModeValue,
} from "@chakra-ui/react";
import { AddIcon, DeleteIcon, EditIcon } from "@chakra-ui/icons";
import { useState } from "react";
import {
  type ApiError,
  type GroupOut,
  type UserOut,
  GroupsService,
} from "@/client";
import useCustomToast from "@/hooks/useCustomToast";
import GroupForm from "./GroupForm";

interface GroupTabProps {
  groups: GroupOut[];
  users: UserOut[];
}

export default function GroupTab({ groups, users }: GroupTabProps) {
  const showToast = useCustomToast();
  const [isAddGroupOpen, setIsAddGroupOpen] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<GroupOut | null>(null);

  const bgColor = useColorModeValue("white", "gray.800");
  const borderColor = useColorModeValue("gray.100", "gray.700");
  const tableHeaderBg = useColorModeValue("gray.50", "gray.700");
  const hoverBg = useColorModeValue("gray.50", "gray.700");

  const handleDeleteGroup = async (group: GroupOut) => {
    try {
      await GroupsService.deleteGroup({ groupId: group.id });
      showToast("Success!", "Group deleted successfully.", "success");
    } catch (err) {
      const errDetail = (err as ApiError).body?.detail;
      showToast("Something went wrong.", `${errDetail}`, "error");
    }
  };

  return (
    <>
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
              {groups.map((group) => (
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
                      {users.find((u) => u.id === group.admin_id)?.full_name ||
                        "未设置"}
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
    </>
  );
}
