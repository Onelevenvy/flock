"use client";
import {
  Container,
  Flex,
  Spinner,
  Text,
  Tabs,
  TabList,
  Tab,
  TabPanels,
  TabPanel,
} from "@chakra-ui/react";
import { useQuery } from "react-query";
import {
  type ApiError,
  UsersService,
  GroupsService,
  RolesService,
} from "@/client";
import useAuth from "@/hooks/useAuth";
import useCustomToast from "@/hooks/useCustomToast";
import { useTranslation } from "react-i18next";
import UserTab from "./UserTab";
import GroupTab from "./GroupTab";
import RoleTab from "./RoleTab";
import { useState } from "react";

const PAGE_SIZE = 10;

function MembersPage() {
  const showToast = useCustomToast();
  const { currentUser } = useAuth();
  const { t } = useTranslation();
  const [currentPage, setCurrentPage] = useState(1);

  // Fetch data for all tabs
  const {
    data: users,
    isLoading: isLoadingUsers,
    isError: isErrorUsers,
    error: errorUsers,
  } = useQuery(["users", currentPage], () =>
    UsersService.readUsers({
      skip: (currentPage - 1) * PAGE_SIZE,
      limit: PAGE_SIZE,
    }),
  );

  const {
    data: groups,
    isLoading: isLoadingGroups,
    isError: isErrorGroups,
    error: errorGroups,
  } = useQuery("groups", () => GroupsService.readGroups({}));

  const {
    data: roles,
    isLoading: isLoadingRoles,
    isError: isErrorRoles,
    error: errorRoles,
  } = useQuery("roles", () => RolesService.readRoles({}));

  if (isErrorUsers || isErrorGroups || isErrorRoles) {
    const errDetail =
      (isErrorUsers && (errorUsers as ApiError).body?.detail) ||
      (isErrorGroups && (errorGroups as ApiError).body?.detail) ||
      (isErrorRoles && (errorRoles as ApiError).body?.detail);
    showToast("Something went wrong.", `${errDetail}`, "error");
  }

  const isLoading = isLoadingUsers || isLoadingGroups || isLoadingRoles;

  if (isLoading) {
    return (
      <Flex
        justify="center"
        align="center"
        height="100vh"
        width="full"
        bg="ui.bgMain"
      >
        <Spinner size="xl" color="ui.main" thickness="3px" speed="0.8s" />
      </Flex>
    );
  }

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  return (
    <Container maxW="full">
      <Flex justifyContent="space-between" mb={6}>
        <Text fontSize="2xl" fontWeight="bold">
          Settings
        </Text>
      </Flex>

      <Tabs>
        <TabList mb={6}>
          <Tab>{t("setting.setting.usermanagement")}</Tab>
          <Tab>{t("setting.setting.groupmanagement")}</Tab>
          <Tab>{t("setting.setting.rolemanagement")}</Tab>
        </TabList>

        <TabPanels>
          <TabPanel p={0}>
            <UserTab
              users={users?.data || []}
              currentUserId={currentUser?.id}
              totalCount={users?.count || 0}
              onPageChange={handlePageChange}
            />
          </TabPanel>
          <TabPanel p={0}>
            <GroupTab groups={groups?.data || []} users={users?.data || []} />
          </TabPanel>
          <TabPanel p={0}>
            <RoleTab
              roles={roles?.data || []}
              groups={groups?.data || []}
              users={users?.data || []}
            />
          </TabPanel>
        </TabPanels>
      </Tabs>
    </Container>
  );
}

export default MembersPage;
