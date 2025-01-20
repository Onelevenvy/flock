import {
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalCloseButton,
  ModalBody,
  ModalFooter,
  FormControl,
  FormLabel,
  Input,
  Textarea,
  useDisclosure,
  VStack,
} from "@chakra-ui/react";
import { MdPublish } from "react-icons/md";
import { useState } from "react";
import { useMutation } from "react-query";
import { SubgraphsService } from "@/client";
import useCustomToast from "@/hooks/useCustomToast";
import CustomButton from "@/components/Common/CustomButton";
import ApiKeyManager from "@/components/Teams/Apikey/ApiKeyManager";
import { useTranslation } from "react-i18next";

interface PublishMenuProps {
  teamId: string;
  workflowConfig: any;
}

const PublishMenu: React.FC<PublishMenuProps> = ({
  teamId,
  workflowConfig,
}) => {
  const { t } = useTranslation();
  const showToast = useCustomToast();
  const {
    isOpen: isApiKeyOpen,
    onOpen: onApiKeyOpen,
    onClose: onApiKeyClose,
  } = useDisclosure();
  const {
    isOpen: isPublishOpen,
    onOpen: onPublishOpen,
    onClose: onPublishClose,
  } = useDisclosure();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const publishMutation = useMutation(
    (data: { name: string; description: string }) =>
      SubgraphsService.createSubgraph({
        requestBody: {
          name: data.name,
          description: data.description,
          config: workflowConfig,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      }),
    {
      onSuccess: () => {
        showToast("Success", "Workflow published successfully", "success");
        onPublishClose();
      },
      onError: (error: any) => {
        showToast(
          "Error",
          error.body?.detail || "Failed to publish workflow",
          "error"
        );
      },
    }
  );

  const handlePublish = () => {
    if (!name.trim()) {
      showToast("Error", "Name is required", "error");
      return;
    }
    publishMutation.mutate({ name, description });
  };

  return (
    <>
      <Menu>
        <MenuButton
          as={CustomButton}
          text={t("workflow.flowVisualizer.actions.publish")}
          variant="white"
          rightIcon={<MdPublish />}
        />
        <MenuList>
          <MenuItem onClick={onApiKeyOpen}>Manage API Keys</MenuItem>
          <MenuItem onClick={onPublishOpen}>Publish as Subgraph</MenuItem>
        </MenuList>
      </Menu>

      <ApiKeyManager
        teamId={teamId}
        isOpen={isApiKeyOpen}
        onClose={onApiKeyClose}
      />

      <Modal isOpen={isPublishOpen} onClose={onPublishClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Publish Workflow as Subgraph</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack spacing={4}>
              <FormControl isRequired>
                <FormLabel>Name</FormLabel>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter subgraph name"
                />
              </FormControl>
              <FormControl>
                <FormLabel>Description</FormLabel>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Enter subgraph description"
                />
              </FormControl>
            </VStack>
          </ModalBody>
          <ModalFooter>
            <CustomButton
              text="Cancel"
              variant="ghost"
              mr={3}
              onClick={onPublishClose}
            />
            <CustomButton
              text="Publish"
              variant="blue"
              onClick={handlePublish}
              isLoading={publishMutation.isLoading}
            />
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
};

export default PublishMenu;
