import { useDisclosure, ButtonProps } from "@chakra-ui/react";
import { MdVpnKey } from "react-icons/md";
import CustomButton from "@/components/Common/CustomButton";
import ApiKeyManager from "./ApiKeyManager";

interface ApiKeyButtonProps extends ButtonProps {
  teamId: string;
}

const ApiKeyButton: React.FC<ApiKeyButtonProps> = ({ teamId, ...rest }) => {
  const { isOpen, onOpen, onClose } = useDisclosure();

  return (
    <>
      <CustomButton
        text="API Keys"
        variant="white"
        rightIcon={<MdVpnKey color="#155aef" size="12px" />}
        onClick={onOpen}
        {...rest}
      />
      <ApiKeyManager teamId={teamId} isOpen={isOpen} onClose={onClose} />
    </>
  );
};

export default ApiKeyButton;