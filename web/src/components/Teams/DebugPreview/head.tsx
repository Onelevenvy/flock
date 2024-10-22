import { Box, Flex } from "@chakra-ui/react";
import { VscHistory } from "react-icons/vsc";
import { MdBuild } from "react-icons/md";

import CustomButton from "@/components/Common/CustomButton";
import ApiKeyButton from "../Apikey/ApiKeyManageButton";

interface DebugPreviewHeadProps {
  teamId: number;
  triggerSubmit: () => void;
  useDeployButton: boolean;
  useApiKeyButton: boolean;
}

function DebugPreviewHead({
  teamId,
  triggerSubmit,
  useDeployButton,
  useApiKeyButton,
}: DebugPreviewHeadProps) {
  return (
    <Box>
      <Flex justifyContent="flex-end" alignItems="center" px={4}>
        <CustomButton
          text=""
          variant="white"
          leftIcon={<VscHistory color="#155aef" size="16px" />}
          onClick={() => {
            /* 处理 History 按钮点击 */
          }}
          mr={2}
          aria-label="History"
        />
        {useApiKeyButton && <ApiKeyButton teamId={teamId.toString()} />}
        {useDeployButton && (
          <CustomButton
            text="Deploy"
            variant="blue"
            rightIcon={<MdBuild color="white" size="12px" />}
            onClick={triggerSubmit}
          />
        )}
      </Flex>
    </Box>
  );
}

export default DebugPreviewHead;
