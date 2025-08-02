import {
  Button,
  Menu,
  MenuButton,
  MenuItem,
  MenuList,
  useDisclosure,
  Icon,
} from "@chakra-ui/react";
import { BsThreeDotsVertical } from "react-icons/bs";
import { FiEdit, FiTrash } from "react-icons/fi";

import EditUser from "@/components/Admin/EditUser";
import Delete from "@/components/Common/DeleteAlert";
import EditTeam from "@/components/Teams/EditTeam";
import EditSkill from "@/components/Tools/EditSkill";
import EditUpload from "@/components/Uploads/EditUpload";
import type {
  ToolOut,
  TeamOut,
  UploadOut,
  UserOut,
  GroupOut,
  RoleOut,
} from "../../client";

interface ActionsMenuProps {
  type: string;
  value: UserOut | TeamOut | ToolOut | UploadOut | GroupOut | RoleOut;
  disabled?: boolean;
  onEdit?: () => void;
}

const ActionsMenu = ({ type, value, disabled, onEdit }: ActionsMenuProps) => {
  const editUserModal = useDisclosure();
  const deleteModal = useDisclosure();

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onEdit) {
      onEdit();
    } else {
      editUserModal.onOpen();
    }
  };

  return (
    <>
      <Menu>
        <MenuButton
          isDisabled={disabled}
          as={Button}
          rightIcon={<Icon as={BsThreeDotsVertical} />}
          variant="ghost"
          size="sm"
          borderRadius="lg"
          onClick={(e) => e.stopPropagation()}
          transition="all 0.2s"
          _hover={{
            bg: "gray.100",
            transform: "translateY(-1px)",
          }}
          _active={{
            bg: "gray.200",
            transform: "translateY(0)",
          }}
        />
        <MenuList
          py={2}
          border="1px solid"
          borderColor="gray.100"
          borderRadius="lg"
          boxShadow="lg"
          bg="white"
          backdropFilter="blur(8px)"
        >
          <MenuItem
            onClick={handleEdit}
            icon={<Icon as={FiEdit} color="gray.600" />}
            py={2}
            px={4}
            transition="all 0.2s"
            _hover={{
              bg: "gray.50",
            }}
          >
            Edit {type}
          </MenuItem>
          <MenuItem
            onClick={(e) => {
              e.stopPropagation();
              deleteModal.onOpen();
            }}
            icon={<Icon as={FiTrash} color="red.500" />}
            color="red.500"
            py={2}
            px={4}
            transition="all 0.2s"
            _hover={{
              bg: "red.50",
            }}
          >
            Delete {type}
          </MenuItem>
        </MenuList>

        {/* Modals */}
        {!onEdit &&
          (type === "User" ? (
            <EditUser
              user={value as UserOut}
              isOpen={editUserModal.isOpen}
              onClose={editUserModal.onClose}
            />
          ) : type === "Team" ? (
            <EditTeam
              team={value as TeamOut}
              isOpen={editUserModal.isOpen}
              onClose={editUserModal.onClose}
            />
          ) : type === "Skill" ? (
            <EditSkill
              skill={value as ToolOut}
              isOpen={editUserModal.isOpen}
              onClose={editUserModal.onClose}
            />
          ) : (
            type === "Upload" && (
              <EditUpload
                upload={value as UploadOut}
                isOpen={editUserModal.isOpen}
                onClose={editUserModal.onClose}
              />
            )
          ))}
        <Delete
          type={type}
          id={value.id}
          isOpen={deleteModal.isOpen}
          onClose={deleteModal.onClose}
        />
      </Menu>
    </>
  );
};

export default ActionsMenu;
