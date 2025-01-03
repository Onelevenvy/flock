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

interface HumanNodePropertiesProps {
  node: any;
  onNodeDataChange: (nodeId: string, key: string, value: any) => void;
}

const HumanNodeProperties: React.FC<HumanNodePropertiesProps> = ({
  node,
  onNodeDataChange,
}) => {
  const { t } = useTranslation();
  const data = node.data as HumanNodeData;
  const { getNodes } = useReactFlow();

  const availableNodes = useMemo(() => {
    return getNodes()
      .filter((n) => n.id !== node.id && n.type !== "start")
      .map((n) => ({
        id: n.id,
        label: n.data.label || n.id,
        type: n.type,
      }));
  }, [getNodes, node.id]);

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

          <FormControl>
            <FormLabel fontSize="sm" color="gray.600">
              {t("workflow.nodes.human.feedbackRoute")}
            </FormLabel>
            <Select
              value={data.routes?.feedback || ""}
              onChange={(e) => handleRouteChange("feedback", e.target.value)}
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
        </VStack>
      </Box>
    </VStack>
  );
};

export default HumanNodeProperties;
