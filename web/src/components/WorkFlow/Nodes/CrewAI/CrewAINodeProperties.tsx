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
  useToast,
} from "@chakra-ui/react";
import React, { useState, useMemo } from "react";
import { FaEdit, FaPlus, FaTrash } from "react-icons/fa";
import crypto from "crypto";
import { useForm, type Control, type FieldValues } from "react-hook-form";
import { v4 as uuidv4 } from 'uuid';

import ModelSelect from "@/components/Common/ModelProvider";
import { useModelQuery } from "@/hooks/useModelQuery";
import { AgentConfig, CrewAINodeData, TaskConfig } from "../../types";
import { VariableReference } from "../../FlowVis/variableSystem";
import AgentModal from "./AgentModal";
import TaskModal from "./TaskModal";
import { DEFAULT_MANAGER } from "./constants";

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
  const toast = useToast();
  const { control } = useForm({
    defaultValues: {
      model: data.llm_config?.model || "",
    }
  });

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
  const [useCustomManager, setUseCustomManager] = useState(
    !!data.manager_config?.agent
  );

  // 检查是否已经存在Manager Agent
  const hasManagerAgent = useMemo(() => {
    return data.agents?.some((agent) => agent.role === "Team Manager");
  }, [data.agents]);

  // Handlers for agents
  const handleAddAgent = (agent: AgentConfig) => {
    // 如果是Manager Agent，确保只能有一个
    if (agent.role === "Team Manager" && hasManagerAgent && !editingAgent) {
      toast({
        title: "Error",
        description: "Only one Manager Agent is allowed",
        status: "error",
        duration: 3000,
        isClosable: true,
      });
      return;
    }

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

  // Handler for manager agent configuration
  const handleManagerAgentConfig = (agent: AgentConfig) => {
    // 确保manager agent的必要属性
    const managerAgent = {
      ...agent,
      role: "Team Manager",
      allow_delegation: true,
      use_search: false,
      use_scraper: false,
    };

    onNodeDataChange(node.id, "manager_config", {
      agent: managerAgent,
    });
    setUseCustomManager(true);
  };

  const handleDeleteAgent = (agentId: string) => {
    const agent = data.agents.find((a) => a.id === agentId);
    if (agent?.role === "Team Manager") {
      // 如果删除的是Manager Agent，清除manager_config
      onNodeDataChange(node.id, "manager_config", {});
      setUseCustomManager(false);
    }

    const updatedAgents = data.agents.filter((a) => a.id !== agentId);
    onNodeDataChange(node.id, "agents", updatedAgents);

    // 删除关联的tasks
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
    if (value === "sequential") {
      onNodeDataChange(node.id, "manager_config", {});
      setUseCustomManager(false);
    } else {
      if (!useCustomManager) {
        onNodeDataChange(node.id, "manager_config", {
          agent: {
            id: uuidv4(),
            ...DEFAULT_MANAGER,
            allow_delegation: true,
          }
        });
      }
    }
  };

  // Handler for LLM selection
  const handleLLMSelect = (modelName: string) => {
    onNodeDataChange(node.id, "llm_config", {
      model: modelName,
    });
  };

  // 验证是否可以添加新的task
  const canAddTask = useMemo(() => {
    if (data.process_type === "sequential") {
      return data.agents?.length > 0;
    } else {
      // hierarchical 模式下需要确保有 manager_config.agent
      return (
        data.agents?.length > 0 &&
        (useCustomManager ? !!data.manager_config?.agent : true)
      );
    }
  }, [data.agents, data.process_type, data.manager_config, useCustomManager]);

  // 添加 handleEditAgent 函数
  const handleEditAgent = (agent: AgentConfig) => {
    // 如果是Manager Agent，确保只能有一个
    if (agent.role === "Team Manager" && !editingAgent) {
      toast({
        title: "Error",
        description: "Cannot add another Manager Agent",
        status: "error",
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    setEditingAgent(agent);
    onAgentModalOpen();
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
        <FormLabel>Default LLM (For All Agents)</FormLabel>
        <ModelSelect
          models={models}
          control={control}
          name="model"
          value={data.llm_config?.model}
          onModelSelect={handleLLMSelect}
        />
      </FormControl>

      {data.process_type === "hierarchical" && (
        <>
          <FormControl>
            <FormLabel>Manager Configuration</FormLabel>
            <RadioGroup
              value={useCustomManager ? "custom" : "default"}
              onChange={(value) => {
                setUseCustomManager(value === "custom");
                if (value === "default") {
                  onNodeDataChange(node.id, "manager_config", {
                    agent: {
                      id: uuidv4(),
                      ...DEFAULT_MANAGER,
                      allow_delegation: true,
                    }
                  });
                }
              }}
            >
              <HStack spacing={4}>
                <Radio value="default">Default Manager Agent</Radio>
                <Radio value="custom">Custom Manager Agent</Radio>
              </HStack>
            </RadioGroup>
          </FormControl>
        </>
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
            <HStack
              key={agent.id}
              justify="space-between"
              p={2}
              bg="gray.50"
              borderRadius="md"
            >
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
            isDisabled={!canAddTask}
            title={
              !canAddTask
                ? "Add agents and configure manager (for hierarchical) first"
                : "Add new task"
            }
          >
            Add Task
          </Button>
        </HStack>
        <VStack align="stretch" spacing={2}>
          {data.tasks?.map((task, index) => (
            <HStack
              key={index}
              justify="space-between"
              p={2}
              bg="gray.50"
              borderRadius="md"
            >
              <VStack align="start" spacing={0}>
                <Text fontWeight="bold">{task.description}</Text>
                <Text fontSize="sm" color="gray.600">
                  Agent: {data.agents.find((a) => a.id === task.agent_id)?.role}
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
          isManager={false}
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