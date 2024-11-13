import { Box, Image, Text } from "@chakra-ui/react";
import Link from "next/link";

export function FlockLogo() {
  return (
    <Link href="/dashboard">
      <Box
        display="flex"
        alignItems="center"
        gap={3}
        cursor="pointer"
        transition="all 0.2s"
        _hover={{ transform: "scale(1.02)" }}
      >
        <Image
          src="logo.png"
          h="40px"
          w="40px"
          alt="Logo"
          bg="transparent"
          objectFit="contain"
        />
        <Text
          fontSize="xl"
          fontWeight="600"
          color="gray.800"
          letterSpacing="tight"
        >
          Flock
        </Text>
      </Box>
    </Link>
  );
}
