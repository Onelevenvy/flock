import { extendTheme } from "@chakra-ui/react";

// 定义一致的颜色变量
const colors = {
  ui: {
    main: "#2762e7",
    secondary: "#EDF2F7",
    success: "#48BB78",
    danger: "#E53E3E",
    white: "#FFFFFF",
    dark: "#1A202C",
    darkSlate: "#252D3D",
    bgMain: "#f8fafc", // 更清新的背景色
    // bgMain:"#e9ebf0",
    bgMainDark: "#1a202c",
    hoverColor: "#f1f5f9",
    hoverColorDark: "#2d3748",
    selectedColor: "#e2e8f0",
    selectedColorDark: "#2d3748",
    accent: "#3b82f6", // 强调色
    muted: "#64748b", // 次要文本颜色
    wfhandlecolor: "#3182ce",
    inputbgcolor:"#f2f4f7"
  },
};

// 定义一致的组件样式
const components = {
  Button: {
    baseStyle: {
      fontWeight: "500",
      borderRadius: "lg",
    },
    variants: {
      primary: {
        bg: "ui.main",
        color: "ui.white",
        _hover: {
          bg: "#1C86EE",
          _disabled: {
            bg: "ui.main",
          },
        },
      },
      secondary: {
        bg: "ui.secondary",
        color: "ui.dark",
        _hover: {
          bg: "gray.300",
        },
      },
      danger: {
        bg: "ui.danger",
        color: "ui.white",
        _hover: {
          bg: "#E32727",
        },
      },
    },
  },
  Card: {
    baseStyle: {
      container: {
        borderRadius: "xl",
        boxShadow: "sm",
      },
    },
  },
  Heading: {
    baseStyle: {
      fontWeight: "600",
    },
  },
  Text: {
    baseStyle: {
      color: "ui.dark",
    },
  },
  Input: {
    variants: {
      filled: {
        field: {
          borderRadius: "lg",
          bg: "gray.50",
          _hover: {
            bg: "gray.100",
          },
          _focus: {
            bg: "gray.100",
            borderColor: "ui.main",
          },
        },
      },
    },
    defaultProps: {
      variant: "filled",
    },
  },
};

// 定义全局样式
const styles = {
  global: {
    body: {
      bg: "ui.bgMain",
      color: "ui.dark",
    },
  },
};

const theme = extendTheme({
  colors,
  components,
  styles,
  fonts: {
    heading: `'Inter', -apple-system, system-ui, sans-serif`,
    body: `'Inter', -apple-system, system-ui, sans-serif`,
  },
});

export default theme;
