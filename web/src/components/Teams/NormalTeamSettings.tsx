import {
  Box,
  Flex,
  Spinner,
  useDisclosure,
  useColorModeValue,
} from "@chakra-ui/react";
import { useParams } from "next/navigation";
import { useRef } from "react";
import { useQuery } from "react-query";

import { type ApiError, MembersService, type TeamOut } from "@/client";
import useCustomToast from "@/hooks/useCustomToast";

import EditTeamMember from "../Members";
import DebugPreview from "./DebugPreview";
import TeamInforCard from "./TeamInfo";

export default function NormalTeamSettings({
  teamData,
}: {
  teamData: TeamOut;
}) {
  const editMemberModal = useDisclosure();
  const { teamId } = useParams() as { teamId: string };
  const showToast = useCustomToast();
  const formRef = useRef<HTMLFormElement>(null);

  const bgColor = useColorModeValue("white", "gray.800");
  const borderColor = useColorModeValue("gray.100", "gray.700");

  const {
    data: members,
    isLoading,
    isError,
    error,
  } = useQuery(`teams/${teamId}/members`, () =>
    MembersService.readMembers({ teamId: Number.parseInt(teamId) })
  );

  if (isError) {
    const errDetail = (error as ApiError).body?.detail;
    showToast("Something went wrong.", `${errDetail}`, "error");
  }

  const triggerSubmit = () => {
    if (formRef.current) {
      formRef.current.requestSubmit();
    }
  };

  if (isLoading) {
    return (
      <Flex justify="center" align="center" height="100vh" width="full">
        <Spinner size="xl" color="ui.main" thickness="3px" speed="0.8s" />
      </Flex>
    );
  }

  return (
    <Box
      h="full"
      maxH="full"
      minH="full"
      w="full"
      minW="full"
      display="flex"
      flexDirection="row"
      p={4}
      gap={4}
    >
      <Box w="30%" display="flex" flexDirection="column" gap={4}>
        <Box>
          <TeamInforCard teamData={teamData} />
        </Box>
        <Box
          flex={1}
          overflowY="auto"
          bg={bgColor}
          borderRadius="xl"
          border="1px solid"
          borderColor={borderColor}
          p={4}
          transition="all 0.2s"
          _hover={{
            boxShadow: "sm",
          }}
          sx={{
            "&::-webkit-scrollbar": {
              width: "4px",
            },
            "&::-webkit-scrollbar-track": {
              bg: "gray.50",
            },
            "&::-webkit-scrollbar-thumb": {
              bg: "gray.300",
              borderRadius: "full",
            },
          }}
        >
          {members?.data?.map((member) => (
            <EditTeamMember
              key={member.id}
              teamId={Number.parseInt(teamId)}
              member={member}
              isOpen={editMemberModal.isOpen}
              onClose={editMemberModal.onClose}
              ref={formRef}
            />
          ))}
        </Box>
      </Box>

      <Box flex={1} display="flex" flexDirection="column" overflow="hidden">
        <DebugPreview
          teamId={Number.parseInt(teamId)}
          triggerSubmit={triggerSubmit}
          useDeployButton={true}
          useApiKeyButton={true}
        />
      </Box>
    </Box>
  );
}
