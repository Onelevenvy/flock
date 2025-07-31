import { useState, useEffect, useRef } from "react";
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  Button,
  FormControl,
  FormLabel,
  Input,
  Select,
  VStack,
  Text,
} from "@chakra-ui/react";
import { ToolproviderService } from "@/client/services/ToolproviderService";
import type { ToolProviderWithToolsListOut } from "@/client/models/ToolProviderWithToolsListOut";
import { useMutation, useQueryClient } from "react-query";
import { ApiError } from "@/client/core/ApiError";
import useCustomToast from "@/hooks/useCustomToast";

interface CreateMcpFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  editProvider?: ToolProviderWithToolsListOut;
}

export function CreateMcpForm({ isOpen, onClose, onSuccess, editProvider }: CreateMcpFormProps) {
  const showToast = useCustomToast();
  const queryClient = useQueryClient();
  const isEditMode = !!editProvider;
  const initialRef = useRef<HTMLInputElement | null>(null!);
  
  const [formData, setFormData] = useState({
    provider_name: "",
    mcp_endpoint_url: "",
    mcp_server_id: "",
    mcp_connection_type: "sse", // 默认值
    icon: "mcp"
  });

  useEffect(() => {
    if (editProvider) {
      // 填充编辑数据
      setFormData({
        provider_name: editProvider.provider_name || "",
        mcp_endpoint_url: editProvider.mcp_endpoint_url || "",
        mcp_server_id: editProvider.mcp_server_id || "",
        mcp_connection_type: editProvider.mcp_connection_type || "sse",
        icon: editProvider.icon || ""
      });
    } else {
      // 重置表单数据
      setFormData({
        provider_name: "",
        mcp_endpoint_url: "",
        mcp_server_id: "",
        mcp_connection_type: "sse",
        icon: ""
      });
    }
  }, [editProvider]);

  const handleChange = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [field]: e.target.value });
  };

  // 创建 MCP 提供者的 mutation
  const createMutation = useMutation(
    (data: any) => ToolproviderService.createMcpProvider({ requestBody: data }),
    {
      onSuccess: (data) => {
        showToast(
          "Success",
          "MCP service created successfully",
          "success"
        );
        onSuccess();
        onClose();
      },
      onError: (error: ApiError) => {
        const errorMessage = error.body?.detail || "Error occurred during creation";
        showToast(
          "Error",
          errorMessage,
          "error"
        );
      },
      onSettled: () => {
        queryClient.invalidateQueries("toolproviders");
      }
    }
  );

  // 更新 MCP 提供者的 mutation
  const updateMutation = useMutation(
    ({ id, updateData }: { id: number, updateData: any }) => 
      ToolproviderService.updateMcpProvider({ 
        toolProviderId: id, 
        requestBody: updateData 
      }),
    {
      onSuccess: (data) => {
        showToast(
          "Success",
          "MCP service updated successfully",
          "success"
        );
        onSuccess();
        onClose();
      },
      onError: (error: ApiError) => {
        const errorMessage = error.body?.detail || "Error occurred during update";
        showToast(
          "Error",
          errorMessage,
          "error"
        );
      },
      onSettled: () => {
        queryClient.invalidateQueries("toolproviders");
      }
    }
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.provider_name || !formData.mcp_endpoint_url || !formData.mcp_server_id) {
      showToast(
        "Error",
        "Please fill in all required fields",
        "error"
      );
      return;
    }
    
    if (isEditMode && editProvider) {
      // 更新现有MCP
      updateMutation.mutate({
        id: editProvider.id,
        updateData: {
          provider_name: formData.provider_name,
          mcp_endpoint_url: formData.mcp_endpoint_url,
          mcp_connection_type: formData.mcp_connection_type,
          icon: formData.icon || undefined,
          // 不更新 mcp_server_id
        }
      });
    } else {
      // 创建新MCP
      createMutation.mutate({
        provider_name: formData.provider_name,
        mcp_endpoint_url: formData.mcp_endpoint_url,
        mcp_server_id: formData.mcp_server_id,
        mcp_connection_type: formData.mcp_connection_type,
        icon: formData.icon || undefined
      });
    }
  };

  // 判断是否正在提交
  const isSubmitting = createMutation.isLoading || updateMutation.isLoading;

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose}
      initialFocusRef={initialRef as React.RefObject<HTMLInputElement>}
      size="md"
    >
      <ModalOverlay />
      <ModalContent>
        <ModalHeader borderBottomWidth="1px">
          {isEditMode ? "Edit" : "Add"} MCP Service (HTTP)
          <Text fontSize="sm" fontWeight="normal" mt={1} color="gray.500">
            {isEditMode ? "Modify MCP service configuration" : "Add a new MCP service connection"}
          </Text>
        </ModalHeader>
        <ModalCloseButton />
        
        <form onSubmit={handleSubmit}>
          <ModalBody py={6}>
            <VStack spacing={6} align="stretch">
              <FormControl>
                <FormLabel fontSize="sm" fontWeight="medium">Name</FormLabel>
                <Input
                  ref={initialRef}
                  placeholder="Name your MCP service"
                  value={formData.provider_name}
                  onChange={handleChange("provider_name")}
                  isRequired
                />
              </FormControl>
              
              <FormControl>
                <FormLabel fontSize="sm" fontWeight="medium">Server ID</FormLabel>
                <Input
                  placeholder="Server unique identifier, e.g. my-mcp-server"
                  value={formData.mcp_server_id}
                  onChange={handleChange("mcp_server_id")}
                  isRequired
                  isDisabled={isEditMode} // 编辑模式下禁用服务器ID
                />
              </FormControl>
              
              <FormControl>
                <FormLabel fontSize="sm" fontWeight="medium">Connection Type</FormLabel>
                <Select 
                  value={formData.mcp_connection_type}
                  onChange={handleChange("mcp_connection_type")}
                >
                  <option value="sse">SSE</option>
                  <option value="streamable_http">Streamable HTTP</option>
                </Select>
              </FormControl>
              
              <FormControl>
                <FormLabel fontSize="sm" fontWeight="medium">Service Endpoint URL</FormLabel>
                <Input
                  placeholder="Service endpoint URL"
                  value={formData.mcp_endpoint_url}
                  onChange={handleChange("mcp_endpoint_url")}
                  isRequired
                />
              </FormControl>
            </VStack>
          </ModalBody>

          <ModalFooter borderTopWidth="1px" gap={3}>
            <Button 
              variant="outline" 
              onClick={onClose}
              isDisabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button 
              colorScheme="blue"
              type="submit"
              isLoading={isSubmitting}
              loadingText={isEditMode ? "Updating..." : "Authorizing..."}
            >
              {isEditMode ? "Update" : "Add and Authorize"}
            </Button>
          </ModalFooter>
        </form>
      </ModalContent>
    </Modal>
  );
} 