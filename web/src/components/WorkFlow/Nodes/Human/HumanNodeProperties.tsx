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
import { useReactFlow, Node } from "reactflow";
import { type InterruptType } from "@/client";
import { HumanNodeData, NodeData } from "../../types";

interface HumanNodePropertiesProps {
  node: Node<HumanNodeData>;
  onNodeDataChange: (nodeId: string, key: string, value: any) => void;
}

const HumanNodeProperties: React.FC<HumanNodePropertiesProps> = ({
  node,
  onNodeDataChange,
}) => {
  const { t } = useTranslation();
  const data = node.data;
  const { getNodes } = useReactFlow();

  const availableNodes = useMemo(() => {
    return getNodes()
      .filter((n) => n.id !== node.id && n.type !== "start")
      .map((n) => ({
        id: n.id,
        label: (n.data as NodeData).label || n.id,
        type: n.type,
      }));
  }, [getNodes, node.id]);

  const handleRouteChange = useCallback(
    (routeKey: string, value: string) => {
      const newRoutes = {
        ...(data.routes || {}),
        [routeKey]: value,
      };
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

  const getDefaultTitle = useCallback(
    (type: string) => {
      switch (type) {
        case "tool_review":
          return t("workflow.nodes.human.defaultTitles.toolReview");
        case "output_review":
          return t("workflow.nodes.human.defaultTitles.outputReview");
        case "context_input":
          return t("workflow.nodes.human.defaultTitles.contextInput");
        default:
          return "";
      }
    },
    [t]
  );

  const handleInteractionTypeChange = useCallback(
    (value: InterruptType) => {
      onNodeDataChange(node.id, "interaction_type", value);
      const initialRoutes = (() => {
        switch (value) {
          case "context_input":
            return {
              continue: "",
            };
          case "tool_review":
            return {
              approved: "",
              rejected: "",
              update: "",
            };
          case "output_review":
            return {
              approved: "",
              review: "",
            };

          default:
            return {};
        }
      })();
      onNodeDataChange(node.id, "routes", initialRoutes);
      onNodeDataChange(node.id, "title", getDefaultTitle(value));
    },
    [node.id, onNodeDataChange, getDefaultTitle]
  );

  const renderRoutesByType = () => {
    switch (data.interaction_type) {
      case "context_input":
        return (
          <FormControl>
            <FormLabel fontSize="sm" color="gray.600">
              {t("workflow.nodes.human.continueRoute")}
            </FormLabel>
            <Select
              value={data.routes?.continue || ""}
              onChange={(e) => handleRouteChange("continue", e.target.value)}
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
        );
      case "tool_review":
        return (
          <>
            <FormControl>
              <FormLabel fontSize="sm" color="gray.600">
                {t("workflow.nodes.human.approveRoute")}
              </FormLabel>
              <Select
                value={data.routes?.approved || ""}
                onChange={(e) => handleRouteChange("approved", e.target.value)}
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
                value={data.routes?.rejected || ""}
                onChange={(e) => handleRouteChange("rejected", e.target.value)}
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
                {t("workflow.nodes.human.updateRoute")}
              </FormLabel>
              <Select
                value={data.routes?.update || ""}
                onChange={(e) => handleRouteChange("update", e.target.value)}
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
        );
      case "output_review":
        return (
          <>
            <FormControl>
              <FormLabel fontSize="sm" color="gray.600">
                {t("workflow.nodes.human.approveRoute")}
              </FormLabel>
              <Select
                value={data.routes?.approved || ""}
                onChange={(e) => handleRouteChange("approved", e.target.value)}
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
                {t("workflow.nodes.human.reviewRoute")}
              </FormLabel>
              <Select
                value={data.routes?.review || ""}
                onChange={(e) => handleRouteChange("review", e.target.value)}
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
        );

      default:
        return null;
    }
  };

  React.useEffect(() => {
    if (!data.title && data.interaction_type) {
      onNodeDataChange(
        node.id,
        "title",
        getDefaultTitle(data.interaction_type)
      );
    }
  }, [
    data.title,
    data.interaction_type,
    node.id,
    onNodeDataChange,
    getDefaultTitle,
  ]);

  return (
    <VStack spacing={4} align="stretch">
      <FormControl>
        <FormLabel fontWeight="500" color="gray.700">
          {t("workflow.nodes.human.interactionType")}
        </FormLabel>
        <Select
          value={data.interaction_type || ""}
          onChange={(e) =>
            handleInteractionTypeChange(e.target.value as InterruptType)
          }
          bg="ui.inputbgcolor"
          borderColor="gray.200"
          _hover={{ borderColor: "purple.200" }}
        >
          <option value="context_input">
            {t("workflow.nodes.human.types.contextInput")}
          </option>
          <option value="tool_review">
            {t("workflow.nodes.human.types.toolReview")}
          </option>
          <option value="output_review">
            {t("workflow.nodes.human.types.outputReview")}
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
          {renderRoutesByType()}
        </VStack>
      </Box>
    </VStack>
  );
};

export default HumanNodeProperties;
