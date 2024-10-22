import { Box, Flex, useDisclosure } from "@chakra-ui/react";
import { VscTriangleRight } from "react-icons/vsc";
import { MdBuild, MdVpnKey } from "react-icons/md";

import CustomButton from "@/components/Common/CustomButton";
import ApiKeyManager from "../Apikey/ApiKeyManager";

function DebugPreviewHead({
  teamId,
  triggerSubmit,
  useDeployButton,
}: {
  teamId: number;
  triggerSubmit: () => void;
  useDeployButton: boolean;
}) {
  const { isOpen, onOpen, onClose } = useDisclosure();

  return (
    <Box>
      <Flex justifyContent="flex-end" alignItems="center" px={4}>
        <CustomButton
          text="Debug"
          variant="white"
          rightIcon={<VscTriangleRight color="#155aef" size="12px" />}
          onClick={() => {
            /* 处理 Debug 按钮点击 */
          }}
          mr={2}
        />
        <CustomButton
          text="API Keys"
          variant="white"
          rightIcon={<MdVpnKey color="#155aef" size="12px" />}
          onClick={onOpen}
          mr={2}
        />
        {useDeployButton && (
          <CustomButton
            text="Deploy"
            variant="blue"
            rightIcon={<MdBuild color="white" size="12px" />}
            onClick={triggerSubmit}
          />
        )}
      </Flex>
      <ApiKeyManager teamId={teamId.toString()} isOpen={isOpen} onClose={onClose} />
    </Box>
  );
}

export default DebugPreviewHead;
