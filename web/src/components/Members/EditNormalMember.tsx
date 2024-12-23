import {
  Box,
  Checkbox,
  FormControl,
  FormErrorMessage,
  FormLabel,
  Input,
  Slider,
  SliderFilledTrack,
  SliderThumb,
  SliderTrack,
  Textarea,
  Tooltip,
} from "@chakra-ui/react";
import { Select as MultiSelect, chakraComponents } from "chakra-react-select";
import { type Ref, forwardRef, useState } from "react";
import { Controller, type SubmitHandler, useForm } from "react-hook-form";
import { useMutation, useQueryClient } from "react-query";

import { useModelQuery } from "@/hooks/useModelQuery";
import { useSkillsQuery } from "@/hooks/useSkillsQuery";
import { useUploadsQuery } from "@/hooks/useUploadsQuery";

import {
  type ApiError,
  type MemberOut,
  type MemberUpdate,
  MembersService,
  type TeamUpdate,
} from "../../client";
import useCustomToast from "../../hooks/useCustomToast";
import ModelSelect from "../Common/ModelProvider";

interface EditAgentProps {
  member: MemberOut;
  teamId: number;
  ref?: Ref<HTMLFormElement>;
}

const customSelectOption = {
  Option: (props: any) => (
    <chakraComponents.Option {...props}>
      {props.children}: {props.data.description}
    </chakraComponents.Option>
  ),
};

const EditNormalMember = forwardRef<HTMLFormElement, EditAgentProps>(
  ({ member, teamId }, ref) => {
    const queryClient = useQueryClient();
    const showToast = useCustomToast();
    const [showTooltip, setShowTooltip] = useState(false);
    const {
      data: skills,
      isLoading: isLoadingSkills,
      isError: isErrorSkills,
      error: errorSkills,
    } = useSkillsQuery();
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

    if (isErrorSkills || isErrorUploads || isErrorModel) {
      const error = errorSkills || errorUploads || errorModel;
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
        skills: member.skills.map((skill) => ({
          ...skill,
          label: skill.name,
          value: skill.id,
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

    // const onCancel = () => {
    //   reset();
    // };

    const skillOptions = skills
      ? skills.data.map((skill) => ({
          ...skill,
          label: skill.name,
          value: skill.id,
        }))
      : [];

    const uploadOptions = uploads
      ? uploads.data.map((upload) => ({
          ...upload,
          label: upload.name,
          value: upload.id,
        }))
      : [];

    const onModelSelect = (modelName: string) => {
      const selectedModel = models?.data.find(
        (model) => model.ai_model_name === modelName
      );

      setValue("model", modelName);
      setValue("api_key", selectedModel?.provider.api_key);
      setValue("provider", selectedModel?.provider.provider_name);
      setValue("base_url", selectedModel?.provider.base_url);
    };

    return (
      <Box maxH={"full"} h="full" minH="full" mr="2" overflow={"hidden"}>
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
            overflow={"auto"}
          >
            <FormControl mt={4} isRequired isInvalid={!!errors.name} px="6">
              <FormLabel htmlFor="name">名字</FormLabel>
              <Input
                id="name"
                {...register("name", {
                  required: "Name is required.",
                  pattern: {
                    value: /^[a-zA-Z0-9_-]{1,64}$/,
                    message: "Name must follow pattern: ^[a-zA-Z0-9_-]{1,64}$",
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
              <FormLabel htmlFor="role">角色</FormLabel>
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
              <FormLabel htmlFor="backstory">背景故事</FormLabel>
              <Textarea
                id="backstory"
                {...register("backstory")}
                className="nodrag nopan"
              />
            </FormControl>
            <Box px={6} mt={4}>
              <ModelSelect<MemberUpdate>
                models={models}
                control={control}
                name="model"
                onModelSelect={onModelSelect}
                isLoading={isLoadingModel}
              />
            </Box>
            <Controller
              control={control}
              name="skills"
              render={({
                field: { onChange, onBlur, value, name, ref },
                fieldState: { error },
              }) => (
                <FormControl mt={4} px="6" isInvalid={!!error} id="skills">
                  <FormLabel>工具</FormLabel>
                  <MultiSelect
                    // isDisabled={}
                    isLoading={isLoadingSkills}
                    isMulti
                    name={name}
                    ref={ref}
                    onChange={onChange}
                    onBlur={onBlur}
                    value={value}
                    options={skillOptions}
                    placeholder="Select skills"
                    closeMenuOnSelect={false}
                    components={customSelectOption}
                  />
                  <FormErrorMessage>{error?.message}</FormErrorMessage>
                </FormControl>
              )}
            />
            <Controller
              control={control}
              name="uploads"
              render={({
                field: { onChange, onBlur, value, name, ref },
                fieldState: { error },
              }) => (
                <FormControl mt={4} px="6" isInvalid={!!error} id="uploads">
                  <FormLabel>知识库</FormLabel>
                  <MultiSelect
                    // isDisabled={}
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
            {member.type.startsWith("freelancer") ? (
              <FormControl mt={4} px="6">
                <FormLabel htmlFor="interrupt">Human In The Loop</FormLabel>
                <Checkbox {...register("interrupt")}>
                  Require approval before executing actions
                </Checkbox>
              </FormControl>
            ) : null}

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
);

EditNormalMember.displayName = "EditAgent";
export default EditNormalMember;
