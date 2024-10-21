import {
  Box,
  Icon,
  IconButton,
  Stack,
  Text,
  useDisclosure,
} from "@chakra-ui/react";
import { FiEdit2 } from "react-icons/fi";
import { GrUserManager } from "react-icons/gr";
import type { NodeProps } from "reactflow";
import { Handle, Position } from "reactflow";

import EditTeamMember from "@/components/Members";

import type { MemberOut } from "../../../client";

export type RootNodeData = {
  teamId: number;
  member: MemberOut;
};

export function RootNode({ data }: NodeProps<RootNodeData>) {
  const editMemberModal = useDisclosure();

  return (
    <Box
      w="15rem"
      p={2}
      boxShadow="base"
      borderRadius="lg"
      bgColor={"white.500"}
    >
      <Stack direction="row" spacing={2} align="center" w="full">
        <IconButton
          icon={<Icon as={GrUserManager} size={"24"} />}
          aria-label="root_agent"
          colorScheme="green"
          size={"xs"}
        />
        <Stack spacing={0} w="70%">
          <Text fontWeight="bold" noOfLines={1}>
            {data.member.name}
          </Text>
          <Text fontSize="x-small" noOfLines={2}>
            {data.member.role}
          </Text>
        </Stack>
        <IconButton
          size="xs"
          aria-label="Edit Member"
          icon={<FiEdit2 />}
          onClick={editMemberModal.onOpen}
          variant="outline"
          colorScheme="blue"
        />
      </Stack>
      <EditTeamMember
        isOpen={editMemberModal.isOpen}
        onClose={editMemberModal.onClose}
        teamId={data.teamId}
        member={data.member}
      />
      <Handle type="source" position={Position.Bottom} />
    </Box>
  );
}
