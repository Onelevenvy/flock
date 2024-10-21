import { Box, Flex, Spinner, useDisclosure } from "@chakra-ui/react";
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
  const {
    data: members,
    isLoading,
    isError,
    error,
  } = useQuery(`teams/${teamId}/members`, () =>
    MembersService.readMembers({ teamId: Number.parseInt(teamId) }),
  );

  const member = members?.data || [];

  if (isError) {
    const errDetail = (error as ApiError).body?.detail;

    showToast("Something went wrong.", `${errDetail}`, "error");
  }
  const formRef = useRef<HTMLFormElement>(null);
  const triggerSubmit = () => {
    if (formRef.current) {
      formRef.current.requestSubmit();
    }
  };

  return (
    <>
      {isLoading ? (
        <Flex justify="center" align="center" height="100vh" width="full">
          <Spinner size="xl" color="ui.main" />
        </Flex>
      ) : (
        <Box
          h="full"
          maxH={"full"}
          minH={"full"}
          w="full"
          minW="full"
          display={"flex"}
          flexDirection={"row"}
          borderRadius="md"
        >
          <Box
            display={"flex"}
            w="full"
            flexDirection={"row"}
            m="1"
            maxH={"full"}
          >
            <Box
              bg="transparent"
              h={"full"}
              maxH={"full"}
              w="30%"
              display={"flex"}
              flexDirection={"column"}
              mr="4"
            >
              <Box w="full" mb={"2"}>
                <TeamInforCard teamData={teamData} />
              </Box>
              <Box h={"full"} maxH={"full"} overflow={"auto"}>
                {member?.map((member) => (
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

            <Box
              w="full"
              display={"flex"}
              flexDirection={"column"}
              overflow={"hidden"}
            >
              <DebugPreview
                teamId={Number.parseInt(teamId)}
                triggerSubmit={triggerSubmit}
                useDeployButton={true}
              />
            </Box>
          </Box>
        </Box>
      )}
    </>
  );
}
