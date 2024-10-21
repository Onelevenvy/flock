import { useColorMode } from "@chakra-ui/react"; // 假设你使用的是 @chakra-ui/react 来处理 colorMode
import "highlight.js/styles/github-dark.css"; // 导入 GitHub Dark 主题的 CSS 文件
const LoadMarkdownCSSStyle = () => {
  const { colorMode } = useColorMode();

  // useEffect(() => {
  //   const loadCSS = async () => {
  //     if (colorMode === "dark") {
  //       await import ("highlight.js/styles/github-dark.css");
  //     } else {
  //       await import("highlight.js/styles/github.css");
  //     }
  //   };

  //   loadCSS();
  // }, [colorMode]);

  // return null;
};

export default LoadMarkdownCSSStyle;
