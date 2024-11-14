import {
  Button,
  Container,
  Heading,
  Text,
  VStack,
  useDisclosure,
  useColorModeValue,
  Box,
} from "@chakra-ui/react";

import DeleteConfirmation from "./DeleteConfirmation";

const DeleteAccount = () => {
  const confirmationModal = useDisclosure();
  const bgColor = useColorModeValue("white", "gray.800");
  const borderColor = useColorModeValue("gray.100", "gray.700");

  return (
    <Container maxW="full">
      <Box
        bg={bgColor}
        borderRadius="xl"
        border="1px solid"
        borderColor={borderColor}
        p={6}
        transition="all 0.2s"
        boxShadow="sm"
        _hover={{
          boxShadow: "md",
          borderColor: "gray.200",
        }}
      >
        <VStack spacing={4} align="stretch">
          <Heading size="md" color="gray.800" fontWeight="600">
            Delete Account
          </Heading>
          
          <Text color="gray.600" fontSize="sm" lineHeight="tall">
            Permanently delete your data and everything associated with your account.
          </Text>
          
          <Button
            variant="danger"
            onClick={confirmationModal.onOpen}
            size="md"
            transition="all 0.2s"
            _hover={{
              transform: "translateY(-1px)",
              boxShadow: "md",
            }}
            _active={{
              transform: "translateY(0)",
            }}
          >
            Delete
          </Button>
        </VStack>
      </Box>

      <DeleteConfirmation
        isOpen={confirmationModal.isOpen}
        onClose={confirmationModal.onClose}
      />
    </Container>
  );
};

export default DeleteAccount;
