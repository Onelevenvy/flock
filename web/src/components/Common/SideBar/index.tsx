import {
  Avatar,
  Box,
  Flex,
  Link,
  Tooltip,
  VStack,
  useColorModeValue,
} from "@chakra-ui/react";
import { FaGithubSquare } from "react-icons/fa";

import SidebarItems from "./SidebarItems";

const Sidebar = () => {
  const bgColor = useColorModeValue("white", "ui.dark");
  const secBgColor = useColorModeValue("gray.50", "ui.darkSlate");

  return (
    <Box
      bg={bgColor}
      p={1}
      h="100vh"
      borderRight="1px solid"
      borderColor="gray.100"
      transition="all 0.2s"
    >
      <Flex
        flexDir="column"
        justify="space-between"
        bg={secBgColor}
        p={4}
        borderRadius="xl"
        h="full"
        transition="all 0.2s"
        _hover={{
          boxShadow: "sm",
        }}
      >
        <Box w="full">
          <VStack align="center" spacing={6}>
            <Link
              href="https://github.com/Onelevenvy/flock"
              isExternal
              transition="all 0.2s"
              _hover={{
                transform: "scale(1.05)",
              }}
            >
              <Tooltip
                label="https://github.com/Onelevenvy/flock"
                fontSize="xs"
                placement="right"
                hasArrow
                bg="gray.700"
                color="white"
              >
                <Avatar
                  size="md"
                  // bg="transparent"
                  icon={<FaGithubSquare size={36} color="gray.800" />}
                  mt={3}
                  transition="all 0.2s"
                  _hover={{
                    transform: "rotate(5deg)",
                    bg: "ui.main",
                  }}
                />
              </Tooltip>
            </Link>
            <Box w="full">
              <SidebarItems />
            </Box>
          </VStack>
        </Box>
      </Flex>
    </Box>
  );
};

export default Sidebar;
