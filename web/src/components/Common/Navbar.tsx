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
          gap={1}
          fontSize="sm"
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
          <Icon as={FaPlus} /> {t("setting.create")}{" "}
          {t(`setting.${type.toLowerCase()}`)}
        </Button>
        <AddUser isOpen={addUserModal.isOpen} onClose={addUserModal.onClose} />
        <AddTeam isOpen={addTeamModal.isOpen} onClose={addTeamModal.onClose} />
        <AddSkill
          isOpen={addSkillModal.isOpen}
          onClose={addSkillModal.onClose}
        />
        <AddUpload
          isOpen={addUploadModal.isOpen}
          onClose={addUploadModal.onClose}
        />
      </Flex>
    </>
  );
};

export default Navbar;
