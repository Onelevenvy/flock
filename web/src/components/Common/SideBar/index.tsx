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
  const bgColor = useColorModeValue("ui.white", "ui.dark");
  const secBgColor = useColorModeValue("ui.secondary", "ui.darkSlate");

  return (
    <>
      <Box bg={bgColor} p={1} h="100vh">
        <Flex
          flexDir="column"
          justify="space-between"
          bg={secBgColor}
          p={4}
          borderRadius={12}
          h="100%"
        >
          <Box w="full">
            <VStack align="center" spacing={6}>
              <Link
                href="https://github.com/Onelevenvy/flock"
                isExternal
              >
                <Tooltip
                  label="https://github.com/Onelevenvy/flock"
                  fontSize="2xs"
                >
                  <Avatar
                    size="md"
                    bg={"transparent"}
                    icon={<FaGithubSquare size={"40"} color="black" />}
                    mt={"12px"}
                  />
                </Tooltip>
              </Link>
              <Box>
                <SidebarItems />
              </Box>
            </VStack>
          </Box>
        </Flex>
      </Box>
    </>
  );
};

export default Sidebar;
