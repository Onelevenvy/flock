import {
  VStack,
  FormControl,
  FormLabel,
  Select,
  Input,
  Box,
  Text,
} from "@chakra-ui/react";
import React, { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useReactFlow } from "reactflow";

import { HumanNodeData } from "../../types";
import { VariableReference } from "../../FlowVis/variableSystem";

interface HumanNodePropertiesProps {
  node: any;
  onNodeDataChange: (nodeId: string, key: string, value: any) => void;
  availableVariables: VariableReference[];
}

const HumanNodeProperties: React.FC<HumanNodePropertiesProps> = ({
  node,
  onNodeDataChange,
}) => {
  const { t } = useTranslation();
  const data = node.data as HumanNodeData;
  const { getNodes } = useReactFlow();

  // 获取所有可用的目标节点(排除当前节点和开始节点)
  const availableNodes = useMemo(() => {
    return getNodes()
      .filter((n) => n.id !== node.id && n.type !== "start")
      .map((n) => ({
        id: n.id,
        label: n.data.label || n.id,
        type: n.type,
      }));
  }, [getNodes, node.id]);

  const handleInteractionTypeChange = useCallback(
    (value: string) => {
      onNodeDataChange(node.id, "interaction_type", value);

      // Update routes based on interaction type
      if (value === "HUMAN_NODE_APPROVAL") {
        onNodeDataChange(node.id, "routes", {
          human_approve: "",
          human_reject: "",
        });
      } else {
        onNodeDataChange(node.id, "routes", {
          human_feedback: "",
        });
      }
    },
    [node.id, onNodeDataChange]
  );

  const handleRouteChange = useCallback(
    (routeKey: string, value: string) => {
      const newRoutes = { ...data.routes, [routeKey]: value };
      onNodeDataChange(node.id, "routes", newRoutes);
    },
    [node.id, data.routes, onNodeDataChange]
  );

  const handleTitleChange = useCallback(
    (value: string) => {
      onNodeDataChange(node.id, "title", value);
    },
    [node.id, onNodeDataChange]
  );

  return (
    <VStack spacing={4} align="stretch">
      <FormControl>
        <FormLabel fontWeight="500" color="gray.700">
          {t("workflow.nodes.human.interactionType")}
        </FormLabel>
        <Select
          value={data.interaction_type}
          onChange={(e) => handleInteractionTypeChange(e.target.value)}
          bg="ui.inputbgcolor"
          borderColor="gray.200"
          _hover={{ borderColor: "purple.200" }}
        >
          <option value="human_node_approval">
            {t("workflow.nodes.human.approval")}
          </option>
          <option value="human_node_feedback">
            {t("workflow.nodes.human.feedback")}
          </option>
        </Select>
      </FormControl>

      <FormControl>
        <FormLabel fontWeight="500" color="gray.700">
          {t("workflow.nodes.human.title")}
        </FormLabel>
        <Input
          value={data.title || ""}
          onChange={(e) => handleTitleChange(e.target.value)}
          placeholder={t("workflow.nodes.human.titlePlaceholder") as string}
          bg="ui.inputbgcolor"
          borderColor="gray.200"
          _hover={{ borderColor: "purple.200" }}
        />
      </FormControl>

      <Box>
        <Text fontWeight="500" color="gray.700" mb={2}>
          {t("workflow.nodes.human.routes")}
        </Text>
        <VStack spacing={3} align="stretch">
          {data.interaction_type === "human_node_approval" ? (
            <>
              <FormControl>
                <FormLabel fontSize="sm" color="gray.600">
                  {t("workflow.nodes.human.approveRoute")}
                </FormLabel>
                <Select
                  value={data.routes?.human_approve || ""}
                  onChange={(e) =>
                    handleRouteChange("human_approve", e.target.value)
                  }
                  size="sm"
                  bg="ui.inputbgcolor"
                  borderColor="gray.200"
                  _hover={{ borderColor: "purple.200" }}
                >
                  <option value="">Select node</option>
                  {availableNodes.map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.label} ({n.type})
                    </option>
                  ))}
                </Select>
              </FormControl>
              <FormControl>
                <FormLabel fontSize="sm" color="gray.600">
                  {t("workflow.nodes.human.rejectRoute")}
                </FormLabel>
                <Select
                  value={data.routes?.human_reject || ""}
                  onChange={(e) =>
                    handleRouteChange("human_reject", e.target.value)
                  }
                  size="sm"
                  bg="ui.inputbgcolor"
                  borderColor="gray.200"
                  _hover={{ borderColor: "purple.200" }}
                >
                  <option value="">Select node</option>
                  {availableNodes.map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.label} ({n.type})
                    </option>
                  ))}
                </Select>
              </FormControl>
            </>
          ) : (
            <FormControl>
              <FormLabel fontSize="sm" color="gray.600">
                {t("workflow.nodes.human.feedbackRoute")}
              </FormLabel>
              <Select
                value={data.routes?.human_feedback || ""}
                onChange={(e) =>
                  handleRouteChange("human_feedback", e.target.value)
                }
                size="sm"
                bg="ui.inputbgcolor"
                borderColor="gray.200"
                _hover={{ borderColor: "purple.200" }}
              >
                <option value="">Select node</option>
                {availableNodes.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.label} ({n.type})
                  </option>
                ))}
              </Select>
            </FormControl>
          )}
        </VStack>
      </Box>
    </VStack>
  );
};

export default HumanNodeProperties;
