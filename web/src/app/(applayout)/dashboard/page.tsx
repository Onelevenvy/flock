"use client";
import {
  Box,
  Container,
  Grid,
  Heading,
  Text,
  VStack,
  HStack,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  Link,
  List,
  ListItem,
  ListIcon,
  Icon,
  Flex,
  Badge,
  useColorModeValue,
  SimpleGrid,
  Card,
  CardHeader,
  CardBody,
  Button,
} from "@chakra-ui/react";
import NextLink from "next/link";
import React from "react";
import {
  FiUsers,
  FiFileText,
  FiTool,
  FiCpu,
  FiActivity,
  FiBox,
  FiGithub,
} from "react-icons/fi";
import { useQuery } from "react-query";

import { TeamOut } from "@/client/models/TeamOut";
import { TeamsService } from "@/client/services/TeamsService";
import useAuth from "@/hooks/useAuth";
import { useModelQuery } from "@/hooks/useModelQuery";
import { useSkillsQuery } from "@/hooks/useSkillsQuery";
import { useUploadsQuery } from "@/hooks/useUploadsQuery";



interface StatCardProps {
  icon: React.ElementType;
  title: string;
  stat: number;
  description: string;
  color: string;
}

function StatCard({ icon, title, stat, description, color }: StatCardProps) {
  return (
    <Card>
      <CardBody>
        <Stat>
          <Flex alignItems="center">
            <Box
              my="-0.5rem"
              color={`${color}.500`}
              borderRadius="md"
              bg={`${color}.100`}
              p={2}
            >
              <Icon as={icon} boxSize="1.5rem" />
            </Box>
            <StatLabel ml={3} fontSize="sm" fontWeight="medium" isTruncated>
              {title}
            </StatLabel>
          </Flex>
          <StatNumber fontSize="2xl" fontWeight="medium" mt={2}>
            {stat}
          </StatNumber>
          <StatHelpText fontSize="sm">{description}</StatHelpText>
        </Stat>
      </CardBody>
    </Card>
  );
}

interface QuickAccessItemProps {
  icon: React.ElementType;
  href: string;
  color: string;
  children: React.ReactNode;
}

function QuickAccessItem({
  icon,
  href,
  color,
  children,
}: QuickAccessItemProps) {
  return (
    <ListItem>
      <NextLink href={href} passHref legacyBehavior>
        <Link as="a" _hover={{ textDecoration: "none" }}>
          <HStack>
            <ListIcon as={icon} color={color} />
            <Text>{children}</Text>
          </HStack>
        </Link>
      </NextLink>
    </ListItem>
  );
}

function Dashboard() {
  const { currentUser } = useAuth();
  const { data: modelsData } = useModelQuery();
  const { data: skillsData } = useSkillsQuery();
  const { data: uploadsData } = useUploadsQuery();
  const { data: teamsData } = useQuery("teams", () =>
    TeamsService.readTeams({})
  );



  return (
    <Container maxW="full" p={0}>
      <Box bg={useColorModeValue("gray.50", "gray.900")} minH="100vh" py={12}>
        <Container maxW="7xl">
          <VStack spacing={8} align="stretch">
            <Flex justifyContent="space-between" alignItems="center">
              <Heading as="h1" size="xl">
                Welcome, {currentUser?.full_name || currentUser?.email} 👋
              </Heading>
              <Badge colorScheme="green" p={2} borderRadius="md">
                <HStack>
                  <Icon as={FiActivity} />
                  <Text>Online</Text>
                </HStack>
              </Badge>
            </Flex>

            <SimpleGrid columns={{ base: 1, md: 2, lg: 4 }} spacing={6}>
              <StatCard
                icon={FiCpu}
                title="Supported Models"
                stat={modelsData?.data?.length || 0}
                description="Available AI models"
                color="blue"
              />
              <StatCard
                icon={FiTool}
                title="Total Tools"
                stat={skillsData?.data?.length || 0}
                description="Configured tools"
                color="purple"
              />
              <StatCard
                icon={FiFileText}
                title="Completed Uploads"
                stat={
                  uploadsData?.data?.filter(
                    (upload) => upload.status === "Completed"
                  ).length || 0
                }
                description="Successfully processed"
                color="green"
              />
              <StatCard
                icon={FiUsers}
                title="Total Teams"
                stat={teamsData?.data?.length || 0}
                description="Your teams"
                color="orange"
              />
            </SimpleGrid>

            {/* 新增 Flock 介绍卡片 */}
            <Card>
              <CardBody>
                <VStack align="start" spacing={4}>
                  <Heading size="md">Welcome to Flock</Heading>
                  <Text>
                    Flock is a low-code platform for rapidly building chatbots,
                    RAG applications, and coordinating multi-agent teams,
                    primarily using LangChain, LangGraph, NextJS, and FastAPI.
                  </Text>
                  <NextLink
                    href="https://github.com/Onelevenvy/flock"
                    passHref
                    legacyBehavior
                  >
                    <Link
                      as="a"
                      target="_blank"
                      rel="noopener noreferrer"
                      _hover={{ textDecoration: "none" }}
                    >
                      <Button leftIcon={<FiGithub />} colorScheme="gray">
                        View on GitHub
                      </Button>
                    </Link>
                  </NextLink>
                </VStack>
              </CardBody>
            </Card>

            <Grid templateColumns={{ base: "1fr", md: "1fr 1fr" }} gap={6}>
              <Card>
                <CardHeader>
                  <Heading size="md">Quick Access</Heading>
                </CardHeader>
                <CardBody>
                  <List spacing={3}>
                    <QuickAccessItem
                      icon={FiUsers}
                      href="/teams"
                      color="green.500"
                    >
                      Manage Team
                    </QuickAccessItem>
                    <QuickAccessItem
                      icon={FiFileText}
                      href="/knowledge"
                      color="blue.500"
                    >
                      View Uploads
                    </QuickAccessItem>
                    <QuickAccessItem
                      icon={FiTool}
                      href="/tools"
                      color="purple.500"
                    >
                      Configure Skills
                    </QuickAccessItem>
                    <QuickAccessItem
                      icon={FiCpu}
                      href="/models"
                      color="red.500"
                    >
                      Explore Models
                    </QuickAccessItem>
                  </List>
                </CardBody>
              </Card>
              <Card>
                <CardHeader>
                  <Heading size="md">Your Recent Teams</Heading>
                </CardHeader>
                <CardBody>
                  <List spacing={3}>
                    {teamsData?.data?.slice(0, 5).map((team: TeamOut) => (
                      <ListItem key={team.id}>
                        <HStack>
                          <Icon as={FiBox} color="teal.500" />
                          <Text fontWeight="medium">{team.name}</Text>
                          <Badge colorScheme="teal" ml="auto">
                            {team.workflow}
                          </Badge>
                        </HStack>
                      </ListItem>
                    ))}
                  </List>
                  {teamsData?.data && teamsData.data.length > 5 && (
                    <Text mt={2} color="gray.500" fontSize="sm">
                      And {teamsData.data.length - 5} more teams...
                    </Text>
                  )}
                </CardBody>
              </Card>
            </Grid>
          </VStack>
        </Container>
      </Box>
    </Container>
  );
}

export default Dashboard;
