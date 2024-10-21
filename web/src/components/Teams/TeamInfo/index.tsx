import { Box, Tag, TagLabel, Text } from "@chakra-ui/react";
import { useTranslation } from "react-i18next";

import type { TeamOut } from "@/client";

function TeamInforCard({ teamData }: { teamData: TeamOut }) {
  const { t } = useTranslation();

  return (
    <Box
      key={teamData.id}
      cursor={"pointer"}
      p={4}
      borderRadius="md"
      borderWidth="1px"
      borderColor="gray.200"
      bg="white"
    >
      <Box justifyItems={"center"} display={"flex"} flexDirection={"row"}>
        <Text color="gray.400">{t("team.teamsetting.type")}：</Text>
        <Tag variant="outline" colorScheme="green" size={"sm"}>
          <TagLabel>{teamData.workflow || "N/A"}</TagLabel>
        </Tag>
      </Box>
      <Box mt={3} minH={"10"}>
        <Text
          color={!teamData.description ? "gray.400" : "gray.400"}
          noOfLines={2}
        >
          {t("team.teamsetting.description")}：{teamData.description || "N/A"}
        </Text>
      </Box>
    </Box>
  );
}

export default TeamInforCard;
