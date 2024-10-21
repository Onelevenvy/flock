import {
  Box,
  Icon,
  IconButton,
  Stack,
  Text,
  useColorModeValue,
  useDisclosure,
} from "@chakra-ui/react";
import { FiEdit2 } from "react-icons/fi";
import { GrUserWorker } from "react-icons/gr";
import type { NodeProps } from "reactflow";
import { Position } from "reactflow";

import EditTeamMember from "@/components/Members";

import type { MemberOut } from "../../../client";
import LimitConnectionHandle from "../Handles/LimitConnectionHandle";

export type FreelancerNodeData = {
  teamId: number;
  member: MemberOut;
};

export function FreelancerNode({ data }: NodeProps<FreelancerNodeData>) {
  const editMemberModal = useDisclosure();
  const bgColor = useColorModeValue("gray.50", "ui.darkSlate");

  return (
    <Box
      w="15rem"
      p={2}
      boxShadow="base"
      borderRadius="lg"
      bgColor={bgColor}
      transition="transform 0.2s"
      _hover={{ transform: "scale(1.01)" }}
    >
      <Stack direction="row" spacing={2} align="center" w="full">
        {/* <Icon as={GrUserWorker} boxSize={5} color="gray.400" /> */}
        <IconButton
          icon={<Icon as={GrUserWorker} size={"24"} />}
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
      <Box h="full">
        <EditTeamMember
          isOpen={editMemberModal.isOpen}
          onClose={editMemberModal.onClose}
          teamId={data.teamId}
          member={data.member}
        />
      </Box>
      {data.member.type !== "freelancer_root" && (
        <LimitConnectionHandle
          type="target"
          position={Position.Top}
          connectionLimit={1}
        />
      )}
      <LimitConnectionHandle
        type="source"
        position={Position.Bottom}
        connectionLimit={1}
      />
    </Box>
  );
}
