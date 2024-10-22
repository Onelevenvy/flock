import { VStack, Heading, useDisclosure } from "@chakra-ui/react";
import ApiKeyManager from "./Apikey/ApiKeyManager";
import CustomButton from "../Common/CustomButton";
import { MdVpnKey } from "react-icons/md";

interface ConfigureTeamProps {
  teamId: string;
}

const ConfigureTeam: React.FC<ConfigureTeamProps> = ({ teamId }) => {
  const { isOpen, onOpen, onClose } = useDisclosure();

  return (
    <VStack spacing={4} align="stretch">
      <Heading size="xl">Team Configuration</Heading>
      <CustomButton
        text="Manage API Keys"
        variant="white"
        rightIcon={<MdVpnKey color="#155aef" size="12px" />}
        onClick={onOpen}
      />
      <ApiKeyManager teamId={teamId} isOpen={isOpen} onClose={onClose} />
    </VStack>
  );
};

export default ConfigureTeam;
