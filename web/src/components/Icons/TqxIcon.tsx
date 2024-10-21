import {
  Box,
  IconButton,
  Popover,
  PopoverArrow,
  PopoverBody,
  PopoverCloseButton,
  PopoverContent,
  PopoverHeader,
  PopoverTrigger,
} from "@chakra-ui/react";
import type React from "react";
import { useState } from "react";
import {
  FcBullish,
  FcBusinessman,
  FcBusinesswoman,
  FcHome,
  FcNews,
  FcOldTimeCamera,
  FcRating,
  FcShipped,
  FcTrademark,
  FcVip,
} from "react-icons/fc";

const iconSize = 28;

const tqxIconLibrary: Record<
  string,
  {
    colorScheme: string;
    backgroundColor: string;
    icon: React.ReactElement;
  }
> = {
  "0": {
    icon: <FcBusinessman size={iconSize} />,
    colorScheme: "#FF6F61",
    backgroundColor: "#FFE5E5",
  },
  "1": {
    icon: <FcBusinesswoman size={iconSize} />,
    colorScheme: "#FF8C00",
    backgroundColor: "#FFE5B4",
  },
  "2": {
    icon: <FcShipped size={iconSize} />,
    colorScheme: "#32CD32",
    backgroundColor: "#E0FFE0",
  },
  "3": {
    icon: <FcRating size={iconSize} />,
    colorScheme: "#4682B4",
    backgroundColor: "#E0FFFF",
  },
  "4": {
    icon: <FcOldTimeCamera size={iconSize} />,
    colorScheme: "#6A5ACD",
    backgroundColor: "#E6E6FA",
  },
  "5": {
    icon: <FcBullish size={iconSize} />,
    colorScheme: "#FF4500",
    backgroundColor: "#FFDAB9",
  },
  "6": {
    icon: <FcHome size={iconSize} />,
    colorScheme: "#20B2AA",
    backgroundColor: "#E0FFFF",
  },
  "7": {
    icon: <FcNews size={iconSize} />,
    colorScheme: "#FFD700",
    backgroundColor: "#FFFFE0",
  },
  "8": {
    icon: <FcVip size={iconSize} />,
    colorScheme: "#DC143C",
    backgroundColor: "#F8F8FF",
  },
  "9": {
    icon: <FcTrademark size={iconSize} />,
    colorScheme: "#8A2BE2",
    backgroundColor: "#E6E6FA",
  },
};

interface IconPickerProps {
  onSelect: (icon: string) => void;
  selectedIcon: string;
}

const IconPicker: React.FC<IconPickerProps> = ({ onSelect, selectedIcon }) => {
  const [isOpen, setIsOpen] = useState(false);

  const iconOptions = Object.keys(tqxIconLibrary);

  return (
    <Popover isOpen={isOpen} onClose={() => setIsOpen(false)} trigger="click">
      <PopoverTrigger>
        <IconButton
          aria-label="icon_team"
          colorScheme={tqxIconLibrary[selectedIcon || 0].colorScheme} // 增加一个默认值，如果不存在就用默认值1
          backgroundColor={tqxIconLibrary[selectedIcon || 0].backgroundColor}
          icon={tqxIconLibrary[selectedIcon || 0].icon}
          onClick={() => setIsOpen((prev) => !prev)}
          size={"md"}
        />
      </PopoverTrigger>

      <PopoverContent>
        <PopoverArrow />
        <PopoverCloseButton />
        <PopoverHeader>Select an Icon</PopoverHeader>
        <PopoverBody>
          <Box display="flex" flexWrap="wrap" p="1" m="-1">
            {iconOptions.map((icon) => (
              <Box
                key={icon}
                onClick={() => {
                  onSelect(icon);
                  setIsOpen(false);
                }}
                p={1}
                m={1}
                borderRadius="md"
                cursor="pointer"
                _hover={{ bg: "blue.100" }}
                display="flex"
                alignItems="center"
              >
                <IconButton
                  aria-label="icon_team"
                  colorScheme="blue"
                  backgroundColor="#36abff"
                  icon={tqxIconLibrary[icon].icon}
                />
              </Box>
            ))}
          </Box>
        </PopoverBody>
      </PopoverContent>
    </Popover>
  );
};

export default IconPicker;
export { tqxIconLibrary };
