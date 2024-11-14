import { Button, Container, Text, VStack, Icon, Box } from "@chakra-ui/react";
import Link from "next/link";
import { FiHome } from "react-icons/fi";
import { RiEmotionSadLine } from "react-icons/ri";

const NotFound = () => {
  return (
    <Box
      h="100vh"
      w="full"
      display="flex"
      alignItems="center"
      justifyContent="center"
      bg="ui.bgMain"
    >
      <Container
        maxW="sm"
        bg="white"
        p={8}
        borderRadius="2xl"
        boxShadow="lg"
        border="1px solid"
        borderColor="gray.100"
      >
        <VStack spacing={6}>
          <Icon
            as={RiEmotionSadLine}
            boxSize={16}
            color="ui.main"
            transition="all 0.3s"
            _hover={{
              transform: "scale(1.1) rotate(5deg)",
            }}
          />

          <Text
            fontSize="6xl"
            color="ui.main"
            fontWeight="bold"
            lineHeight="1"
            transition="all 0.2s"
            _hover={{
              textShadow: "0 0 20px rgba(39, 98, 231, 0.3)",
            }}
          >
            404
          </Text>

          <VStack spacing={2}>
            <Text fontSize="xl" fontWeight="600" color="gray.700">
              Oops!
            </Text>
            <Text fontSize="md" color="gray.600" textAlign="center">
              The page you are looking for does not exist.
            </Text>
          </VStack>

          <Button
            as={Link}
            href="/dashboard"
            leftIcon={<FiHome />}
            colorScheme="blue"
            size="lg"
            width="full"
            borderRadius="lg"
            transition="all 0.2s"
            _hover={{
              transform: "translateY(-2px)",
              boxShadow: "md",
            }}
            _active={{
              transform: "translateY(0)",
            }}
          >
            Back to Home
          </Button>
        </VStack>
      </Container>
    </Box>
  );
};

export default NotFound;
