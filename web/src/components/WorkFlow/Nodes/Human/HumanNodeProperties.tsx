import {
  VStack,
  FormControl,
  FormLabel,
  Select,
  Input,

  Box,
  Text,
 
} from "@chakra-ui/react";
import React, { useCallback } from "react";

import { useTranslation } from "react-i18next";

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
          <option value="HUMAN_NODE_APPROVAL">
            {t("workflow.nodes.human.approval")}
          </option>
          <option value="HUMAN_NODE_FEEDBACK">
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
          {data.interaction_type === "HUMAN_NODE_APPROVAL" ? (
            <>
              <FormControl>
                <FormLabel fontSize="sm" color="gray.600">
                  {t("workflow.nodes.human.approveRoute")}
                </FormLabel>
                <Input
                  value={data.routes?.human_approve || ""}
                  onChange={(e) =>
                    handleRouteChange("human_approve", e.target.value)
                  }
                  placeholder="approved_node_id"
                  size="sm"
                />
              </FormControl>
              <FormControl>
                <FormLabel fontSize="sm" color="gray.600">
                  {t("workflow.nodes.human.rejectRoute")}
                </FormLabel>
                <Input
                  value={data.routes?.human_reject || ""}
                  onChange={(e) =>
                    handleRouteChange("human_reject", e.target.value)
                  }
                  placeholder="rejected_node_id"
                  size="sm"
                />
              </FormControl>
            </>
          ) : (
            <FormControl>
              <FormLabel fontSize="sm" color="gray.600">
                {t("workflow.nodes.human.feedbackRoute")}
              </FormLabel>
              <Input
                value={data.routes?.human_feedback || ""}
                onChange={(e) =>
                  handleRouteChange("human_feedback", e.target.value)
                }
                placeholder="feedback_node_id"
                size="sm"
              />
            </FormControl>
          )}
        </VStack>
      </Box>
    </VStack>
  );
};

export default HumanNodeProperties;
