"use client";
import {
  Box,
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  Flex,
  Spinner,
  useColorModeValue,
} from "@chakra-ui/react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useRef } from "react";
import { useQuery } from "react-query";
import { ChevronRightIcon } from "@chakra-ui/icons";
import { FiUsers } from "react-icons/fi";

import { type ApiError, TeamsService } from "@/client";
import Flow from "@/components/ReactFlow/Flow";
import DebugPreview from "@/components/Teams/DebugPreview";
import NormalTeamSettings from "@/components/Teams/NormalTeamSettings";
import WorkflowTeamSettings from "@/components/Teams/WorkflowTeamSettings";
import useCustomToast from "@/hooks/useCustomToast";

function Team() {
  const showToast = useCustomToast();
  const { teamId } = useParams() as { teamId: string };
  const formRef = useRef<HTMLFormElement>(null);

  // 使用主题颜色
  const breadcrumbBg = useColorModeValue("ui.inputbgcolor", "gray.700");
  const flowBg = useColorModeValue("ui.bgMain", "gray.800");

  const {
    data: team,
    isLoading,
    isError,
    error,
  } = useQuery(`team/${teamId}`, () =>
    TeamsService.readTeam({ id: Number.parseInt(teamId) })
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
      <Flex 
        justify="center" 
        align="center" 
        height="100vh" 
        width="full"
        bg="ui.bgMain"
      >
        <Spinner 
          size="xl" 
          color="ui.main" 
          thickness="3px"
          speed="0.8s"
        />
      </Flex>
    );
  }

  return (
    team && (
      <Box
        display="flex"
        h="full"
        maxH="full"
        flexDirection="column"
        overflow="hidden"
        bg="ui.bgMain"
      >
        <Box 
          py={4} 
          px={6}
          bg={breadcrumbBg}
          borderBottom="1px solid"
          borderColor="gray.100"
          backdropFilter="blur(10px)"
          transition="all 0.2s"
          position="relative"
          zIndex={1}
          _after={{
            content: '""',
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backdropFilter: "blur(8px)",
            zIndex: -1,
          }}
        >
          <Breadcrumb
            spacing="8px"
            separator={
              <ChevronRightIcon 
                color="gray.400" 
                fontSize="sm"
                transition="all 0.2s"
              />
            }
          >
            <BreadcrumbItem>
              <BreadcrumbLink as={Link} href="/teams">
                <Box 
                  display="flex" 
                  alignItems="center" 
                  color="gray.600" 
                  fontSize="sm" 
                  fontWeight="500"
                >
                  <FiUsers style={{ marginRight: "6px" }} />
                  Teams
                </Box>
              </BreadcrumbLink>
            </BreadcrumbItem>
            
            <BreadcrumbItem isCurrentPage>
              <BreadcrumbLink
                fontSize="sm"
                fontWeight="600"
                color="gray.800"
                display="flex"
                alignItems="center"
                bg="white"
                px={3}
                py={1}
                borderRadius="full"
                boxShadow="sm"
              >
                {team.name}
              </BreadcrumbLink>
            </BreadcrumbItem>
          </Breadcrumb>
        </Box>

        <Box
          flex={1}
          display="flex"
          flexDirection="column"
          maxH="full"
          overflow="hidden"
          p={2}
        >
          {team.workflow === "sequential" || team.workflow === "hierarchical" ? (
            <Flex h="full" gap={4}>
              <Box 
                flex={3}
                bg={flowBg}
                borderRadius="xl"
                border="1px solid"
                borderColor="gray.100"
                overflow="hidden"
                transition="all 0.2s"
                _hover={{
                  boxShadow: "sm",
                }}
              >
                <Flow />
              </Box>
              <Box 
                flex={1}
                borderRadius="xl"
                bg="white"
                border="1px solid"
                borderColor="gray.100"
                transition="all 0.2s"
                _hover={{
                  boxShadow: "sm",
                }}
              >
                <DebugPreview
                  teamId={Number.parseInt(teamId)}
                  triggerSubmit={triggerSubmit}
                  useDeployButton={true}
                  useApiKeyButton={true}
                />
              </Box>
            </Flex>
          ) : team.workflow === "workflow" ? (
            <Box
              h="full"
              borderRadius="xl"
              bg="white"
              border="1px solid"
              borderColor="gray.100"
              transition="all 0.2s"
              _hover={{
                boxShadow: "sm",
              }}
            >
              <WorkflowTeamSettings teamId={Number.parseInt(teamId)} />
            </Box>
          ) : (
            <Box
              h="full"
              borderRadius="xl"
              bg="white" 
              border="1px solid"
              borderColor="gray.100"
              transition="all 0.2s"
              _hover={{
                boxShadow: "sm",
              }}
            >
              <NormalTeamSettings teamData={team} />
            </Box>
          )}
        </Box>
      </Box>
    )
  );
}

export default Team;
