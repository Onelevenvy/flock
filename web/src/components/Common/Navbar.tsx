import { Button, Flex, Icon, useDisclosure } from "@chakra-ui/react";
import { useTranslation } from "react-i18next";
import { FaPlus } from "react-icons/fa";

import AddUser from "@/components/Admin/AddUser";
import AddTeam from "@/components/Teams/AddTeam";
import AddSkill from "@/components/Tools/AddSkill";
import AddUpload from "@/components/Uploads/AddUpload";

interface NavbarProps {
  type: string;
}

const Navbar = ({ type }: NavbarProps) => {
  const addUserModal = useDisclosure();
  const addTeamModal = useDisclosure();
  const addSkillModal = useDisclosure();
  const addUploadModal = useDisclosure();
  const { t } = useTranslation();

  return (
    <>
      <Flex gap={2}>
        <Button
          variant="primary"
          leftIcon={<Icon as={FaPlus} boxSize={3} />}
          fontSize="sm"
          fontWeight="500"
          px={4}
          py={2}
          borderRadius="lg"
          bg="ui.main"
          color="white"
          transition="all 0.2s"
          _hover={{
            transform: "translateY(-1px)",
            boxShadow: "md",
            bg: "blue.500",
          }}
          _active={{
            transform: "translateY(0)",
            bg: "blue.600",
          }}
          onClick={
            type === "User"
              ? addUserModal.onOpen
              : type === "Team"
                ? addTeamModal.onOpen
                : type === "Skill"
                  ? addSkillModal.onOpen
                  : addUploadModal.onOpen
          }
        >
          {t("setting.create")} {t(`setting.${type.toLowerCase()}`)}
        </Button>

        {/* Modals */}
        <AddUser isOpen={addUserModal.isOpen} onClose={addUserModal.onClose} />
        <AddTeam isOpen={addTeamModal.isOpen} onClose={addTeamModal.onClose} />
        <AddSkill isOpen={addSkillModal.isOpen} onClose={addSkillModal.onClose} />
        <AddUpload
          isOpen={addUploadModal.isOpen}
          onClose={addUploadModal.onClose}
        />
      </Flex>
    </>
  );
};

export default Navbar;
