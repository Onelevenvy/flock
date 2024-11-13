import { ChevronDownIcon } from "@chakra-ui/icons";
import {
  Avatar,
  Box,
  Button,
  Flex,
  Menu,
  MenuButton,
  MenuDivider,
  MenuItem,
  MenuList,
  Text,
  useDisclosure,
  VStack,
} from "@chakra-ui/react";

import { useTranslation } from "react-i18next";
import { FiSettings, FiHelpCircle, FiInfo, FiLogOut } from "react-icons/fi";

import AccountSetting from "@/components/Settings";
import useAuth from "@/hooks/useAuth";
import CustomModalWrapper from "../CustomModal";

const UserMenu = () => {
  const { logout, currentUser } = useAuth();
  const { isOpen, onOpen, onClose } = useDisclosure();
  const { t } = useTranslation();

  const handleLogout = async () => {
    logout();
  };

  const getUserName = () => {
    return currentUser?.full_name || currentUser?.email || 'User';
  };

  return (
    <Box>
      <Menu autoSelect={false} placement="bottom-end">
        <MenuButton
          as={Button}
          variant="ghost"
          px={4}
          py={2}
          borderRadius="lg"
          transition="all 0.2s"
          _hover={{ bg: "gray.50" }}
          _active={{ bg: "gray.100" }}
        >
          <Flex alignItems="center" gap={3}>
            <Avatar
              size="sm"
              name={getUserName()}
              bg="blue.500"
              color="white"
            />
            <Box textAlign="left">
              <Text
                fontSize="sm"
                fontWeight="500"
                color="gray.700"
                lineHeight="short"
              >
                {currentUser?.full_name || 'User'}
              </Text>
              <Text fontSize="xs" color="gray.500">
                {currentUser?.email || 'No email'}
              </Text>
            </Box>
            <ChevronDownIcon color="gray.500" />
          </Flex>
        </MenuButton>

        <MenuList
          py={2}
          border="1px solid"
          borderColor="gray.100"
          boxShadow="lg"
          borderRadius="xl"
        >
          <VStack align="stretch" spacing={1}>
            <MenuItem
              icon={<FiSettings />}
              onClick={onOpen}
              py={2}
              px={4}
              _hover={{ bg: "gray.50" }}
            >
              {t("setting.modal.setting")}
            </MenuItem>
            <MenuItem
              icon={<FiHelpCircle />}
              py={2}
              px={4}
              _hover={{ bg: "gray.50" }}
            >
              {t("setting.modal.helpDocu")}
            </MenuItem>
            <MenuItem
              icon={<FiInfo />}
              py={2}
              px={4}
              _hover={{ bg: "gray.50" }}
            >
              About
            </MenuItem>
            <MenuDivider />
            <MenuItem
              icon={<FiLogOut />}
              onClick={handleLogout}
              py={2}
              px={4}
              color="red.500"
              _hover={{ bg: "red.50" }}
            >
              {t("setting.modal.logOut")}
            </MenuItem>
          </VStack>
        </MenuList>
      </Menu>

      <CustomModalWrapper
        component={<AccountSetting />}
        size="6xl"
        isOpen={isOpen}
        onClose={onClose}
      />
    </Box>
  );
};

export default UserMenu;
