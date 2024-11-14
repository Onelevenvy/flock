import { VStack, Heading, useDisclosure } from "@chakra-ui/react";
import { MdVpnKey } from "react-icons/md";

import ApiKeyManager from "./Apikey/ApiKeyManager";
import CustomButton from "../Common/CustomButton";

interface ConfigureTeamProps {
  teamId: string;
}

const ConfigureTeam: React.FC<ConfigureTeamProps> = ({ teamId }) => {
  const { isOpen, onOpen, onClose } = useDisclosure();

  return (
    <VStack 
      spacing={4} 
      align="stretch"
      p={6}
      bg="white"
      borderRadius="xl"
      border="1px solid"
      borderColor="gray.100"
      transition="all 0.2s"
      boxShadow="sm"
      _hover={{
        boxShadow: "md",
        borderColor: "gray.200",
      }}
    >
      <Heading 
        size="md" 
        color="gray.800"
        fontWeight="600"
      >
        Team Configuration
      </Heading>
      
      <CustomButton
        text="Manage API Keys"
        variant="white"
        rightIcon={<MdVpnKey />}
        onClick={onOpen}
        transition="all 0.2s"
        _hover={{
          transform: "translateY(-1px)",
          boxShadow: "sm",
        }}
        _active={{
          transform: "translateY(0)",
        }}
      />
      
      <ApiKeyManager 
        teamId={teamId} 
        isOpen={isOpen} 
        onClose={onClose} 
      />
    </VStack>
  );
};

export default ConfigureTeam;
