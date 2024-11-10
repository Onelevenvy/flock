import {
  Box,
  Button,
  FormControl,
  FormLabel,
  HStack,
  IconButton,
  Radio,
  RadioGroup,
  Text,
  VStack,
  useDisclosure,
} from "@chakra-ui/react";
import React, { useState } from "react";
import { FaEdit, FaPlus, FaTrash } from "react-icons/fa";

import ModelSelect from "@/components/Common/ModelProvider";
import { useModelQuery } from "@/hooks/useModelQuery";
import { AgentConfig, CrewAINodeData, TaskConfig } from "../../types";
import { VariableReference } from "../../FlowVis/variableSystem";
import AgentModal from "./AgentModal";
import TaskModal from "./TaskModal";

interface CrewAINodePropertiesProps {
  node: any;
  onNodeDataChange: (nodeId: string, key: string, value: any) => void;
  availableVariables: VariableReference[];
}

const CrewAINodeProperties: React.FC<CrewAINodePropertiesProps> = ({
  node,
  onNodeDataChange,
  availableVariables,
}) => {
  const data = node.data as CrewAINodeData;
  const { data: models } = useModelQuery();

  // Modal controls
  const {
    isOpen: isAgentModalOpen,
    onOpen: onAgentModalOpen,
    onClose: onAgentModalClose,
  } = useDisclosure();

  const {
    isOpen: isTaskModalOpen,
    onOpen: onTaskModalOpen,
    onClose: onTaskModalClose,
  } = useDisclosure();

  // Edit states
  const [editingAgent, setEditingAgent] = useState<AgentConfig | undefined>();
  const [editingTask, setEditingTask] = useState<TaskConfig | undefined>();

  // Handlers for agents
  const handleAddAgent = (agent: AgentConfig) => {
    const updatedAgents = [...(data.agents || [])];
    const existingIndex = updatedAgents.findIndex((a) => a.id === agent.id);

    if (existingIndex >= 0) {
      updatedAgents[existingIndex] = agent;
    } else {
      updatedAgents.push(agent);
    }

    onNodeDataChange(node.id, "agents", updatedAgents);
    onAgentModalClose();
    setEditingAgent(undefined);
  };

  const handleEditAgent = (agent: AgentConfig) => {
    setEditingAgent(agent);
    onAgentModalOpen();
  };

  const handleDeleteAgent = (agentId: string) => {
    const updatedAgents = data.agents.filter((a) => a.id !== agentId);
    onNodeDataChange(node.id, "agents", updatedAgents);

    // Also remove tasks associated with this agent
    const updatedTasks = data.tasks.filter((t) => t.agent_id !== agentId);
    onNodeDataChange(node.id, "tasks", updatedTasks);
  };

  // Handlers for tasks
  const handleAddTask = (task: TaskConfig) => {
    const updatedTasks = [...(data.tasks || [])];
    const existingIndex = updatedTasks.findIndex(
      (t) => t.description === task.description && t.agent_id === task.agent_id
    );

    if (existingIndex >= 0) {
      updatedTasks[existingIndex] = task;
    } else {
      updatedTasks.push(task);
    }

    onNodeDataChange(node.id, "tasks", updatedTasks);
    onTaskModalClose();
    setEditingTask(undefined);
  };

  const handleEditTask = (task: TaskConfig) => {
    setEditingTask(task);
    onTaskModalOpen();
  };

  const handleDeleteTask = (taskIndex: number) => {
    const updatedTasks = data.tasks.filter((_, index) => index !== taskIndex);
    onNodeDataChange(node.id, "tasks", updatedTasks);
  };

  // Handler for process type
  const handleProcessTypeChange = (value: "sequential" | "hierarchical") => {
    onNodeDataChange(node.id, "process_type", value);
  };

  // Handler for LLM selection
  const handleLLMSelect = (modelName: string) => {
    const selectedModel = models?.data.find(
      (model) => model.ai_model_name === modelName
    );
    if (selectedModel) {
      onNodeDataChange(node.id, "llm_config", {
        model: modelName,
        base_url: selectedModel.provider.base_url || "",
        api_key: selectedModel.provider.api_key || "",
      });
    }
  };

  // Handler for manager LLM selection (only for hierarchical process)
  const handleManagerLLMSelect = (modelName: string) => {
    const selectedModel = models?.data.find(
      (model) => model.ai_model_name === modelName
    );
    if (selectedModel) {
      onNodeDataChange(node.id, "manager_config", {
        llm: {
          model: modelName,
          base_url: selectedModel.provider.base_url || "",
          api_key: selectedModel.provider.api_key || "",
        },
      });
    }
  };

  return (
    <VStack spacing={4} align="stretch">
      <FormControl>
        <FormLabel>Process Type</FormLabel>
        <RadioGroup
          value={data.process_type}
          onChange={handleProcessTypeChange}
        >
          <HStack spacing={4}>
            <Radio value="sequential">Sequential</Radio>
            <Radio value="hierarchical">Hierarchical</Radio>
          </HStack>
        </RadioGroup>
      </FormControl>

      <FormControl>
        <FormLabel>Default LLM</FormLabel>
        {/* <ModelSelect
          models={models}
          value={data.llm_config?.model}
          onModelSelect={handleLLMSelect}
        /> */}
      </FormControl>

      {data.process_type === "hierarchical" && (
        <FormControl>
          <FormLabel>Manager LLM</FormLabel>
          {/* <ModelSelect
            models={models}
            value={data.manager_config?.llm?.model}
            onModelSelect={handleManagerLLMSelect}
          /> */}
        </FormControl>
      )}

      <Box>
        <HStack justify="space-between" mb={2}>
          <Text fontWeight="bold">Agents</Text>
          <Button
            leftIcon={<FaPlus />}
            size="sm"
            onClick={() => {
              setEditingAgent(undefined);
              onAgentModalOpen();
            }}
          >
            Add Agent
          </Button>
        </HStack>
        <VStack align="stretch" spacing={2}>
          {data.agents?.map((agent) => (
            <HStack key={agent.id} justify="space-between" p={2} bg="gray.50" borderRadius="md">
              <VStack align="start" spacing={0}>
                <Text fontWeight="bold">{agent.role}</Text>
                <Text fontSize="sm" color="gray.600">
                  {agent.goal}
                </Text>
              </VStack>
              <HStack>
                <IconButton
                  aria-label="Edit agent"
                  icon={<FaEdit />}
                  size="sm"
                  onClick={() => handleEditAgent(agent)}
                />
                <IconButton
                  aria-label="Delete agent"
                  icon={<FaTrash />}
                  size="sm"
                  colorScheme="red"
                  onClick={() => handleDeleteAgent(agent.id)}
                />
              </HStack>
            </HStack>
          ))}
        </VStack>
      </Box>

      <Box>
        <HStack justify="space-between" mb={2}>
          <Text fontWeight="bold">Tasks</Text>
          <Button
            leftIcon={<FaPlus />}
            size="sm"
            onClick={() => {
              setEditingTask(undefined);
              onTaskModalOpen();
            }}
            isDisabled={!data.agents?.length}
          >
            Add Task
          </Button>
        </HStack>
        <VStack align="stretch" spacing={2}>
          {data.tasks?.map((task, index) => (
            <HStack key={index} justify="space-between" p={2} bg="gray.50" borderRadius="md">
              <VStack align="start" spacing={0}>
                <Text fontWeight="bold">
                  {task.description}
                </Text>
                <Text fontSize="sm" color="gray.600">
                  Agent: {data.agents.find(a => a.id === task.agent_id)?.role}
                </Text>
              </VStack>
              <HStack>
                <IconButton
                  aria-label="Edit task"
                  icon={<FaEdit />}
                  size="sm"
                  onClick={() => handleEditTask(task)}
                />
                <IconButton
                  aria-label="Delete task"
                  icon={<FaTrash />}
                  size="sm"
                  colorScheme="red"
                  onClick={() => handleDeleteTask(index)}
                />
              </HStack>
            </HStack>
          ))}
        </VStack>
      </Box>

      {/* Modals */}
      {isAgentModalOpen && (
        <AgentModal
          isOpen={isAgentModalOpen}
          onClose={onAgentModalClose}
          onSubmit={handleAddAgent}
          initialData={editingAgent}
        />
      )}

      {isTaskModalOpen && (
        <TaskModal
          isOpen={isTaskModalOpen}
          onClose={onTaskModalClose}
          onSubmit={handleAddTask}
          initialData={editingTask}
          agents={data.agents || []}
        />
      )}
    </VStack>
  );
};

export default CrewAINodeProperties; 