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
    <Card
      transition="all 0.2s"
      _hover={{
        transform: "translateY(-2px)",
        boxShadow: "lg",
      }}
    >
      <CardBody>
        <Stat>
          <Flex alignItems="center">
            <Box
              my="-0.5rem"
              color={`${color}.500`}
              borderRadius="xl"
              bg={`${color}.50`}
              p={3}
              transition="all 0.2s"
              _hover={{ bg: `${color}.100` }}
            >
              <Icon as={icon} boxSize="1.75rem" />
            </Box>
            <StatLabel ml={4} fontSize="md" fontWeight="500" isTruncated>
              {title}
            </StatLabel>
          </Flex>
          <StatNumber
            fontSize="3xl"
            fontWeight="600"
            mt={3}
            color={`${color}.600`}
          >
            {stat}
          </StatNumber>
          <StatHelpText fontSize="sm" color="ui.muted" mt={1}>
            {description}
          </StatHelpText>
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
        <Link
          as="a"
          display="flex"
          alignItems="center"
          p={3}
          borderRadius="lg"
          transition="all 0.2s"
          _hover={{
            textDecoration: "none",
            bg: "gray.50",
            transform: "translateX(2px)",
          }}
        >
          <ListIcon as={icon} color={`${color}.500`} fontSize="xl" />
          <Text ml={2} color="gray.700" fontWeight="500">
            {children}
          </Text>
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
      <Box bg="ui.bgMain" minH="100vh" py={8}>
        <Container maxW="7xl">
          <VStack spacing={8} align="stretch">
            <Flex
              justifyContent="space-between"
              alignItems="center"
              bg="white"
              p={6}
              borderRadius="2xl"
              boxShadow="sm"
              backdropFilter="blur(10px)"
              border="1px solid"
              borderColor="gray.100"
            >
              <Heading as="h1" size="lg" color="gray.800">
                Welcome back, {currentUser?.full_name || currentUser?.email} 👋
              </Heading>
              <Badge
                colorScheme="green"
                p={2}
                borderRadius="lg"
                display="flex"
                alignItems="center"
                gap={2}
                bg="green.50"
              >
                <Icon as={FiActivity} color="green.500" />
                <Text color="green.700" fontWeight="500">
                  Online
                </Text>
              </Badge>
            </Flex>

            <SimpleGrid columns={{ base: 1, md: 2, lg: 4 }} spacing={6}>
              <StatCard
                icon={FiCpu}
                title="AI Models"
                stat={modelsData?.data?.length || 0}
                description="Available models"
                color="blue"
              />
              <StatCard
                icon={FiTool}
                title="Tools"
                stat={skillsData?.data?.length || 0}
                description="Active tools"
                color="purple"
              />
              <StatCard
                icon={FiFileText}
                title="Uploads"
                stat={
                  uploadsData?.data?.filter((u) => u.status === "Completed")
                    .length || 0
                }
                description="Processed files"
                color="green"
              />
              <StatCard
                icon={FiUsers}
                title="Teams"
                stat={teamsData?.data?.length || 0}
                description="Active teams"
                color="orange"
              />
            </SimpleGrid>

            <Card transition="all 0.2s" _hover={{ boxShadow: "md" }}>
              <CardBody>
                <VStack align="start" spacing={4}>
                  <Heading size="md" color="gray.800">
                    Welcome to Flock
                  </Heading>
                  <Text color="gray.600" lineHeight="tall">
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
                      <Button
                        leftIcon={<FiGithub />}
                        variant="outline"
                        colorScheme="gray"
                        size="lg"
                        transition="all 0.2s"
                        _hover={{
                          transform: "translateY(-1px)",
                          shadow: "md",
                        }}
                      >
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
                  <Heading size="md" color="gray.800">
                    Quick Access
                  </Heading>
                </CardHeader>
                <CardBody>
                  <List spacing={3}>
                    <QuickAccessItem icon={FiUsers} href="/teams" color="green">
                      Manage Teams
                    </QuickAccessItem>
                    <QuickAccessItem
                      icon={FiFileText}
                      href="/knowledge"
                      color="blue"
                    >
                      View Uploads
                    </QuickAccessItem>
                    <QuickAccessItem icon={FiTool} href="/tools" color="purple">
                      Configure Tools
                    </QuickAccessItem>
                    <QuickAccessItem icon={FiCpu} href="/models" color="red">
                      Explore Models
                    </QuickAccessItem>
                  </List>
                </CardBody>
              </Card>

              <Card>
                <CardHeader>
                  <Heading size="md" color="gray.800">
                    Recent Teams
                  </Heading>
                </CardHeader>
                <CardBody>
                  <List spacing={3}>
                    {teamsData?.data?.slice(0, 5).map((team: TeamOut) => (
                      <ListItem
                        key={team.id}
                        p={3}
                        borderRadius="lg"
                        transition="all 0.2s"
                        _hover={{
                          bg: "gray.50",
                        }}
                      >
                        <HStack spacing={3}>
                          <Icon as={FiBox} color="teal.500" boxSize="1.2em" />
                          <Text fontWeight="500" color="gray.700">
                            {team.name}
                          </Text>
                          <Badge
                            colorScheme="teal"
                            ml="auto"
                            borderRadius="full"
                            px={3}
                            py={1}
                          >
                            {team.workflow}
                          </Badge>
                        </HStack>
                      </ListItem>
                    ))}
                  </List>
                  {teamsData?.data && teamsData.data.length > 5 && (
                    <Text mt={4} color="ui.muted" fontSize="sm">
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
