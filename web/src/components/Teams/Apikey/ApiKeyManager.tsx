import {
  VStack,
  Text,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  useDisclosure,
  IconButton,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalCloseButton,
  ModalBody,
  Flex,
} from "@chakra-ui/react";
import { DeleteIcon } from "@chakra-ui/icons";
import { useMutation, useQuery, useQueryClient } from "react-query";
import { ApiKeysService, type ApiError } from "../../../client";
import useCustomToast from "../../../hooks/useCustomToast";
import AddApiKey from "./AddApiKey";
import CustomButton from "../../Common/CustomButton";

interface ApiKeyManagerProps {
  teamId: string;
  isOpen: boolean;
  onClose: () => void;
}

const ApiKeyManager: React.FC<ApiKeyManagerProps> = ({
  teamId,
  isOpen,
  onClose,
}) => {
  const queryClient = useQueryClient();
  const showToast = useCustomToast();
  const {
    isOpen: isAddKeyOpen,
    onOpen: onAddKeyOpen,
    onClose: onAddKeyClose,
  } = useDisclosure();

  const { data: apiKeys, isLoading } = useQuery(["apiKeys", teamId], () =>
    ApiKeysService.readApiKeys({ teamId: parseInt(teamId) })
  );

  const deleteApiKeyMutation = useMutation(
    (apiKeyId: number) =>
      ApiKeysService.deleteApiKey({ teamId: parseInt(teamId), id: apiKeyId }),
    {
      onSuccess: () => {
        showToast("Success", "API key deleted successfully", "success");
        queryClient.invalidateQueries(["apiKeys", teamId]);
      },
      onError: (error: ApiError) => {
        showToast(
          "Error",
          error.body?.detail || "Failed to delete API key",
          "error"
        );
      },
    }
  );

  const handleDelete = (apiKeyId: number) => {
    deleteApiKeyMutation.mutate(apiKeyId);
  };

  const handleAddApiKey = () => {
    onAddKeyOpen();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="2xl">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>API Key Management</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <VStack spacing={4} align="stretch">
            <Flex justifyContent="space-between" alignItems="center">
              <Text>Manage your API keys for authentication with the API.</Text>
              <CustomButton
                text="Create New API Key"
                variant="blue"
                onClick={handleAddApiKey}
                h={"10"}
                w="36"
              />
            </Flex>
            <Table variant="simple">
              <Thead>
                <Tr>
                  <Th width="20%">Description</Th>
                  <Th width="30%">Key</Th>
                  <Th width="40%">Created At</Th>
                  <Th width="10%">Actions</Th>
                </Tr>
              </Thead>
              <Tbody>
                {!isLoading &&
                  apiKeys?.data.map((apiKey) => (
                    <Tr key={apiKey.id}>
                      <Td>{apiKey.description}</Td>
                      <Td><code>{apiKey.short_key}</code></Td>
                      <Td>{new Date(apiKey.created_at).toLocaleString()}</Td>
                      <Td>
                        <IconButton
                          aria-label="Delete API Key"
                          icon={<DeleteIcon />}
                          size="sm"
                          onClick={() => handleDelete(apiKey.id)}
                        />
                      </Td>
                    </Tr>
                  ))}
              </Tbody>
            </Table>
          </VStack>
        </ModalBody>
      </ModalContent>
      <AddApiKey
        teamId={teamId}
        isOpen={isAddKeyOpen}
        onClose={onAddKeyClose}
      />
    </Modal>
  );
};

export default ApiKeyManager;
