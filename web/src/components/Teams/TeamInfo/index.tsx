import { Box, Tag, TagLabel, Text, VStack, useColorModeValue } from "@chakra-ui/react";
import { useTranslation } from "react-i18next";

import type { TeamOut } from "@/client";

function TeamInforCard({ teamData }: { teamData: TeamOut }) {
  const { t } = useTranslation();
  const bgColor = useColorModeValue("white", "gray.800");
  const borderColor = useColorModeValue("gray.100", "gray.700");
  const labelColor = useColorModeValue("gray.500", "gray.400");
  const textColor = useColorModeValue("gray.700", "gray.300");

  return (
    <Box
      key={teamData.id}
      p={6}
      borderRadius="xl"
      border="1px solid"
      borderColor={borderColor}
      bg={bgColor}
      transition="all 0.2s"
      boxShadow="sm"
      _hover={{
        boxShadow: "md",
        borderColor: "gray.200",
        transform: "translateY(-1px)",
      }}
    >
      <VStack spacing={4} align="stretch">
        <Box>
          <Text 
            color={labelColor} 
            fontSize="sm" 
            fontWeight="500"
            mb={2}
          >
            {t("team.teamsetting.type")}
          </Text>
          <Tag 
            variant="subtle" 
            colorScheme="blue" 
            size="md"
            borderRadius="full"
            px={3}
            py={1}
          >
            <TagLabel fontWeight="500">
              {teamData.workflow || "N/A"}
            </TagLabel>
          </Tag>
        </Box>

        <Box>
          <Text 
            color={labelColor}
            fontSize="sm"
            fontWeight="500"
            mb={2}
          >
            {t("team.teamsetting.description")}
          </Text>
          <Text
            color={textColor}
            fontSize="sm"
            noOfLines={3}
            lineHeight="tall"
          >
            {teamData.description || "N/A"}
          </Text>
        </Box>
      </VStack>
    </Box>
  );
}

export default TeamInforCard;
