module.exports = {
  parser: "@typescript-eslint/parser",
  plugins: ["@typescript-eslint", "unused-imports", "react", "react-hooks", "import"],
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:react/recommended",
    "plugin:react-hooks/recommended",
    "plugin:import/errors",
    "plugin:import/warnings",
    "plugin:import/typescript",
    "next/core-web-vitals",
    "prettier" // 确保这个在最后
  ],
  rules: {
    // 基本规则
    "no-console": ["warn", { allow: ["warn", "error"] }],
    "no-unused-vars": "off",
    "@typescript-eslint/no-unused-vars": "off",
    "unused-imports/no-unused-imports": "error",
    "unused-imports/no-unused-vars": [
      "warn",
      { "vars": "all", "varsIgnorePattern": "^_", "args": "after-used", "argsIgnorePattern": "^_" }
    ],

    // React 相关规则
    "react/prop-types": "off",
    "react/react-in-jsx-scope": "off",
    "react/jsx-filename-extension": ["warn", { "extensions": [".tsx"] }],
    "react-hooks/rules-of-hooks": "error",
    "react-hooks/exhaustive-deps": "warn",

    // 移除或放宽导入顺序规则
    "import/order": "off",
    "import/newline-after-import": "off",
    "import/no-unresolved": "off", // 禁用无法解析模块路径的规则

    // TypeScript 特定规则
    "@typescript-eslint/explicit-function-return-type": "off",
    "@typescript-eslint/explicit-module-boundary-types": "off",
    "@typescript-eslint/no-explicit-any": "off",
    "@typescript-eslint/no-non-null-assertion": "warn",

    // 其他常用规则
    "no-use-before-define": "off",
    "@typescript-eslint/no-use-before-define": ["error"],

    // 移除 padding-line-between-statements 规则
    "padding-line-between-statements": "off",

    // 新增规则
    "import/default": "off",
    "import/no-named-as-default": "off"
  },
  settings: {
    "react": {
      "version": "detect"
    },
    "import/resolver": {
      "typescript": {},
      "node": {
        "extensions": [".js", ".jsx", ".ts", ".tsx"]
      }
    }
  }
};
