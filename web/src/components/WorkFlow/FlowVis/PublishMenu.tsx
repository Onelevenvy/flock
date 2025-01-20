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
import { useMutation, useQuery } from "react-query";
import { SubgraphsService } from "@/client";
import useCustomToast from "@/hooks/useCustomToast";
import CustomButton from "@/components/Common/CustomButton";
import ApiKeyManager from "@/components/Teams/Apikey/ApiKeyManager";
import { useTranslation } from "react-i18next";
import { type Edge } from "reactflow";
import { v4 } from "uuid";
import { type NodeType, nodeConfig } from "../Nodes/nodeConfig";
import type { CustomNode } from "../types";

interface PublishMenuProps {
  teamId: string;
  workflowConfig: {
    nodes: CustomNode[];
    edges: Edge[];
  };
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

  // 复用 useGraphConfig 中的配置生成逻辑
  const generateConfig = () => {
    const { nodes, edges } = workflowConfig;

    const startEdge = edges.find((edge) => {
      const sourceNode = nodes.find(
        (node) => node.id === edge.source && node.type === "start"
      );
      return sourceNode !== undefined;
    });

    const entryPointId = startEdge ? startEdge.target : null;

    return {
      id: v4(),
      name: "Subgraph",
      nodes: nodes.map((node) => {
        const nodeType = node.type as NodeType;
        const initialData = nodeConfig[nodeType].initialData || {};
        const nodeData: Record<string, any> = {
          ...node.data,
          label: node.data.label,
        };

        Object.keys(initialData).forEach((key) => {
          if (node.data[key] !== undefined) {
            nodeData[key] = node.data[key];
          }
        });

        return {
          id: node.id,
          type: node.type,
          position: node.position,
          data: nodeData,
        };
      }),
      edges: edges.map((edge) => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        sourceHandle: edge.sourceHandle || "bottom",
        targetHandle: edge.targetHandle || "top",
        type: edge.type,
      })),
      metadata: {
        entry_point: entryPointId,
        start_connections: edges
          .filter((edge) =>
            nodes.find(
              (node) => node.id === edge.source && node.type === "start"
            )
          )
          .map((edge) => ({
            target: edge.target,
            type: edge.type,
          })),
        end_connections: edges
          .filter((edge) =>
            nodes.find((node) => node.id === edge.target && node.type === "end")
          )
          .map((edge) => ({
            source: edge.source,
            type: edge.type,
          })),
      },
    };
  };

  // 修改查询逻辑
  const { data: subgraphsData } = useQuery(
    ["subgraph", teamId],
    () =>
      SubgraphsService.readSubgraphs({
        teamId: parseInt(teamId),
      }),
    {
      enabled: !!teamId,
      onSuccess: (data) => {
        // 如果有数据，使用现有子图的信息
        if (data?.data?.[0]) {
          const subgraph = data.data[0];
          setName(subgraph.name || "");
          setDescription(subgraph.description || "");
        }
      },
      onError: (error: any) => {
        showToast(
          "Error",
          error.message || "Failed to fetch subgraph data",
          "error"
        );
      },
    }
  );

  const existingSubgraph = subgraphsData?.data?.[0];

  const publishMutation = useMutation(
    (data: { name: string; description: string }) => {
      const subgraphData = {
        name: data.name,
        description: data.description,
        config: generateConfig(),
        team_id: parseInt(teamId),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        is_public: false,
        metadata_: {},
      };

      // 如果存在现有子图，则更新
      if (existingSubgraph) {
        return SubgraphsService.updateSubgraph({
          id: existingSubgraph.id,
          requestBody: subgraphData,
        });
      }

      // 否则创建新的子图
      return SubgraphsService.createSubgraph({
        requestBody: subgraphData,
      });
    },
    {
      onSuccess: () => {
        showToast(
          "Success",
          existingSubgraph
            ? "Workflow updated successfully"
            : "Workflow published successfully",
          "success"
        );
        onPublishClose();
      },
      onError: (error: any) => {
        const errorMessage =
          error?.body?.detail || error?.message || "Failed to publish workflow";
        showToast("Error", errorMessage, "error");
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
          <ModalHeader>
            {existingSubgraph
              ? "Update Subgraph"
              : "Publish Workflow as Subgraph"}
          </ModalHeader>
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
              text={existingSubgraph ? "Update" : "Publish"}
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
