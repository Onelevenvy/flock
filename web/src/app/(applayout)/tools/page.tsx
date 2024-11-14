"use client";
import {
  Text,
  Box,
  Flex,
  Heading,
  HStack,
  SimpleGrid,
  Spinner,
  Tag,
  TagLabel,
  TagRightIcon,
  useColorModeValue,
  IconButton,
} from "@chakra-ui/react";
import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { MdSettings } from "react-icons/md";
import {
  RiApps2Fill,
  RiArchiveDrawerFill,
  RiBarChartFill,
} from "react-icons/ri";

import { type ApiError, SkillOut, ToolsService } from "@/client";
import ActionsMenu from "@/components/Common/ActionsMenu";
import TabSlider from "@/components/Common/TabSlider";
import ToolsIcon from "@/components/Icons/Tools";
import CredentialsPanel from "@/components/Tools/CredentialsPanel";
import useCustomToast from "@/hooks/useCustomToast";
import { useSkillsQuery } from "@/hooks/useSkillsQuery";
import { useTabSearchParams } from "@/hooks/useTabSearchparams";
import Navbar from "@/components/Common/Navbar";

function Skills() {
  const showToast = useCustomToast();
  const { t } = useTranslation();
  const rowTint = useColorModeValue("gray.50", "whiteAlpha.50");

  const {
    data: initialSkills,
    isLoading,
    isError,
    error,
    refetch,
  } = useSkillsQuery();
  const [skills, setSkills] = useState<SkillOut[] | undefined>(
    initialSkills?.data
  );

  useEffect(() => {
    if (initialSkills) {
      setSkills(initialSkills.data);
    }
  }, [initialSkills]);

  if (isError) {
    const errDetail = (error as ApiError).body?.detail;
    showToast("Something went wrong.", `${errDetail}`, "error");
  }

  const options = [
    {
      value: "all",
      text: t("panestate.tools.all"),
      icon: <RiApps2Fill className="w-[14px] h-[14px] mr-1" />,
    },
    {
      value: "managed",
      text: t("panestate.tools.builtin"),
      icon: <RiArchiveDrawerFill className="w-[14px] h-[14px] mr-1" />,
    },
    {
      value: "def",
      text: t("panestate.tools.custom"),
      icon: <RiBarChartFill className="w-[14px] h-[14px] mr-1" />,
    },
  ];

  const [activeTab, setActiveTab] = useTabSearchParams({
    searchParamName: "tooltype",
    defaultTab: "all",
  });

  const filteredSkills = skills?.filter((skill) => skill.name !== "ask-human");
  const [selectedSkill, setSelectedSkill] = useState<SkillOut | null>(null);

  return (
    <Flex>
      <Box flex="1" bg="ui.bgMain" minH="100vh" px={6} py={4}>
        {isLoading ? (
          <Flex justify="center" align="center" height="100vh" width="full">
            <Spinner size="xl" color="ui.main" thickness="3px" />
          </Flex>
        ) : (
          filteredSkills && (
            <Box maxW="full" maxH="full">
              <Flex
                direction="row"
                justify="space-between"
                align="center"
                mb={6}
              >
                <Box>
                  <TabSlider
                    value={activeTab}
                    onChange={setActiveTab}
                    options={options}
                  />
                </Box>
                <Box>
                  <Navbar type="Skill" />
                </Box>
              </Flex>

              <SimpleGrid
                columns={{ base: 1, md: 2, lg: 3, xl: 4 }}
                spacing={6}
              >
                {filteredSkills.map((skill) => (
                  <Box
                    key={skill.id}
                    onClick={() => setSelectedSkill(skill)}
                    cursor="pointer"
                    bg="white"
                    p={6}
                    borderRadius="xl"
                    border="1px solid"
                    borderColor="gray.100"
                    transition="all 0.2s"
                    _hover={{
                      transform: "translateY(-2px)",
                      boxShadow: "md",
                      borderColor: "gray.200",
                    }}
                  >
                    <HStack spacing={4} mb={4}>
                      <Box
                        borderRadius="lg"
                        bg={`${skill.managed ? "blue" : "purple"}.50`}
                        as={IconButton}
                      >
                        <ToolsIcon
                          h="6"
                          w="6"
                          tools_name={skill
                            .display_name!.toLowerCase()
                            .replace(/ /g, "_")}
                          color={`${skill.managed ? "blue" : "purple"}.500`}
                        />
                      </Box>
                      <Heading
                        size="md"
                        color="gray.700"
                        fontWeight="600"
                        noOfLines={1}
                      >
                        {skill.display_name}
                      </Heading>
                    </HStack>

                    <Box
                      overflow="hidden"
                      minH="55px"
                      h="55px"
                      maxH="55px"
                      mb={4}
                    >
                      <Text
                        color="gray.600"
                        fontSize="sm"
                        textOverflow="ellipsis"
                        noOfLines={2}
                      >
                        {skill.description}
                      </Text>
                    </Box>

                    <Flex justifyContent="space-between" alignItems="center">
                      {!skill.managed ? (
                        <ActionsMenu type="Skill" value={skill} />
                      ) : (
                        <Tag
                          size="md"
                          variant="subtle"
                          colorScheme="blue"
                          borderRadius="full"
                          px={3}
                          py={1}
                        >
                          <TagLabel fontWeight="500">Built-in</TagLabel>
                          <TagRightIcon as={MdSettings} />
                        </Tag>
                      )}
                    </Flex>
                  </Box>
                ))}
              </SimpleGrid>
            </Box>
          )
        )}
      </Box>

      {selectedSkill && (
        <CredentialsPanel
          skill={selectedSkill}
          onClose={() => setSelectedSkill(null)}
          onSave={async (updatedCredentials) => {
            try {
              await ToolsService.updateSkillCredentials({
                id: selectedSkill.id,
                requestBody: updatedCredentials,
              });

              showToast(
                "Success",
                "Credentials updated successfully",
                "success"
              );
              setSkills((prevSkills) =>
                prevSkills?.map((skill) =>
                  skill.id === selectedSkill.id
                    ? { ...skill, credentials: updatedCredentials }
                    : skill
                )
              );
              refetch();
            } catch (error) {
              showToast("Error", "Failed to update credentials", "error");
            }
          }}
        />
      )}
    </Flex>
  );
}

export default Skills;
