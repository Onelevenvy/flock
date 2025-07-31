import {
  Box,
  Button,
  Checkbox,
  FormControl,
  FormErrorMessage,
  FormLabel,
  HStack,
  Input,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Select,
  SimpleGrid,
  Slider,
  SliderFilledTrack,
  SliderThumb,
  SliderTrack,
  Text,
  Textarea,
  Tooltip,
  IconButton,
} from "@chakra-ui/react";
import { CircleMinus } from 'lucide-react';
import { Select as MultiSelect, chakraComponents } from "chakra-react-select";
import { type Ref, forwardRef, useState, useEffect } from "react";
import { Controller, type SubmitHandler, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "react-query";
import { FaTools } from "react-icons/fa";
import { useModelQuery } from "@/hooks/useModelQuery";
import { useQuery } from "react-query";
import { ToolproviderService } from "@/client/services/ToolproviderService";
import { useUploadsQuery } from "@/hooks/useUploadsQuery";

import {
  type ApiError,
  type MemberOut,
  type MemberUpdate,
  MembersService,
  type TeamUpdate,
} from "../../client";
import ToolsIcon from "../Icons/Tools/index";
import useCustomToast from "../../hooks/useCustomToast";
import ModelSelect from "../Common/ModelProvider";
import ToolSelector from "./ToolSelector";

interface EditTeamMemberProps {
  member: MemberOut;
  teamId: number;
  isOpen: boolean;
  onClose: () => void;
  ref?: Ref<HTMLFormElement>;
}

type MemberTypes =
  | "root"
  | "leader"
  | "worker"
  | "freelancer"
  | "freelancer_root"
  | "chatbot"
  | "workflow";

interface MemberConfigs {
  selection: MemberTypes[];
  enableSkillTools: boolean;
  enableUploadTools: boolean;
  enableInterrupt: boolean;
  enableHumanTool: boolean;
}

const customSelectOption = {
  Option: (props: any) => (
    <chakraComponents.Option {...props}>
      {props.children}: {props.data.description}
    </chakraComponents.Option>
  ),
};

const ALLOWED_MEMBER_CONFIGS: Record<MemberTypes, MemberConfigs> = {
  root: {
    selection: ["root"],
    enableSkillTools: false,
    enableUploadTools: false,
    enableInterrupt: false,
    enableHumanTool: false,
  },
  leader: {
    selection: ["worker", "leader"],
    enableSkillTools: false,
    enableUploadTools: false,
    enableInterrupt: false,
    enableHumanTool: false,
  },
  worker: {
    selection: ["worker", "leader"],
    enableSkillTools: true,
    enableUploadTools: true,
    enableInterrupt: false,
    enableHumanTool: false,
  },
  freelancer: {
    selection: ["freelancer"],
    enableSkillTools: true,
    enableUploadTools: true,
    enableInterrupt: true,
    enableHumanTool: true,
  },
  freelancer_root: {
    selection: ["freelancer_root"],
    enableSkillTools: true,
    enableUploadTools: true,
    enableInterrupt: true,
    enableHumanTool: true,
  },
  chatbot: {
    selection: ["chatbot"],
    enableSkillTools: true,
    enableUploadTools: true,
    enableInterrupt: true,
    enableHumanTool: true,
  },

  workflow: {
    selection: ["workflow"],
    enableSkillTools: false,
    enableUploadTools: true,
    enableInterrupt: false,
    enableHumanTool: false,
  },
};

const EditTeamMember = forwardRef<HTMLFormElement, EditTeamMemberProps>(
  ({ member, teamId, isOpen, onClose }, ref) => {
    const { t } = useTranslation();
    const queryClient = useQueryClient();
    const showToast = useCustomToast();
    const [showTooltip, setShowTooltip] = useState(false);
    const [selectedModelProvider, setSelectedModelProvider] =
      useState<string>("openai");
    const {
      data: toolProviders,
      isLoading: isLoadingToolProviders,
      isError: isErrorToolProviders,
      error: errorToolProviders,
    } = useQuery({
      queryKey: ["toolProviders"],
      queryFn: () => ToolproviderService.readProviderListWithTools(),
    });



    const {
      data: uploads,
      isLoading: isLoadingUploads,
      isError: isErrorUploads,
      error: errorUploads,
    } = useUploadsQuery();

    const {
      data: models,
      isLoading: isLoadingModel,
      isError: isErrorModel,
      error: errorModel,
    } = useModelQuery();

    if (isErrorToolProviders || isErrorUploads || isErrorModel) {
      const error = errorToolProviders || errorUploads || errorModel;
      const errDetail = (error as ApiError).body?.detail;

      showToast("Something went wrong.", `${errDetail}`, "error");
    }

    const {
      register,
      handleSubmit,
      reset,
      control,
      watch,
      setValue,
      formState: { isSubmitting, errors, isDirty, isValid },
    } = useForm<MemberUpdate>({
      mode: "onBlur",
      criteriaMode: "all",
      values: {
        ...member,
        tools: member.tools.map((tool) => ({
          ...tool,
          label: tool.name,
          value: tool.id,
        })),
        uploads: member.uploads.map((upload) => ({
          ...upload,
          label: upload.name,
          value: upload.id,
        })),
      },
    });

    const updateMember = async (data: MemberUpdate) => {
      return await MembersService.updateMember({
        id: member.id,
        teamId: teamId,
        requestBody: data,
      });
    };

    const mutation = useMutation(updateMember, {
      onSuccess: (data) => {
        showToast("Success!", "Team updated successfully.", "success");
        reset(data); // reset isDirty after updating
        onClose();
      },
      onError: (err: ApiError) => {
        const errDetail = err.body?.detail;

        showToast("Something went wrong.", `${errDetail}`, "error");
      },
      onSettled: () => {
        queryClient.invalidateQueries(`teams/${teamId}/members`);
      },
    });

    const onSubmit: SubmitHandler<TeamUpdate> = async (data) => {
      mutation.mutate(data);
    };

    const onCancel = () => {
      reset();
      onClose();
    };

    const memberConfig = ALLOWED_MEMBER_CONFIGS[watch("type") as MemberTypes];

    // 工具选择器模态框状态
    const [isToolSelectorOpen, setIsToolSelectorOpen] = useState(false);
    const [isPageToolSelectorOpen, setIsPageToolSelectorOpen] = useState(false);



    const uploadOptions = uploads
      ? uploads.data.map((upload) => ({
          ...upload,
          label: upload.name,
          value: upload.id,
        }))
      : [];

    const onModelSelect = (modelName: string) => {
      const selectedModel = models?.data.find(
        (model) => model.ai_model_name === modelName,
      );

      if (selectedModel) {
        setValue("model", modelName);

        setValue("provider", selectedModel?.provider.provider_name);

        setSelectedModelProvider(selectedModel.provider.provider_name);
      }
    };

    useEffect(() => {
      if (member.model) {
        const selectedModelData = models?.data.find(
          (model) => model.ai_model_name === member.model,
        );
        if (selectedModelData) {
          setSelectedModelProvider(selectedModelData.provider.provider_name);
        }
      }
    }, [member.model, models]);

    if (member.type.endsWith("bot")) {
      return (
        <Box maxH={"full"} h="full" minH="full" overflow={"hidden"}>
          <Box
            as="form"
            ref={ref}
            onSubmit={handleSubmit(onSubmit)}
            bg={"white"}
            borderRadius={"lg"}
            h="full"
            maxH={"full"}
            minH="full"
          >
            <Box
              display="flex"
              flexDirection={"column"}
              h="full"
              maxH={"full"}
              overflow={"auto"}
            >
              <FormControl mt={4} isRequired isInvalid={!!errors.name} px="6">
                <FormLabel htmlFor="name">
                  {t("team.teamsetting.name")}
                </FormLabel>
                <Input
                  id="name"
                  {...register("name", {
                    required: "Name is required.",
                    pattern: {
                      value: /^[a-zA-Z0-9_-]{1,64}$/,
                      message:
                        "Name must follow pattern: ^[a-zA-Z0-9_-]{1,64}$",
                    },
                  })}
                  placeholder="Name"
                  type="text"
                />
                {errors.name && (
                  <FormErrorMessage>{errors.name.message}</FormErrorMessage>
                )}
              </FormControl>
              <FormControl mt={4} isRequired isInvalid={!!errors.role} px="6">
                <FormLabel htmlFor="role">
                  {t("team.teamsetting.role")}
                </FormLabel>
                <Textarea
                  id="role"
                  {...register("role", { required: "Role is required." })}
                  placeholder="Role"
                  className="nodrag nopan"
                />
                {errors.role && (
                  <FormErrorMessage>{errors.role.message}</FormErrorMessage>
                )}
              </FormControl>
              <FormControl mt={4} px="6">
                <FormLabel htmlFor="backstory">
                  {t("team.teamsetting.backstory")}
                </FormLabel>
                <Textarea
                  id="backstory"
                  {...register("backstory")}
                  className="nodrag nopan"
                />
              </FormControl>

              <FormControl px={6} mt={4}>
                <FormLabel htmlFor="model">
                  {t("team.teamsetting.model")}
                </FormLabel>
                <ModelSelect<MemberUpdate>
                  models={models}
                  control={control}
                  name="model"
                  value={member.model}
                  selectedProvider={selectedModelProvider}
                  onModelSelect={onModelSelect}
                  isLoading={isLoadingModel}
                />
              </FormControl>
              {memberConfig.enableSkillTools && (
                <Controller
                  control={control}
                  name="tools"
                  render={({ field, fieldState }) => (
                    <FormControl mt={4} px="6" isInvalid={!!fieldState.error} id="tools">
                      <HStack justify="space-between" align="center" mb={2}>
                        <FormLabel mb={0}>{t("team.teamsetting.tools")}</FormLabel>
                        <Button 
                          leftIcon={<FaTools />}
                          onClick={() => setIsPageToolSelectorOpen(true)}
                          size="sm"
                          variant="outline"
                        >
                          Add tools
                        </Button>
                        <ToolSelector
                          isOpen={isPageToolSelectorOpen}
                          onClose={() => setIsPageToolSelectorOpen(false)}
                          providers={toolProviders?.providers || []}
                          selectedTools={(field.value || []).map(tool => ({
                            id: tool.id || 0,
                            name: tool.name,
                            description: tool.description || '',
                            display_name: tool.display_name || null,
                            input_parameters: tool.input_parameters || null,
                            is_online: tool.is_online || null,
                          }))}
                          onSelect={(tool) => {
                            const currentTools = field.value || [];
                            // 查找工具所属的提供商ID
                            let providerId = 0;
                            if (toolProviders?.providers) {
                              for (const provider of toolProviders.providers) {
                                if (provider.tools.some(t => t.id === tool.id)) {
                                  providerId = provider.id;
                                  break;
                                }
                              }
                            }
                            const newTools = [...currentTools, {
                              name: tool.name,
                              description: tool.description || '',
                              display_name: tool.display_name || undefined,
                              input_parameters: tool.input_parameters || undefined,
                              is_online: tool.is_online || undefined,
                              provider_id: providerId,
                              id: tool.id,
                            }];
                            field.onChange(newTools);
                          }}
                          onDeselect={(tool) => {
                            const currentTools = field.value || [];
                            const newTools = currentTools.filter(t => t.id !== tool.id);
                            field.onChange(newTools);
                          }}
                          onBatchChange={(tools, selected) => {
                            const currentTools = field.value || [];
                            if (selected) {
                              // 添加工具
                              const newTools = [...currentTools];
                              tools.forEach(tool => {
                                // 检查工具是否已存在
                                if (!newTools.some(t => t.id === tool.id)) {
                                  // 查找工具所属的提供商ID
                                  let providerId = 0;
                                  if (toolProviders?.providers) {
                                    for (const provider of toolProviders.providers) {
                                      if (provider.tools.some(t => t.id === tool.id)) {
                                        providerId = provider.id;
                                        break;
                                      }
                                    }
                                  }
                                  newTools.push({
                                    name: tool.name,
                                    description: tool.description || '',
                                    display_name: tool.display_name || undefined,
                                    input_parameters: tool.input_parameters || undefined,
                                    is_online: tool.is_online || undefined,
                                    provider_id: providerId,
                                    id: tool.id,
                                  });
                                }
                              });
                              field.onChange(newTools);
                            } else {
                              // 移除工具
                              const toolIdsToRemove = new Set(tools.map(t => t.id));
                              const newTools = currentTools.filter(t => !toolIdsToRemove.has(t.id!));
                              field.onChange(newTools);
                            }
                          }}
                        />
                      </HStack>
                      {field.value && field.value.length > 0 && (
                        <Box mt={3}>
                          <SimpleGrid columns={2} spacing={3}>
                            {field.value.map((tool) => {
                              // 查找工具所属的提供商
                              let provider = null;
                              if (toolProviders?.providers) {
                                for (const p of toolProviders.providers) {
                                  if (p.tools.some(t => t.id === tool.id)) {
                                    provider = p;
                                    break;
                                  }
                                }
                              }
                              
                              return (
                                <HStack
                                  key={tool.id}
                                  role="group"
                                  justify="space-between"
                                  p={3}
                                  boxShadow="sm"
                                  borderWidth="1px"
                                  borderColor="gray.200"
                                  borderRadius="lg"
                                  w="100%"
                                >
                                  <HStack flex="1" spacing={2} overflow="hidden">
                                    <Box flexShrink={0} w={7} h={7} borderRadius="lg" bg="primary.50" display="flex" alignItems="center" justifyContent="center">
                                      {provider && provider.icon && (
                                        <ToolsIcon 
                                          tools_name={provider.icon || provider.provider_name || ''} 
                                          color={`${provider.tool_type === 'builtin' ? "blue" : "purple"}.500`} 
                                        />
                                      )}
                                    </Box>
                                    <Text fontSize="sm" fontWeight="medium" isTruncated>
                                      {tool.display_name || tool.name}
                                    </Text>
                                  </HStack>
                                  <IconButton
                                    aria-label="Remove tool"
                                    icon={<CircleMinus size={16} />}
                                    variant="ghost"
                                    size="sm"
                                    isRound
                                    opacity={0}
                                    transition="opacity 0.2s"
                                    _groupHover={{ opacity: 1 }}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const newTools = field.value!.filter(t => t.id !== tool.id);
                                      field.onChange(newTools);
                                    }}
                                  />
                                </HStack>
                              );
                            })}
                          </SimpleGrid>
                        </Box>
                      )}
                      <FormErrorMessage>{fieldState.error?.message}</FormErrorMessage>
                    </FormControl>
                  )}
                />
              )}
              {memberConfig.enableUploadTools && (
                <Controller
                  control={control}
                  name="uploads"
                  render={({
                    field: { onChange, onBlur, value, name, ref },
                    fieldState: { error },
                  }) => (
                    <FormControl mt={4} isInvalid={!!error} id="uploads">
                      <FormLabel>Knowledge Base</FormLabel>
                      <MultiSelect
                        isDisabled={!memberConfig.enableUploadTools}
                        isLoading={isLoadingUploads}
                        isMulti
                        name={name}
                        ref={ref}
                        onChange={onChange}
                        onBlur={onBlur}
                        value={value}
                        options={uploadOptions}
                        placeholder="Select uploads"
                        closeMenuOnSelect={false}
                        components={customSelectOption}
                      />
                      <FormErrorMessage>{error?.message}</FormErrorMessage>
                    </FormControl>
                  )}
                />
              )}
              {memberConfig.enableInterrupt && (
                <FormControl mt={4}>
                  <FormLabel htmlFor="interrupt">Human In The Loop</FormLabel>
                  <Checkbox {...register("interrupt")}>
                    Require approval before executing actions
                  </Checkbox>
                </FormControl>
              )}

              <Controller
                control={control}
                name="temperature"
                rules={{ required: true }}
                render={({
                  field: { onChange, onBlur, value, name, ref },
                  fieldState: { error },
                }) => (
                  <FormControl py={4} px="6" isRequired isInvalid={!!error}>
                    <FormLabel htmlFor="temperature">Temperature</FormLabel>
                    <Slider
                      id="temperature"
                      name={name}
                      value={value ?? 0} // Use nullish coalescing to ensure value is never null
                      onChange={onChange}
                      onBlur={onBlur}
                      ref={ref}
                      min={0}
                      max={1}
                      step={0.1}
                      onMouseEnter={() => setShowTooltip(true)}
                      onMouseLeave={() => setShowTooltip(false)}
                    >
                      <SliderTrack>
                        <SliderFilledTrack />
                      </SliderTrack>
                      <Tooltip
                        hasArrow
                        placement="top"
                        isOpen={showTooltip}
                        label={watch("temperature")}
                      >
                        <SliderThumb />
                      </Tooltip>
                    </Slider>
                    <FormErrorMessage>{error?.message}</FormErrorMessage>
                  </FormControl>
                )}
              />
            </Box>
          </Box>
        </Box>
      );
    }

    return (
      <Modal isOpen={isOpen} onClose={onClose} isCentered>
        <ModalOverlay>
          <ModalContent as="form" onSubmit={handleSubmit(onSubmit)}>
            <ModalHeader>Update Team Member</ModalHeader>
            <ModalCloseButton />
            <ModalBody pb={6}>
              <FormControl
                isDisabled={
                  member.type === "root" ||
                  member.type.startsWith("freelancer") ||
                  member.type.endsWith("bot")
                }
              >
                <FormLabel htmlFor="type">Type</FormLabel>
                <Select id="type" {...register("type")}>
                  {memberConfig.selection.map((member, index) => (
                    <option key={index} value={member}>
                      {member}
                    </option>
                  ))}
                </Select>
              </FormControl>
              <FormControl mt={4} isRequired isInvalid={!!errors.name}>
                <FormLabel htmlFor="name">Name</FormLabel>
                <Input
                  id="name"
                  {...register("name", {
                    required: "Name is required.",
                    pattern: {
                      value: /^[a-zA-Z0-9_-]{1,64}$/,
                      message:
                        "Name must follow pattern: ^[a-zA-Z0-9_-]{1,64}$",
                    },
                  })}
                  placeholder="Name"
                  type="text"
                />
                {errors.name && (
                  <FormErrorMessage>{errors.name.message}</FormErrorMessage>
                )}
              </FormControl>
              <FormControl mt={4} isRequired isInvalid={!!errors.role}>
                <FormLabel htmlFor="role">Role</FormLabel>
                <Textarea
                  id="role"
                  {...register("role", { required: "Role is required." })}
                  placeholder="Role"
                  className="nodrag nopan"
                />
                {errors.role && (
                  <FormErrorMessage>{errors.role.message}</FormErrorMessage>
                )}
              </FormControl>
              <FormControl mt={4}>
                <FormLabel htmlFor="backstory">Backstory</FormLabel>
                <Textarea
                  id="backstory"
                  {...register("backstory")}
                  className="nodrag nopan"
                />
              </FormControl>
              <FormControl mt={4}>
                <FormLabel htmlFor="model">
                  {t("team.teamsetting.model")}
                </FormLabel>
                <ModelSelect<MemberUpdate>
                  models={models}
                  control={control}
                  name="model"
                  value={member.model}
                  selectedProvider={selectedModelProvider}
                  onModelSelect={onModelSelect}
                  isLoading={isLoadingModel}
                />
              </FormControl>
              {memberConfig.enableSkillTools && (
                <Controller
                  control={control}
                  name="tools"
                  render={({
                    field: { onChange, onBlur, value, name, ref },
                    fieldState: { error },
                  }) => (
                    <FormControl mt={4} isInvalid={!!error} id="skills">
                      <HStack justify="space-between" align="center" mb={2}>
                        <FormLabel mb={0}>Tools</FormLabel>
                        <Button 
                          leftIcon={<FaTools/>}
                          onClick={() => setIsToolSelectorOpen(true)}
                          size="sm"
                          variant="outline"
                        >
                          Add tools
                        </Button>
                        <ToolSelector
                          isOpen={isToolSelectorOpen}
                          onClose={() => setIsToolSelectorOpen(false)}
                          providers={toolProviders?.providers || []}
                          selectedTools={(value || []).map(tool => ({
                            id: tool.id || 0,
                            name: tool.name,
                            description: tool.description || '',
                            display_name: tool.display_name || null,
                            input_parameters: tool.input_parameters || null,
                            is_online: tool.is_online || null,
                          }))}
                          onSelect={(tool) => {
                            const currentTools = value || [];
                            // 查找工具所属的提供商ID
                            let providerId = 0;
                            if (toolProviders?.providers) {
                              for (const provider of toolProviders.providers) {
                                if (provider.tools.some(t => t.id === tool.id)) {
                                  providerId = provider.id;
                                  break;
                                }
                              }
                            }
                            const newTools = [...currentTools, {
                              name: tool.name,
                              description: tool.description || '',
                              display_name: tool.display_name || undefined,
                              input_parameters: tool.input_parameters || undefined,
                              is_online: tool.is_online || undefined,
                              provider_id: providerId,
                              id: tool.id,
                            }];
                            onChange(newTools);
                          }}
                          onDeselect={(tool) => {
                            const currentTools = value || [];
                            const newTools = currentTools.filter(t => t.id !== tool.id);
                            onChange(newTools);
                          }}
                          onBatchChange={(tools, selected) => {
                            const currentTools = value || [];
                            if (selected) {
                              // 添加工具
                              const newTools = [...currentTools];
                              tools.forEach(tool => {
                                // 检查工具是否已存在
                                if (!newTools.some(t => t.id === tool.id)) {
                                  // 查找工具所属的提供商ID
                                  let providerId = 0;
                                  if (toolProviders?.providers) {
                                    for (const provider of toolProviders.providers) {
                                      if (provider.tools.some(t => t.id === tool.id)) {
                                        providerId = provider.id;
                                        break;
                                      }
                                    }
                                  }
                                  newTools.push({
                                    name: tool.name,
                                    description: tool.description || '',
                                    display_name: tool.display_name || undefined,
                                    input_parameters: tool.input_parameters || undefined,
                                    is_online: tool.is_online || undefined,
                                    provider_id: providerId,
                                    id: tool.id,
                                  });
                                }
                              });
                              onChange(newTools);
                            } else {
                              // 移除工具
                              const toolIdsToRemove = new Set(tools.map(t => t.id));
                              const newTools = currentTools.filter(t => !toolIdsToRemove.has(t.id!));
                              onChange(newTools);
                            }
                          }}
                        />
                      </HStack>
                      {value && value.length > 0 && (
                        <Box mt={3}>
                          <SimpleGrid columns={2} spacing={3}>
                            {value.map((tool) => {
                              // 查找工具所属的提供商
                              let provider = null;
                              if (toolProviders?.providers) {
                                for (const p of toolProviders.providers) {
                                  if (p.tools.some(t => t.id === tool.id)) {
                                    provider = p;
                                    break;
                                  }
                                }
                              }
                              
                              return (
                                <HStack
                                  key={tool.id}
                                  role="group"
                                  justify="space-between"
                                  p={3}
                                  boxShadow="sm"
                                  borderWidth="1px"
                                  borderColor="gray.200"
                                  borderRadius="lg"
                                  w="100%"
                                >
                                  <HStack flex="1" spacing={2} overflow="hidden">
                                    <Box flexShrink={0} w={7} h={7} borderRadius="lg" bg="primary.50" display="flex" alignItems="center" justifyContent="center">
                                      {provider && provider.icon && (
                                        <ToolsIcon 
                                          tools_name={provider.provider_name || ''} 
                                          color={`${provider.tool_type === 'builtin' ? "blue" : "purple"}.500`} 
                                        />
                                      )}
                                    </Box>
                                    <Text fontSize="xs" fontWeight="medium" isTruncated>
                                      {tool.display_name || tool.name}
                                    </Text>
                                  </HStack>
                                  <IconButton
                                    aria-label="Remove tool"
                                    icon={<CircleMinus size={16} />}
                                    variant="ghost"
                                    size="sm"
                                    isRound
                                    opacity={0}
                                    transition="opacity 0.2s"
                                    _groupHover={{ opacity: 1 }}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const newTools = value.filter(t => t.id !== tool.id);
                                      onChange(newTools);
                                    }}
                                  />
                                </HStack>
                              );
                            })}
                          </SimpleGrid>
                        </Box>
                      )}
                      <FormErrorMessage>{error?.message}</FormErrorMessage>
                    </FormControl>
                  )}
                />
              )}
              {memberConfig.enableUploadTools && (
                <Controller
                  control={control}
                  name="uploads"
                  render={({
                    field: { onChange, onBlur, value, name, ref },
                    fieldState: { error },
                  }) => (
                    <FormControl mt={4} isInvalid={!!error} id="uploads">
                      <FormLabel>Knowledge Base</FormLabel>
                      <MultiSelect
                        isDisabled={!memberConfig.enableUploadTools}
                        isLoading={isLoadingUploads}
                        isMulti
                        name={name}
                        ref={ref}
                        onChange={onChange}
                        onBlur={onBlur}
                        value={value}
                        options={uploadOptions}
                        placeholder="Select uploads"
                        closeMenuOnSelect={false}
                        components={customSelectOption}
                      />
                      <FormErrorMessage>{error?.message}</FormErrorMessage>
                    </FormControl>
                  )}
                />
              )}
              {memberConfig.enableInterrupt && (
                <FormControl mt={4}>
                  <FormLabel htmlFor="interrupt">Human In The Loop</FormLabel>
                  <Checkbox {...register("interrupt")}>
                    Require approval before executing actions
                  </Checkbox>
                </FormControl>
              )}

              <Controller
                control={control}
                name="temperature"
                rules={{ required: true }}
                render={({
                  field: { onChange, onBlur, value, name, ref },
                  fieldState: { error },
                }) => (
                  <FormControl mt={4} isRequired isInvalid={!!error}>
                    <FormLabel htmlFor="temperature">Temperature</FormLabel>
                    <Slider
                      id="temperature"
                      name={name}
                      value={value ?? 0} // Use nullish coalescing to ensure value is never null
                      onChange={onChange}
                      onBlur={onBlur}
                      ref={ref}
                      min={0}
                      max={1}
                      step={0.1}
                      onMouseEnter={() => setShowTooltip(true)}
                      onMouseLeave={() => setShowTooltip(false)}
                    >
                      <SliderTrack>
                        <SliderFilledTrack />
                      </SliderTrack>
                      <Tooltip
                        hasArrow
                        placement="top"
                        isOpen={showTooltip}
                        label={watch("temperature")}
                      >
                        <SliderThumb />
                      </Tooltip>
                    </Slider>
                    <FormErrorMessage>{error?.message}</FormErrorMessage>
                  </FormControl>
                )}
              />
            </ModalBody>
            <ModalFooter gap={3}>
              <Button
                variant="primary"
                type="submit"
                isLoading={isSubmitting || mutation.isLoading}
                isDisabled={!isDirty || !isValid}
              >
                Save
              </Button>
              <Button onClick={onCancel}>Cancel</Button>
            </ModalFooter>
          </ModalContent>
        </ModalOverlay>
      </Modal>
    );
  },
);

EditTeamMember.displayName = "EditTeamMember";
export default EditTeamMember;
