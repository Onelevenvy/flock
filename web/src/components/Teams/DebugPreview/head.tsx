import { Box, Flex } from "@chakra-ui/react";
import { VscTriangleRight } from "react-icons/vsc";
import { MdBuild } from "react-icons/md";

import CustomButton from "@/components/Common/CustomButton";
import ApiKeyButton from "../Apikey/ApiKeyManageButton";

function DebugPreviewHead({
  teamId,
  triggerSubmit,
  useDeployButton,
}: {
  teamId: number;
  triggerSubmit: () => void;
  useDeployButton: boolean;
}) {
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
        <ApiKeyButton teamId={teamId.toString()} />
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
