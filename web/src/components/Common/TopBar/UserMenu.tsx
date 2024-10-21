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
} from "@chakra-ui/react";
import { type BoxProps, forwardRef } from "@chakra-ui/react";
import Link from "next/link";
import { useTranslation } from "react-i18next";

import AccountSetting from "@/components/Settings";

import useAuth from "../../../hooks/useAuth";
import CustomModalWrapper from "../CustomModal";
const UserMenu = () => {
  const { logout, currentUser } = useAuth();

  const handleLogout = async () => {
    logout();
  };

  const { isOpen, onOpen, onClose } = useDisclosure();
  const { t } = useTranslation();
  const tqxMenuComponent = forwardRef<BoxProps, "div">((props, ref) => (
    <Box
      rounded="full"
      cursor="pointer"
      transition="background-color 0.3s ease"
      _hover={{ backgroundColor: "gray.200" }}
      _active={{ backgroundColor: "gray.200" }}
      _focus={{ outline: "none" }}
      ref={ref}
      {...props}
    >
      <Flex alignItems="center">
        <Avatar
          size="md"
          name={currentUser?.full_name!}
          src=""
          m={"2px"}
          cursor="pointer"
        />

        <Button
          rightIcon={<ChevronDownIcon />}
          maxWidth="100%"
          bg={"transparent"}
          _hover={{ bg: "transparent" }}
          _active={{ bg: "transparent" }}
          _focus={{ outline: "none" }}
        >
          {currentUser?.full_name!}
        </Button>
      </Flex>
    </Box>
  ));

  return (
    <>
      <Box display="flex" w="full" ml={"auto"}>
        <Box ml="auto">
          <Menu autoSelect={false}>
            <MenuButton as={tqxMenuComponent} />
            <MenuList>
              <Flex alignItems="center" mb={2}>
                <Avatar
                  size="sm"
                  name={currentUser?.full_name!}
                  src=""
                  m={"10px"}
                />
                <Box>
                  <Text fontWeight="bold">{currentUser?.full_name}</Text>
                  <Text fontSize="sm">{currentUser?.email}</Text>
                </Box>
              </Flex>
              <MenuDivider />

              <MenuItem as={Link} href="" onClick={onOpen}>
                {t("setting.modal.setting")}
                <CustomModalWrapper
                  component={<AccountSetting />}
                  size="6xl"
                  isOpen={isOpen}
                  onClose={onClose}
                />
              </MenuItem>

              <MenuItem as={Link} href="">
                {t("setting.modal.helpDocu")}
              </MenuItem>
              <MenuItem as={Link} href="">
                About
              </MenuItem>
              <MenuDivider />
              <MenuItem onClick={handleLogout}>
                {t("setting.modal.logOut")}
              </MenuItem>
            </MenuList>
          </Menu>
        </Box>
      </Box>
    </>
  );
};

export default UserMenu;
