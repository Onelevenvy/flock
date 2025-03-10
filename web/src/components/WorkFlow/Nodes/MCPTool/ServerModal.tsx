import { Modal, ModalOverlay, ModalContent, ModalHeader, ModalFooter, ModalBody, ModalCloseButton, VStack, Input, Select, Button, FormControl, FormLabel } from "@chakra-ui/react";
import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";

interface ServerConfig {
  name: string;
  transport: 'stdio' | 'sse';
  command?: 'python' | 'node';
  args?: string[];
  url?: string;
}

interface ServerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (server: ServerConfig) => void;
  initialData?: ServerConfig;
}

const defaultConfig: ServerConfig = {
  name: "",
  transport: "stdio",
  command: "python",
  args: [""],
};

const ServerModal: React.FC<ServerModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialData,
}) => {
  const { t } = useTranslation();
  const [serverData, setServerData] = useState<ServerConfig>(defaultConfig);

  useEffect(() => {
    if (initialData) {
      setServerData(initialData);
    } else {
      setServerData(defaultConfig);
    }
  }, [initialData, isOpen]);

  const handleSave = () => {
    onSave(serverData);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>
          {initialData
            ? t("workflow.nodes.mcp.modal.editTitle")
            : t("workflow.nodes.mcp.modal.addTitle")}
        </ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <VStack spacing={4} align="stretch">
            <FormControl>
              <FormLabel fontSize="sm" mb={2}>
                {t("workflow.nodes.mcp.serverName")}
              </FormLabel>
              <Input
                placeholder={t("workflow.nodes.mcp.serverName")!}
                value={serverData.name}
                onChange={(e) =>
                  setServerData({ ...serverData, name: e.target.value })
                }
              />
            </FormControl>

            <FormControl>
              <FormLabel fontSize="sm" mb={2}>
                {t("workflow.nodes.mcp.transport")}
              </FormLabel>
              <Select
                value={serverData.transport}
                onChange={(e) =>
                  setServerData({
                    ...serverData,
                    transport: e.target.value as "stdio" | "sse",
                  })
                }
              >
                <option value="stdio">{t("workflow.nodes.mcp.serverType.stdio")}</option>
                <option value="sse">{t("workflow.nodes.mcp.serverType.sse")}</option>
              </Select>
            </FormControl>

            {serverData.transport === "stdio" && (
              <>
                <FormControl>
                  <FormLabel fontSize="sm" mb={2}>
                    {t("workflow.nodes.mcp.command")}
                  </FormLabel>
                  <Select
                    value={serverData.command}
                    onChange={(e) =>
                      setServerData({
                        ...serverData,
                        command: e.target.value as "python" | "node",
                      })
                    }
                  >
                    <option value="python">Python</option>
                    <option value="node" disabled>
                      Node.js (Not supported yet)
                    </option>
                  </Select>
                </FormControl>

                <FormControl>
                  <FormLabel fontSize="sm" mb={2}>
                    {t("workflow.nodes.mcp.scriptPath")}
                  </FormLabel>
                  <Input
                    placeholder={t("workflow.nodes.mcp.scriptPath")!}
                    value={serverData.args?.[0] || ""}
                    onChange={(e) =>
                      setServerData({
                        ...serverData,
                        args: [e.target.value],
                      })
                    }
                  />
                </FormControl>
              </>
            )}

            {serverData.transport === "sse" && (
              <FormControl>
                <FormLabel fontSize="sm" mb={2}>
                  {t("workflow.nodes.mcp.sseUrl")}
                </FormLabel>
                <Input
                  placeholder={t("workflow.nodes.mcp.sseUrl")!}
                  value={serverData.url || ""}
                  onChange={(e) =>
                    setServerData({ ...serverData, url: e.target.value })
                  }
                />
              </FormControl>
            )}
          </VStack>
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" mr={3} onClick={onClose}>
            {t("workflow.nodes.mcp.modal.cancel")}
          </Button>
          <Button colorScheme="blue" onClick={handleSave}>
            {t("workflow.nodes.mcp.modal.save")}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default ServerModal; 