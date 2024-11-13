import {  Flex } from "@chakra-ui/react";

import { FlockLogo } from "./Logo";
import UserMenu from "./UserMenu";

export default function TopBar() {
  return (
    <Flex
      w="full"
      h="70px"
      bg="white"
      borderBottom="1px solid"
      borderColor="gray.100"
      px={6}
      alignItems="center"
      justifyContent="space-between"
      position="sticky"
      top={0}
      zIndex={10}
      backdropFilter="blur(10px)"
      transition="all 0.2s"
      _hover={{
        boxShadow: "sm",
      }}
    >
      <FlockLogo />
      <UserMenu />
    </Flex>
  );
}
